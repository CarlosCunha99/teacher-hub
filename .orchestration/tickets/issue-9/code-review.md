# Independent Code Review — issue-9

**Verdict:** ⚠️ **REQUEST-CHANGES**

**Confidence:** High

**Summary:** The terms gate itself is correct, server-authoritative, and well covered. Four substantive issues sit underneath it: an unhandled `pg` pool `error` event that will crash the Node process on routine connection loss; a terms-version rollback that permanently locks a teacher out of uploads while the UI reports success; a fabricated `acceptedAt` returned on the race path of a legal-evidence write; and a state-changing acceptance endpoint with no CSRF/Content-Type protection that becomes exploitable the moment issue #2 lands cookie auth.

## Review scope

- `git diff main...HEAD` (24 code/doc files; orchestration artifacts excluded from review)
- `ticket.md`, `contract.md`, `verify.md`
- All 9 new/changed production files and 8 new test files
- Independent verification: `npx tsc --noEmit` (exit 0), `npx vitest run` (39/39 pass, includes `lint`, `format:check`, `build`), `npx next build` (route render-mode inspection), `node_modules/pg-pool/index.js` (idle-client error path)

---

## Findings

### High-confidence issues

---

#### Finding 1 — Unhandled pool `error` event will crash the server process

**File:** `src/lib/db.ts:9-15`
**Severity:** High
**Category:** Bug / resilience

**Problem:** The `Pool` is created with no `error` listener. `pg-pool` emits `'error'` on the pool whenever a **idle** client hits a backend or network error:

```js
// node_modules/pg-pool/index.js:51-63
function makeIdleListener(pool, client) {
  return function idleListener(err) {
    ...
    pool.emit('error', err, client)   // <- no listener attached in src/lib/db.ts
  }
}
```

Node's `EventEmitter` **throws** when an `'error'` event is emitted with no registered listener. In a long-lived Next.js server this is not exotic — a Postgres restart, a failover, a managed-Postgres idle-connection reaper, or a transient network blip on a pooled-but-idle connection is enough. The result is an uncaught exception outside any request scope, i.e. a process crash that no route-level `try/catch` can intercept.

**Evidence:** Confirmed the emit path in the installed `pg` 8.23.0 (`pg-pool/index.js:62`). `node-postgres` documentation is explicit: *"if a pool emits an 'error' event and no listeners are added node will emit an uncaught error and potentially crash your node process."* No `pool.on("error", ...)` exists anywhere in the branch (`grep -rn "pool.on" src/` → empty).

**Contract note:** Not excluded. Interface 2's "NOT in contract" list covers pool *sizing/timeout/SSL* and a `close()` export — error handling is not carved out.

**Suggested fix:** Attach a pool-level `error` handler inside `getPool()` at creation time that logs and drops the client rather than letting the event go unhandled.

---

#### Finding 2 — A terms-version rollback permanently locks a teacher out, with the UI reporting success

**File:** `src/lib/terms-acceptance.ts:23-39`, `src/lib/terms-acceptance.ts:68-74`
**Severity:** Medium
**Category:** Logic error

**Problem:** `hasAcceptedCurrentTerms` / `getAcceptanceStatus` do not ask *"does a row exist for the current version?"* — they ask *"is the **most recent** row's version the current one?"* (`ORDER BY accepted_at DESC LIMIT 1`). Combined with `recordAcceptance` swallowing the `23505` unique violation as a success, this produces an unrecoverable state:

1. Teacher accepts `v1` at T1 → row `(teacher, v1, T1)`.
2. `CURRENT_TERMS_VERSION` bumped to `v2`. Teacher accepts `v2` at T2 → row `(teacher, v2, T2)`.
3. The bump is reverted (a `git revert` of the terms commit, a rollback deploy). `CURRENT_TERMS_VERSION` is `v1` again.
4. Latest row is `v2` ≠ `v1` → `accepted: false` → `/upload` shows the modal, `POST /api/upload` returns 403.
5. Teacher ticks the box and submits → `POST /api/terms-acceptance` with `version: v1` → `INSERT` violates `UNIQUE (teacher_id, v1)` → caught as `23505` → route responds **201 success** → modal calls `router.refresh()`.
6. Page re-renders. Latest row is still `v2`. Still `accepted: false`. **Loop forever.**

The teacher is hard-blocked from the platform's core action, the API reports success on every attempt, and nothing logs an anomaly. Note that the `UNIQUE (teacher_id, terms_version)` constraint already guarantees at most one row per (teacher, version), so an existence check would be both simpler and immune to this — the "latest row" ordering buys nothing for the forward-bump case it was designed for. Timestamp-tie ordering is also nondeterministic under `ORDER BY accepted_at DESC` alone.

**Evidence:** Traced statically through `latestAcceptanceRow` → `getAcceptanceStatus` → `upload/page.tsx:8-17` and `recordAcceptance` → `api/terms-acceptance/route.ts:26-31` → `TermsAcceptanceModal.tsx:32-41`. No code path breaks the loop.

**Contract note:** The root cause is inherited from contract Interface 4 ("the teacher's **most recent** acceptance row"), so this is a contract-level design flaw the coder faithfully implemented — not a coder deviation. It should be fixed in the contract and the implementation together.

**Suggested fix:** Replace the "latest row" predicate with an existence check on `(teacher_id, CURRENT_TERMS_VERSION)`, and use `ORDER BY accepted_at DESC, id DESC` anywhere a genuine "most recent" ordering is still needed.

---

#### Finding 3 — `recordAcceptance` returns a fabricated timestamp on the race path

**File:** `src/lib/terms-acceptance.ts:68-74`
**Severity:** Medium
**Category:** Incorrect data / auditability

**Problem:** On the `23505` unique-violation branch, the function returns `{ acceptedAt: new Date().toISOString() }` — a timestamp generated in application memory that corresponds to **no stored row**. `POST /api/terms-acceptance` forwards it verbatim in the 201 body.

The entire stated purpose of this ticket is *"the system can report which teacher accepted which terms version at what time"* (ticket.md success criteria). Handing a client a timestamp that provably differs from the durable legal-evidence record is exactly the failure this feature exists to prevent. Any caller that displays, logs, or forwards that value (a confirmation screen, an audit trail, an email receipt) will disagree with the database. The divergence widens with the duration of the race window, and is silent.

**Evidence:** `src/lib/terms-acceptance.ts:69-71` — the catch block never re-reads the conflicting row. The existing test (`terms-acceptance.test.ts`) only asserts `expect.any(String)`, so it cannot detect this.

**Contract note:** Contract Interface 4 permits this literal behavior. As with Finding 2, the contract should be corrected rather than the coder blamed.

**Suggested fix:** Use `INSERT ... ON CONFLICT (teacher_id, terms_version) DO UPDATE SET terms_version = EXCLUDED.terms_version RETURNING accepted_at` (or `DO NOTHING` followed by a `SELECT` of the existing row) so the returned timestamp always reflects the persisted record.

---

#### Finding 4 — No CSRF / Content-Type / Origin protection on the acceptance-recording endpoint

**File:** `src/app/api/terms-acceptance/route.ts:17-32`
**Severity:** Medium (latent — becomes exploitable when issue #2 lands cookie-based sessions)
**Category:** Security

**Problem:** `POST /api/terms-acceptance` is a state-changing endpoint that writes a legally binding record, and it validates nothing about request provenance: no `Origin`/`Sec-Fetch-Site` check, no CSRF token, and no `Content-Type` assertion. `Request.json()` in undici/Next does not enforce `Content-Type`, so the usual "JSON bodies are preflighted, therefore CSRF-safe" assumption does not hold here — a cross-origin HTML form with `enctype="text/plain"` sends a **simple request** (no preflight) whose body can be crafted to be valid JSON:

```html
<form action="https://…/api/terms-acceptance" method="POST" enctype="text/plain">
  <input name='{"version":"2026-08-01", "x":"' value='"}'>
</form>
```

which produces the body `{"version":"2026-08-01", "x":"="}` — parsed successfully by `request.json()`. With a cookie-backed session, any site the teacher visits can silently record a terms acceptance in their name. For a compliance feature whose evidentiary value is the whole point, a forgeable acceptance record is a material defect.

**Evidence:** Route reads `await request.json()` (line 24) with no header validation; `getCurrentTeacherId()` (`src/lib/auth.ts`) is currently a `null` stub, which is the only reason this is not exploitable **today**. Contract Interface 3 states the stub will be replaced by real session resolution in issue #2 — at which point this ships as a live CSRF hole unless addressed now.

**Suggested fix:** Reject requests whose `Content-Type` is not `application/json`, and/or validate `Origin`/`Sec-Fetch-Site` against the app origin. Record it as an explicit, tracked prerequisite on issue #2 if it is deliberately deferred.

---

### Medium-confidence issues

---

#### Finding 5 — After a version bump, settings can no longer show the version the teacher accepted

**File:** `src/lib/terms-acceptance.ts:41-53`, `src/app/settings/page.tsx:13-20`
**Severity:** Medium
**Category:** Requirements coverage

**Problem:** `getAcceptanceStatus` collapses "never accepted anything" and "accepted an older version" into an identical bare `{ accepted: false }`. The settings page therefore renders *"You have not yet accepted the current terms of use"* to a teacher who **did** accept — the prior acceptance and its timestamp simply become invisible in the UI even though the row is durably stored.

This works against two things the ticket asks for:

- Success criterion *"A teacher can review the terms version they accepted from their account/settings area"* — after any version bump, they can't.
- AC *"Notification or reminder appears if terms are updated to a new version"* / *"previously-accepted teachers are informed"* — the message is not a version-update notice, it's a factually incorrect "you never accepted" statement.

Contract Interface 10 itself anticipated the distinction (*"a clear 'not yet accepted' / **stale-status** message"*), but Interface 4's return shape makes carrying stale-status information impossible.

**Evidence:** `getAcceptanceStatus` returns `{ accepted: false }` with no `version`/`acceptedAt` for the stale case (`terms-acceptance.ts:52`); `settings/page.tsx:19` renders a single hardcoded string for that branch. The settings test only asserts the string contains `"not"`, so it does not distinguish the two cases.

**Suggested fix:** Extend `AcceptanceStatus` with the latest acceptance's version/timestamp regardless of currency (e.g. `latestVersion`/`latestAcceptedAt`), and branch the settings copy on "never accepted" vs "accepted an older version".

---

### Low-confidence notes (not blocking)

- **`/upload` and `/settings` are prerendered as static.** `npx next build` reports `○ /settings` and `○ /upload` — per-teacher pages baked at build time. Harmless today (the auth stub returns `null` for everyone), and Next.js will automatically flip them to dynamic once `getCurrentTeacherId()` reads `cookies()`/`headers()` per contract Interface 3. Worth a `export const dynamic = "force-dynamic"` as cheap insurance against an auth implementation that resolves identity without a dynamic API.
- **Module-level pool and HMR.** `let pool` in `src/lib/db.ts` is re-initialised on every dev hot-reload of the module, leaking a `Pool` per reload. The standard `globalThis`-cached-singleton pattern avoids it. Dev-only.
- **Untested contract-locked behavior.** The `401 { error: "unauthenticated" }` path on `GET`/`POST /api/terms-acceptance` is locked by contract Interface 5 but asserted by no test; `getAcceptanceStatus` has no direct unit test despite its specific "no `version`/`acceptedAt` keys when stale" post-condition. Both were already flagged in `spec-review.json` (SR-01, SR-05) and remain open.
- **Silent failure in the modal.** A non-`ok` response leaves the modal open with no feedback (`TermsAcceptanceModal.tsx:32-34`). Explicitly listed under Interface 8 "NOT in contract", so out of scope — but combined with the `null` auth stub it means every real submit today 401s and appears to do nothing.

---

## Contract adherence

| Interface | File | Adherence |
|---|---|---|
| 1 — terms constants | `src/lib/terms.ts` | ✅ Two non-empty string exports, no functions, no default export |
| 2 — db adapter | `src/lib/db.ts` | ✅ Shape matches; lazy pool confirmed. ⚠️ Missing pool error handler (Finding 1) — not excluded by the contract |
| 3 — auth adapter | `src/lib/auth.ts` | ✅ Zero-arg `Promise<string \| null>`, non-throwing stub as locked |
| 4 — acceptance helpers | `src/lib/terms-acceptance.ts` | ✅ Signatures and semantics match exactly, incl. `23505` absorption. ⚠️ The locked semantics themselves carry Findings 2, 3, 5 |
| 5 — acceptance route | `src/app/api/terms-acceptance/route.ts` | ✅ 401/400/201 + bodies match. Adds a `.catch(() => null)` on `request.json()` so malformed bodies yield 400 rather than 500 — a safe superset of the contract |
| 6 — upload route | `src/app/api/upload/route.ts` | ✅ Gate ordering, 401/403/501 and placeholder boundary all as locked |
| 7 — terms page | `src/app/terms/page.tsx` | ✅ Synchronous, renders both required values |
| 8 — modal | `src/components/TermsAcceptanceModal.tsx` | ✅ `"use client"`, `next/navigation` router, `/terms` link, labelled checkbox, disabled-until-checked, single fetch, `onAccepted` vs `router.refresh()`. Adds a `submitting` guard (prevents double-submit) — an improvement, contract-compatible |
| 9 — upload page | `src/app/upload/page.tsx` | ✅ Modal XOR upload form. Minor deviation: the `<h1>` renders in both branches (the contract's sample showed it only in the accepted branch) — a heading is not a form control, so the invariant holds |
| 10 — settings page | `src/app/settings/page.tsx` | ✅ Matches the locked sample. ⚠️ Cannot express the stale-status case the contract described (Finding 5) |
| 11 — migration | `migrations/001_create_terms_acceptances.sql` | ✅ Exact table/column names, `UNIQUE (teacher_id, terms_version)` present |
| 12 — test tooling | `package.json`, 4 test files | ✅ `@testing-library/react` + `jsdom` added; the pragma appears in exactly the four named files and no others; `vitest.config.ts` unchanged; no `jest-dom`; `vi.mock` calls are lexically top-level |
| 13 — deps & docs | `package.json`, `.env.example`, `README.md` | ✅ `pg` in `dependencies`, `@types/pg` dev-only; `DATABASE_URL` uncommented; README covers env var, all three routes, and version-bump behavior |

No unauthorized contract deviations. Every behavioral divergence found is either a strict superset of the locked behavior (malformed-body handling, double-submit guard) or a flaw inherited from the contract itself (Findings 2, 3, 5).

---

## Requirements coverage

| Acceptance criterion (ticket.md) | Status | Notes |
|---|---|---|
| Terms text stored with explicit, comparable version | ✅ Met | `CURRENT_TERMS_VERSION` + `TERMS_TEXT`, compared with `===` throughout |
| Unaccepted teacher blocked on first upload, shown terms + affirmative control | ✅ Met | `upload/page.tsx` renders the modal; checkbox gates the submit button |
| Server-side upload path rejects unaccepted teachers, unbypassable via UI | ✅ Met | `api/upload/route.ts` checks the gate before any placeholder logic; 3 tests cover it |
| Acceptance records identity, version, timestamp | ⚠️ Partial | Row is correct; the **returned** timestamp is fabricated on the race path (Finding 3) |
| Already-accepted teacher not re-prompted | ✅ Met | `getAcceptanceStatus`-driven branch; tested at page and route level |
| Teacher can view accepted version + timestamp in settings | ⚠️ Partial | True only while the version is current; the record becomes invisible after a bump (Finding 5) |
| Terms reachable as a linkable readable page | ✅ Met | `/terms` renders text + version; modal links to it. (Issue #12's "accessible from authentication flows" is unreachable — auth is #2) |
| Version bump forces re-acceptance before next upload | ⚠️ Partial | Forward bumps work. A rollback creates a permanent lockout (Finding 2); the "notification/reminder" half of the AC is only the blocking modal |
| Concurrent first-upload race creates no duplicates | ✅ Met | `UNIQUE (teacher_id, terms_version)` + `23505` absorption; tested |

---

## Verification performed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vitest run` | ✅ 14 files, 39 tests, all passing |
| `npm run lint` (via `scripts.test.ts`) | ✅ exit 0 |
| `npm run format:check` (via `scripts.test.ts`) | ✅ exit 0 (`.orchestration/` is prettier-ignored) |
| `npx next build` | ✅ succeeds; `/settings` `/upload` `/terms` static, all 3 API routes dynamic |
| `pg` idle-error path | ❌ Confirmed unhandled (Finding 1) |
| Secrets in diff | ✅ `.env.example` / `README.md` contain a `postgresql://user:password@localhost` placeholder only — not a live credential, and already present on `main` |

---

## Required before merge

1. **Finding 1** — attach a `pool.on("error", …)` handler in `src/lib/db.ts`. Production crash risk; cheap fix; no contract change needed.
2. **Finding 4** — reject non-`application/json` `Content-Type` (and/or validate `Origin`) on `POST /api/terms-acceptance`, or record it as a hard, tracked prerequisite on issue #2 before any cookie session ships.

## Should be resolved (contract amendment + implementation)

3. **Finding 2** — switch the acceptance predicate from "latest row's version" to "a row exists for the current version"; amend contract Interface 4.
4. **Finding 3** — return the persisted `accepted_at` on the conflict path via `ON CONFLICT … RETURNING`; amend contract Interface 4.
5. **Finding 5** — extend `AcceptanceStatus` so settings can distinguish "never accepted" from "accepted an older version"; amend contract Interfaces 4 and 10.

---

_Independent code review complete. Not ready for PR until items 1–2 are addressed._
