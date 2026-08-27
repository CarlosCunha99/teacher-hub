# Code Review

## Verdict
**approve**

## Summary
This PR implements MVP teacher authentication on NextAuth v5 (credentials provider, JWT session), a bcryptjs password layer, a pure validation layer, an in-memory user repository, register/sign-in server actions with pages, a protected dashboard, a `/api/me` endpoint, sign-out on the home page, and middleware that redirects unauthenticated traffic to `/sign-in`. I read every interface against `contract.md` and ran the full gate locally: `tsc --noEmit`, ESLint, `next build`, and Vitest all pass (47 passed, 1 intentionally skipped e2e-dependent middleware test). The implementation conforms closely to the locked contract — `authorize` returns `null` for both failure modes (enumeration-resistant), `passwordHash` is never returned into the session, email normalization happens in both repository and actions, and the duplicate-email check runs before `hashPassword`. I found no correctness, security, or contract-violation issues that block merge; only a few minor UX/observability notes.

## Blocking findings
None.

## Important findings

### Post-create auto-sign-in failure is reported as a generic validation error
- **File:** `src/app/(auth)/register/actions.ts:47-56`
- **Category:** logic
- **Basis:** code-logic
- **Issue:** `repository.create(...)` runs first and persists the account, then `signIn(...)` is called. If `signIn` throws for any reason other than a duplicate-email match, the catch block returns `AUTH_ERRORS.VALIDATION_ERROR` ("Please correct the errors below.") even though the account was successfully created. The teacher sees a confusing form error for a state that actually succeeded; a retry then yields `EMAIL_IN_USE`.
- **Evidence:** The account is written in `create` before `signIn`; the catch has no branch distinguishing "created but auto-login failed" from a genuine validation problem. Contract (Interface 6) permits `redirect: false` auto sign-in but does not specify this failure mode.
- **Suggested fix direction:** On a post-create `signIn` failure, treat registration as succeeded (e.g. return `{ ok: true }` and let the client route to `/sign-in`) rather than surfacing a generic validation error.

## Suggestions

### `/api/me` 401 branch is effectively unreachable for unauthenticated callers
- **File:** `src/app/api/me/route.ts:6-8` and `src/middleware.ts:16`
- The middleware matcher does not exclude `/api/me`, so unauthenticated requests are redirected (307) to `/sign-in` before the handler runs. The handler's own 401 response is therefore only defensive. This satisfies AC9 (protected content not served), but an API consumer expecting JSON gets an HTML redirect. If a JSON 401 is desired for API clients, exclude `/api/me` from the matcher and rely on the handler's 401. Non-blocking.

### In-memory store is per-process, not shared across serverless instances
- **File:** `src/auth.ts:7` (`export const userRepository = new InMemoryUserRepository()`)
- In a multi-instance/serverless deployment, an account registered on one instance may be invisible to a later sign-in served by another instance, and all accounts reset on restart. This is explicitly in-scope-as-MVP per the contract ("in-memory for MVP") and documented in `README.md`, so it is expected — flagged only so the human reviewer is aware before this ships anywhere with more than one server process.

### `session.user.id` is threaded via inline casts rather than module augmentation
- **File:** `src/auth.ts:54-57`, `src/app/api/me/route.ts:12`
- `id` is attached/read with `(session.user as { id?: string })` casts. This works and typechecks, but a `next-auth` module augmentation would make `session.user.id` first-class and avoid repeated casts in downstream tickets (#4/#7/#8). Purely organizational.

## Contract adherence
Strong. Spot-checked against every interface:
- **Interface 1 (repository):** lowercase normalization in both `findByEmail` and `create`; `crypto.randomUUID()` id; throws `"email already in use"` on duplicate; per-instance state. Matches.
- **Interface 2 (password):** `bcryptjs` with cost 10; wraps `hash`/`compare`; imports `bcryptjs` (not native `bcrypt`). Matches.
- **Interface 3 (errors):** exact string constants `as const`; single `INVALID_CREDENTIALS` used for both sign-in failure paths. Matches.
- **Interface 4 (validation):** discriminated-union returns, no throws, short-circuit name→email→password order, 8-char password rule, `normalizeEmail = trim().toLowerCase()`. Matches.
- **Interface 5 (`authorize`):** returns `null` (never throws) for unknown email and wrong password identically; returns only `{id,email,name}` (no `passwordHash`); jwt/session callbacks add `id`. Matches.
- **Interface 6 (registerAction):** `"use server"`, validate → dup-check → hash → create → auto sign-in; dup check before hash. Matches.
- **Interface 7 (middleware):** matcher string is character-for-character the contract value; redirect to `/sign-in`, pass-through with `NextResponse.next()`. Matches.
- **Interface 8 (`.env.example`):** `NEXTAUTH_SECRET=change-me` (9 chars) and `NEXTAUTH_URL`. Matches, and verified next-auth v5 reads `NEXTAUTH_SECRET`/`NEXTAUTH_URL` as backward-compat fallbacks (`node_modules/next-auth/lib/env.js`), so the deferred `AUTH_*` naming does not break signing.

## Requirements coverage
- **AC1 (register creates account):** covered — `registerAction` + `create`.
- **AC2 (duplicate email rejected, friendly msg):** covered — pre-check + repository throw + `EMAIL_IN_USE`.
- **AC3 (password hashed only):** covered — `hashPassword` before `create`; only `passwordHash` stored; never returned.
- **AC4 (correct credentials sign in):** covered — `authorize` success path + `verifyPassword`.
- **AC5 (wrong credentials, generic msg, no enumeration):** covered — identical `null` return for both cases; `INVALID_CREDENTIALS` surfaced.
- **AC6 (stays recognized across requests):** covered — JWT strategy, `id` in token/session; verified via `auth()` in dashboard/home/`/api/me`.
- **AC7 (sign out → unauthenticated):** covered — `signOut({ redirectTo: "/sign-in" })` server action on home page.
- **AC8 (old session rejected after sign-out):** partial — relies on NextAuth JWT/cookie behavior; not unit-tested (contract acknowledges manual/e2e). Reasonable for MVP.
- **AC9 (unauthenticated protected route/API rejected):** covered — middleware redirect (tested); dashboard also self-guards via `auth()`.
- **AC10 (friendly error messages):** covered — `AUTH_ERRORS` + validation messages rendered in `role="alert"`.
- **AC11 (missing/malformed fields rejected):** covered — `validateRegistrationInput`/`validateSignInInput` with tests.

## Notes
- **Model-independence limitation:** the code reviewer (claude-opus-4.8 / Claude) shares a model family with the tester (claude-sonnet-4.6 / Claude) because only two families were available for this run. The coder used gpt-5.3-codex / OpenAI. I reviewed adversarially and independently regardless of family overlap.
- Verification performed locally in the worktree: `tsc --noEmit` (exit 0), `vitest run` (47 passed, 1 skipped), and the `scripts.test.ts` gate confirms `npm run lint`, `format:check`, and `build` all pass.
- The one skipped test (`middleware.test.ts` authenticated pass-through) is a deliberate e2e-dependent skip documented in the test; the unauthenticated-redirect and matcher-exclusion cases are covered.
- Non-source items flagged in `verify.md` (committed `.orchestration/` artifacts, `/api/me` not in impact.md) are process/scoping notes, not code defects; the `/api/me` endpoint does correctly gate on `auth()`.
