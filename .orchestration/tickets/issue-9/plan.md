# Implementation plan

## Goal
Teachers can view versioned terms, accept them once per version, and are server-blocked from uploads until the current acceptance is recorded and visible in settings.

## Approach
Keep the legal source of truth inside the app for MVP: the terms text and current version live in a shared module, while acceptance history is stored append-only in PostgreSQL. Introduce thin infrastructure boundaries now—a DB client and a current-user/session adapter—so this ticket can land without hard-coding auth or persistence assumptions throughout routes and pages.

Server enforcement comes first. A dedicated acceptance helper should answer whether the current teacher has accepted `CURRENT_TERMS_VERSION` and, if not, record that acceptance idempotently. Both the acceptance API and upload API should use that helper so the UI cannot bypass the gate. The schema must prevent duplicate rows for the same teacher/version pair while preserving older rows for audit history.

Once the server path exists, add the user-facing surfaces: a readable `/terms` page, an upload screen that blocks behind an acceptance prompt linked to that page, and a settings screen that shows the accepted version and timestamp. Because authentication and uploads are still separate tickets, keep those integration boundaries explicit so later work can swap in the real implementations without reworking the compliance logic.

## Steps
1. **Establish terms and integration boundaries** — Add `src/lib/terms.ts` for the current terms version/text, `src/lib/db.ts` for PostgreSQL access, and `src/lib/auth.ts` (or equivalent current-user adapter) for resolving the authenticated teacher ID. Update `package.json` only with the minimal DB dependency needed by those helpers. Depends on: none.
2. **Persist acceptance history** — Create `migrations/001_create_terms_acceptances.sql` and `src/lib/terms-acceptance.ts`. Define an append-only `terms_acceptances` table with `teacher_id`, `terms_version`, `accepted_at`, and a uniqueness constraint on `(teacher_id, terms_version)`. Implement helpers for “has accepted current terms,” “get latest acceptance,” and idempotent record creation that tolerates concurrent first-upload attempts. Depends on: step 1.
3. **Expose acceptance status and write APIs** — Add `src/app/api/terms-acceptance/route.ts` with `GET` for the current teacher’s status and `POST` for accepting the current version. Both handlers should read identity through the auth adapter, reject unauthenticated access consistently, and use the shared acceptance helper rather than inline SQL. Depends on: step 2.
4. **Gate the upload path on the server** — Add `src/app/api/upload/route.ts` as the authoritative enforcement point. Before any upload work runs, check the current teacher’s acceptance against `CURRENT_TERMS_VERSION` and return a structured 403 when missing or stale. Keep the upload-specific logic behind a narrow placeholder boundary so issue #4 can plug in real file handling later without weakening the gate. Depends on: step 2.
5. **Add the teacher-facing acceptance experience** — Create `src/app/terms/page.tsx`, `src/components/TermsAcceptanceModal.tsx`, and `src/app/upload/page.tsx`. Render the full terms from the shared module, fetch current acceptance status, block the upload UI behind an explicit checkbox/accept action, and link to the full terms page. Treat an outdated acceptance the same as no acceptance so a version bump re-engages the prompt. Depends on: steps 3 and 4.
6. **Show acceptance details in settings** — Create `src/app/settings/page.tsx` using the shared helper/API to display the teacher’s accepted version and timestamp, plus a clear stale/missing status when the current version has not been accepted. Keep presentation simple; the key requirement is auditable visibility for the teacher. Depends on: steps 2 and 3.
7. **Document configuration and rollout constraints** — Update `.env.example` and `README.md` with the new `DATABASE_URL` requirement, the terms page/upload/settings routes, and the fact that a terms version bump re-requires acceptance on the next upload. Depends on: steps 1–6.

## Files
### Create
- `src/lib/terms.ts` — app-level source of truth for terms content and version.
- `src/lib/db.ts` — shared PostgreSQL connection/helper layer.
- `src/lib/auth.ts` — narrow current-user adapter so routes/pages do not hard-code future auth details.
- `src/lib/terms-acceptance.ts` — acceptance queries, status derivation, and idempotent write logic.
- `src/app/api/terms-acceptance/route.ts` — status/read + acceptance/write endpoints.
- `src/app/api/upload/route.ts` — server-side upload gate enforcing accepted current terms.
- `src/app/terms/page.tsx` — readable full terms page.
- `src/components/TermsAcceptanceModal.tsx` — upload-side acceptance prompt with affirmative control.
- `src/app/upload/page.tsx` — upload entry point that surfaces the prompt before upload actions.
- `src/app/settings/page.tsx` — account view of accepted version/timestamp and stale status.
- `migrations/001_create_terms_acceptances.sql` — schema for append-only acceptance records.

### Modify
- `package.json` — add the minimal PostgreSQL client dependency needed by the new server helpers.
- `.env.example` — document `DATABASE_URL` with placeholder values only.
- `README.md` — document the new terms flow, env requirement, and route surfaces.

### Delete
- None.

## Data / schema / migration
Add `terms_acceptances` as an append-only table keyed by a synthetic id, with `teacher_id`, `terms_version`, and `accepted_at`. Enforce uniqueness on `(teacher_id, terms_version)` to make repeated accepts idempotent and safe under concurrency. No backfill; older users simply appear unaccepted for the current version until they accept.

## Rollout
- Feature flag? no
- Backfill? no — acceptance starts collecting from first deployment of the gate.
- Ordering: provision database access and run the migration before enabling the acceptance or upload routes in environments that receive traffic.

## Assumptions and non-decisions
- The implementation may introduce a thin auth adapter, but it should not attempt to deliver full authentication; that remains issue #2.
- The upload route can be a guarded shell if issue #4 has not landed yet; the compliance gate is the durable part.
- Terms text/version live in code for MVP; no admin editing surface is planned here.
- The exact UI styling is left to the coder as long as the prompt is explicit, accessible, and linked to the full terms page.

## Not doing
- Building the real authentication system, full upload pipeline, or admin tooling for editing legal copy.
- Reworking unrelated pages/navigation beyond what is needed to expose the terms, upload, and settings surfaces.
