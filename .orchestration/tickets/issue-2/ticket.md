# [MVP] Implement teacher authentication and session management

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/2

## Problem
✅ **Verified** (repo has no auth surface: `src/app/page.tsx` renders a static "Teacher Hub" main, the only API route is the database-free health check in `src/app/api/health/route.ts`, and `.env.example` notes auth variables "arrive in issues #2 and #3").

Teacher Hub is a platform for teachers to share and discover classroom resources, but today there is no way for a teacher to have an identity on the platform. Anyone visiting the app sees the same anonymous surface, and there is no concept of an account, a signed-in user, or a protected area. Because of this, teachers cannot own the content they contribute or reliably return to content they have saved.

This ticket establishes the first identity boundary for the product: letting a teacher create an account, prove who they are on return visits, stay recognized across a session, and deliberately end that session. It is the prerequisite for every downstream MVP capability (uploads, saves/boards, profiles) that must be attributed to a specific teacher.

## Impact
- Users affected: ⚠️ **Inferred** — all prospective teacher users; the product cannot onboard or retain any individual user without this. No usage/traffic numbers exist in the repo or raw context to size this precisely.
- Severity: ✅ **Verified** blocker — this is an MVP-labeled foundational feature (issue #2, `mvp` label) that later issues (#4 uploads, #7 saves/boards, #8 profiles) depend on for user attribution.
- Frequency: ⚠️ **Inferred** always — authentication is exercised on essentially every meaningful interaction once identity-bound features exist.

## Success criteria
- ✅ A teacher who has never used the platform can create an account using their name, email, and password, and end up recognized as a signed-in user.
- ✅ A returning teacher can sign in with their email and password and be recognized as the same account.
- ✅ A signed-in teacher stays recognized as they move between pages/requests until they sign out or their session ends.
- ✅ A teacher can deliberately sign out, after which they are no longer recognized and must sign in again to reach protected areas.
- ✅ Content and actions can be reliably attributed to the correct teacher account (enabling downstream ownership features).
- ✅ A teacher who provides bad or conflicting information (wrong password, already-registered email) receives a clear, human-readable explanation rather than a raw or generic error.

## Acceptance criteria
- [ ] A teacher can register by providing name, email, and password, and a new account is created for them.
- [ ] Registration rejects an email that is already associated with an existing account, and the teacher is told the email is already in use.
- [ ] A teacher's password is never retained in a readable form; it is stored only in a securely hashed form.
- [ ] A registered teacher can sign in with the correct email and password and becomes a recognized, signed-in user.
- [ ] Signing in with an unknown email or an incorrect password is rejected with a user-friendly "invalid credentials" message that does not reveal which part was wrong.
- [ ] A signed-in teacher remains recognized across subsequent page views/requests within the same session.
- [ ] A teacher can sign out, and after signing out they are treated as unauthenticated.
- [ ] After sign-out, the previously issued session can no longer be used to access protected areas.
- [ ] A request from an unauthenticated visitor to a protected route or protected API endpoint is rejected (not served the protected content).
- [ ] Authentication-related errors (invalid credentials, duplicate email, missing/invalid fields) are surfaced to the teacher as friendly, understandable messages.
- [ ] Submitting registration or sign-in with missing or malformed fields (e.g. empty email, invalid email format, empty password) is rejected with a clear validation message. ⚠️ **Inferred** from "user-friendly authentication errors"; exact validation rules unconfirmed — see Needs clarification.

## Edge cases & non-functional
- **Security — credential storage:** ✅ passwords stored only as secure hashes, never plaintext (explicit in original AC).
- **Security — enumeration:** ⚠️ sign-in failures should avoid revealing whether the email exists vs. the password was wrong (standard practice; not stated in ticket).
- **Security — brute force / rate limiting:** ❓ the ticket does not state whether repeated failed sign-in attempts should be throttled or locked. Unverified — see Needs clarification.
- **Security — transport & session integrity:** ⚠️ sessions must not be trivially forgeable or reusable after sign-out (implied by "session is invalidated").
- **Email uniqueness / case sensitivity:** ⚠️ email is treated as the unique identifier; whether matching is case-insensitive (e.g. `A@x.com` == `a@x.com`) is unconfirmed.
- **Password strength:** ❓ minimum length / complexity requirements are not specified. Unverified — see Needs clarification.
- **Email verification:** ❓ whether a newly registered teacher may sign in immediately or must first verify their email is not specified. This changes what "can sign in after registering" asserts. Unverified — see Needs clarification.
- **Session lifetime / "remember me":** ❓ how long a session stays valid, and whether it persists across browser restarts, is unspecified. Unverified — see Needs clarification.
- **Concurrency / multiple sessions:** ⚠️ whether the same teacher may be signed in on multiple devices simultaneously is unstated; assumed allowed unless clarified.
- **Database-agnostic timing:** ✅ **Verified** (raw-context 2026-08-27) — the persistent user store (users table: `id`, `email`, `password_hash`, `name`, `created_at`) is owned by issue #3 and is not yet available; auth work here is expected to stay decoupled from a finalized DB schema.
- **Accessibility / i18n of auth UI:** ⚠️ error messages are "user-friendly," but no explicit a11y or localization requirements are given; assume default app conventions.

## Out of scope
- Password reset / "forgot password" flows (not mentioned in the ticket).
- Third-party / social / SSO sign-in (Google, Microsoft, etc.) — not requested.
- Role or permission systems beyond a single "teacher" identity (no admin/student roles requested).
- The persistent PostgreSQL user schema and migrations — owned by issue #3.
- Account settings, profile editing, or account deletion — profiles are issue #8.
- Multi-factor authentication.
- Any resource-ownership or authorization business rules for specific features (uploads, boards) — those live with issues #4/#7.

## References
- Original ticket: https://github.com/CarlosCunha99/teacher-hub/issues/2
- Related: issue #1 (Next.js foundation, merged to main) — provides the app skeleton this builds on.
- Related: issue #3 (PostgreSQL schema for users, resources, tags, boards, interactions) — provides the persistent user store.
- Related downstream consumers of identity: issue #4 (uploads), issue #7 (saves/boards/likes), issue #8 (profiles).
- Repo docs: `README.md` (tech stack, folder structure), `.env.example` (auth/db env vars deferred to issues #2/#3).

## Raw context used
- `raw-context.md` — "Context drop 2026-08-27T21:12:55+01:00": issue #1 merged; stack is Next.js 15+/TypeScript/PostgreSQL; DB schema arrives in issue #3 and auth should stay DB-agnostic now; expected users table columns `id`, `email`, `password_hash`, `name`, `created_at`. (Implementation tooling recommendations in that entry are intentionally not carried into this product ticket.)

## Enrichment notes
- Expanded the single "Scope" line and 6 raw ACs into product-level problem framing, success criteria, and 11 testable acceptance criteria; added an enumeration-resistance criterion and a field-validation criterion inferred from the "user-friendly errors" requirement.
- Kept everything at the product/problem level; the raw context's tool suggestions (specific libraries, route names, middleware) were deliberately excluded as solution-level detail.
- **Ambiguity:** Email verification before first sign-in. Proposed reading: NOT required for MVP — a teacher can sign in immediately after registering. Rejected alternative: verification email required before activation. This determines whether the "sign in after registering" criterion is true immediately. blocking: no (accepted default for autonomous execution)
- **Ambiguity:** Password strength policy. Proposed reading: enforce a minimal rule (minimum 8 characters) with no strict complexity mandate. Rejected alternative: strict complexity (uppercase/number/symbol) requirements. A tester needs the concrete rule to assert acceptance. blocking: no (accepted default for autonomous execution)
- **Ambiguity:** Session lifetime / persistence. Proposed reading: session persists across page navigation and browser restart until sign-out, with a default max age. Rejected alternative: session ends on tab/browser close (no persistence). Affects the "stays recognized" acceptance assertion. blocking: no (accepted default for autonomous execution)
- **Ambiguity:** Rate limiting / lockout on repeated failed sign-ins. Proposed reading: out of scope for this MVP ticket; not asserted. Rejected alternative: required as a security AC. blocking: no
- **Ambiguity:** Email case-insensitivity for uniqueness/sign-in. Proposed reading: emails treated case-insensitively for matching. Rejected alternative: exact-case matching. blocking: no

## Needs clarification
The following sections rest on inferred (⚠️) or unverified (❓) assumptions and should be confirmed with the user before brainstorming/planning:
1. ❓ **Email verification** — Assumed not required for MVP (sign-in allowed immediately after registration).
2. ❓ **Password policy** — Assumed minimum length is 8 characters with no complexity requirements.
3. ❓ **Session lifetime** — Assumed cookie-backed session persists across browser restart until sign-out or configured max age.
4. ❓ **Rate limiting / lockout** — Should repeated failed sign-in attempts be throttled or locked for the MVP, or is that deferred? (non-blocking)
5. ❓/⚠️ **Field validation & email casing** — What exact field-validation rules apply (email format, empty fields), and should email matching be case-insensitive? (non-blocking)

Recommendation to orchestrator: proceed with the assumptions above for autonomous execution and keep them explicit in planning and contract artifacts.

---
## Original
## User Story
As a teacher, I want to create an account and sign in securely so that I can publish resources and manage my saved content.

## Scope
Implement sign-up, sign-in, sign-out, and authenticated session handling for teacher accounts.

## Acceptance Criteria
- [ ] Teachers can register with name, email, and password.
- [ ] Passwords are stored securely using hashing (never plaintext).
- [ ] Teachers can sign in and receive a valid authenticated session.
- [ ] Teachers can sign out and their session is invalidated.
- [ ] Protected routes/API endpoints reject unauthenticated requests.
- [ ] Authentication errors are user-friendly (invalid credentials, duplicate email, etc.).
