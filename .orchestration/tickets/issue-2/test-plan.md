# Test plan

## Coverage summary
- Unit tests: 16 new, 0 updated
- Functional/integration tests: 8 new, 0 updated
- Existing regression tests preserved: yes — see notes below

**Regression notes:**
- `src/__tests__/env-config.test.ts` — the "no real-looking secrets" regex (`/(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}/i`) will trip on `NEXTAUTH_SECRET=` if the placeholder value is ≥16 chars and looks like base64. The new placeholder **must** use a sentinel ≤15 printable ASCII characters (e.g. `your-secret-here` is exactly 16 — use `change-me` or `<your-secret>`). Verify the test still passes after adding the placeholder.
- `src/__tests__/readme.test.ts` — only asserts `npm install`, `npm run dev`, `folder structure`, and `env` mentions; adding `NEXTAUTH_SECRET`/`NEXTAUTH_URL` to README does not break these, but the README must not lose any of those patterns.
- `src/app/api/health/__tests__/route.test.ts` — must keep passing; the middleware matcher must explicitly exclude `/api/health`.

## Test runner
- Framework: Vitest (detected in `package.json` scripts `"test": "vitest run"`)
- Command: `vitest run`
- Fast subset: `vitest run --reporter=verbose src/lib/auth/__tests__ src/lib/repositories/__tests__ src/auth.__tests__ src/middleware.__tests__`

---

## Behaviors to test

### Unit

- **hashPassword produces a non-plaintext digest** — `hashPassword(plain)` returns a string that is not equal to `plain` and has the expected bcrypt/argon2 prefix.
  - File: `src/lib/auth/__tests__/password.test.ts` (new)
  - Key assertions:
    - `result !== plain`
    - result starts with `$2b$` (bcrypt) or equivalent algorithm prefix
  - Setup: no mocks; pure function
  - Maps to acceptance criterion: AC3 (password stored only in securely hashed form)

- **hashPassword is non-deterministic** — calling `hashPassword` twice with the same input produces two different hashes (salted).
  - File: `src/lib/auth/__tests__/password.test.ts` (new)
  - Key assertions:
    - `hashA !== hashB`
  - Setup: no mocks
  - Maps to acceptance criterion: AC3

- **verifyPassword returns true for matching password** — `verifyPassword(plain, hash)` returns `true` when `hash` was produced from `plain`.
  - File: `src/lib/auth/__tests__/password.test.ts` (new)
  - Key assertions:
    - `await verifyPassword("correct-password", hash) === true`
  - Setup: pre-hash once with `hashPassword`; no mocks
  - Maps to acceptance criterion: AC4 (sign in with correct password succeeds)

- **verifyPassword returns false for wrong password** — `verifyPassword(wrong, hash)` returns `false` when `wrong` is not the source of `hash`.
  - File: `src/lib/auth/__tests__/password.test.ts` (new)
  - Key assertions:
    - `await verifyPassword("wrong-password", hash) === false`
  - Setup: pre-hash "correct-password"; no mocks
  - Maps to acceptance criterion: AC5 (wrong password rejected)

- **InMemoryUserRepository.create stores a new user** — creating a user with valid `{name, email, passwordHash}` returns a user object with an `id`, and the user is subsequently retrievable.
  - File: `src/lib/repositories/__tests__/user-repository.test.ts` (new)
  - Key assertions:
    - returned object has `id`, `email`, `name`, `passwordHash`, `createdAt`
    - `findByEmail(email)` returns the same user after creation
  - Setup: fresh `InMemoryUserRepository` instance per test
  - Maps to acceptance criterion: AC1 (registration creates a new account)

- **InMemoryUserRepository.findByEmail returns null for unknown email** — querying with an email that has never been registered returns `null`.
  - File: `src/lib/repositories/__tests__/user-repository.test.ts` (new)
  - Key assertions:
    - `await repo.findByEmail("unknown@example.com") === null`
  - Setup: empty repository
  - Maps to acceptance criterion: AC5 (unknown email during sign-in returns no user)

- **InMemoryUserRepository.create throws on duplicate email (exact case)** — creating a second user with the exact same email throws an error whose message indicates the email is already in use.
  - File: `src/lib/repositories/__tests__/user-repository.test.ts` (new)
  - Key assertions:
    - second `create` call rejects / throws
    - error message references email already in use
  - Setup: one prior `create` call with the same email
  - Maps to acceptance criterion: AC2 (duplicate email rejected)

- **InMemoryUserRepository.create throws on duplicate email (case-insensitive)** — creating a second user where only the email casing differs (e.g. `A@X.COM` vs `a@x.com`) also throws the duplicate-email error. Only the email casing differs from the previous test; all other inputs are identical.
  - File: `src/lib/repositories/__tests__/user-repository.test.ts` (new)
  - Key assertions:
    - second `create` call rejects with duplicate-email error
  - Setup: one prior `create` with lowercase email; second `create` uses uppercase variant
  - Maps to acceptance criterion: AC2 (email uniqueness is case-insensitive)

- **InMemoryUserRepository.findByEmail is case-insensitive** — `findByEmail` with a differently-cased version of the stored email returns the existing user. Only the lookup casing differs from the "returns null for unknown email" test.
  - File: `src/lib/repositories/__tests__/user-repository.test.ts` (new)
  - Key assertions:
    - `findByEmail("USER@EXAMPLE.COM")` returns the user stored as `user@example.com`
  - Setup: one stored user with lowercase email
  - Maps to acceptance criterion: AC4 / edge case (email case-insensitive sign-in)

- **authorize callback returns user for correct credentials** — calling `authorize({email, password})` with a valid registered teacher's credentials returns a session-safe user object (no `passwordHash`).
  - File: `src/auth.__tests__/credentials.test.ts` (new)
  - Key assertions:
    - return value is non-null
    - returned object contains `id`, `email`, `name`
    - returned object does **not** contain `passwordHash`
  - Setup: stub `IUserRepository` that returns a pre-hashed user; use `hashPassword` to produce the hash in setup
  - Maps to acceptance criterion: AC4 (correct credentials → recognized session)

- **authorize callback returns null for wrong password** — calling `authorize` with a valid email but an incorrect password returns `null` (not an exception). Only the `password` input axis changes from the "correct credentials" test.
  - File: `src/auth.__tests__/credentials.test.ts` (new)
  - Key assertions:
    - return value is `null`
  - Setup: same stubbed repository as "correct credentials" test; password changed to `"wrong-password"`
  - Maps to acceptance criterion: AC5 (wrong password rejected with invalid-credentials)

- **authorize callback returns null for unknown email** — calling `authorize` with an email not found in the repository returns `null` (not an exception). Only the `email` input axis changes from the "correct credentials" test.
  - File: `src/auth.__tests__/credentials.test.ts` (new)
  - Key assertions:
    - return value is `null`
  - Setup: stubbed repository whose `findByEmail` always returns `null`
  - Maps to acceptance criterion: AC5 (unknown email rejected with same invalid-credentials message → enumeration resistance)

- **authorize callback error message is identical for wrong password vs unknown email** — the `CredentialsSignin` error (or null return) used for wrong password and for unknown email must produce the same user-facing error string.
  - File: `src/auth.__tests__/credentials.test.ts` (new)
  - Key assertions:
    - error message strings are equal between the two failure cases (or both return `null` without an attached message)
  - Setup: two calls — one with unknown email, one with known email + wrong password; compare thrown error messages or return values
  - Maps to acceptance criterion: AC5 + edge case (enumeration resistance — sign-in failures do not reveal which part was wrong)

- **Registration field validation — missing name** — submitting registration without a name is rejected with a validation error before any repository interaction.
  - File: `src/app/(auth)/register/__tests__/actions.test.ts` (new)
  - Key assertions:
    - action returns a validation error (not an unhandled exception)
    - error message references the name field
    - repository `create` is NOT called
  - Setup: mock repository; pass `{name: "", email: "a@example.com", password: "12345678"}`
  - Maps to acceptance criterion: AC11 (missing/malformed fields rejected with clear validation message)

- **Registration field validation — invalid email format** — submitting registration with a malformed email (e.g. `not-an-email`) is rejected before repository interaction. Only the email input axis differs from the "missing name" test.
  - File: `src/app/(auth)/register/__tests__/actions.test.ts` (new)
  - Key assertions:
    - action returns a validation error referencing email format
    - repository `create` is NOT called
  - Setup: mock repository; pass `{name: "Alice", email: "not-an-email", password: "12345678"}`
  - Maps to acceptance criterion: AC11

- **Registration field validation — password too short** — submitting registration with a password shorter than 8 characters is rejected. Only the password input axis differs from the "invalid email format" test.
  - File: `src/app/(auth)/register/__tests__/actions.test.ts` (new)
  - Key assertions:
    - action returns a validation error referencing password length
    - repository `create` is NOT called
  - Setup: mock repository; pass `{name: "Alice", email: "a@example.com", password: "1234567"}`
  - Maps to acceptance criterion: AC11 + edge case (minimum 8-character password policy)

---

### Functional / integration

- **Registration success flow** — a teacher submits valid registration data and ends up with a new account in the repository.
  - File: `src/app/(auth)/register/__tests__/page.test.tsx` (new)
  - Preconditions: empty in-memory repository; all required fields filled with valid data
  - Actions: render `<RegisterPage />`; fill in name, valid email, password ≥8 chars; submit form
  - Assertions:
    - no error message displayed
    - repository contains a new user with the submitted email
    - stored `passwordHash` is not equal to the submitted password (AC3)
    - user is redirected to a protected or post-registration page (success state)
  - Cleanup: n/a (test isolation via fresh repository instance)
  - Maps to acceptance criterion: AC1, AC3

- **Registration duplicate-email error** — a teacher tries to register with an email already in use and receives an "email already in use" message.
  - File: `src/app/(auth)/register/__tests__/page.test.tsx` (new)
  - Preconditions: repository already contains a user with `alice@example.com`
  - Actions: render `<RegisterPage />`; fill in a different name but the same email; submit
  - Assertions:
    - a visible, human-readable error message about duplicate email is displayed
    - no second user record created in repository
  - Cleanup: n/a
  - Maps to acceptance criterion: AC2, AC10

- **Registration validation-error display** — submitting the form with an empty email shows an inline validation message without calling the server action.
  - File: `src/app/(auth)/register/__tests__/page.test.tsx` (new)
  - Preconditions: repository empty
  - Actions: render `<RegisterPage />`; leave email blank; submit
  - Assertions:
    - a validation error message is visible in the page
    - no repository interaction occurs
  - Cleanup: n/a
  - Maps to acceptance criterion: AC11, AC10

- **Sign-in success flow** — a registered teacher signs in with correct credentials and is recognized as authenticated.
  - File: `src/app/(auth)/sign-in/__tests__/page.test.tsx` (new)
  - Preconditions: repository contains a user with `alice@example.com` and a hashed password
  - Actions: render `<SignInPage />`; enter correct email and password; submit
  - Assertions:
    - no error message displayed
    - NextAuth `signIn` callback completes without error
    - user is redirected to the protected area / home
  - Cleanup: n/a
  - Maps to acceptance criterion: AC4

- **Sign-in invalid-credentials error** — a teacher submits an unknown email or wrong password and receives a user-friendly error message.
  - File: `src/app/(auth)/sign-in/__tests__/page.test.tsx` (new)
  - Preconditions: repository contains `alice@example.com`
  - Actions (two separate sub-cases):
    - Sub-case A: submit with `alice@example.com` + wrong password. Only password differs from success precondition.
    - Sub-case B: submit with `unknown@example.com` + any password. Only email differs from success precondition.
  - Assertions for both sub-cases:
    - a visible, human-readable "invalid credentials" error is displayed
    - the error message is identical for sub-case A and sub-case B (enumeration resistance)
    - teacher remains unauthenticated
  - Cleanup: n/a
  - Maps to acceptance criterion: AC5, AC10 + edge case (enumeration resistance)

- **Middleware blocks unauthenticated request to protected route** — a request without a valid session cookie to a protected path is redirected to the sign-in page.
  - File: `src/middleware.__tests__/middleware.test.ts` (new)
  - Preconditions: no session cookie in request
  - Actions: invoke middleware with a `NextRequest` targeting a protected path (e.g. `/dashboard`)
  - Assertions:
    - middleware returns a redirect response
    - redirect location points to sign-in page
  - Cleanup: n/a
  - Maps to acceptance criterion: AC9

- **Middleware passes authenticated request through** — a request with a valid signed session token to a protected path is allowed through.
  - File: `src/middleware.__tests__/middleware.test.ts` (new)
  - Preconditions: valid `__Secure-authjs.session-token` (or equivalent) cookie present. Only the cookie header axis changes from the "blocks unauthenticated" test.
  - Actions: invoke middleware with `NextRequest` for the same protected path, adding a valid session token cookie (stub or use NextAuth's `encode` helper)
  - Assertions:
    - middleware returns `NextResponse.next()` (no redirect)
  - Cleanup: n/a
  - Maps to acceptance criterion: AC6 (recognized across requests), AC9

- **Middleware leaves public and NextAuth routes unaffected** — requests to `/api/health` and `/api/auth/**` are not redirected regardless of session state.
  - File: `src/middleware.__tests__/middleware.test.ts` (new)
  - Preconditions: no session cookie present
  - Actions: invoke middleware separately with paths `/api/health`, `/api/auth/signin`, `/api/auth/callback/credentials`
  - Assertions:
    - all three return `NextResponse.next()` (no redirect)
  - Cleanup: n/a
  - Maps to acceptance criterion: AC9 (public routes remain accessible) + regression guard for existing health-route test

---

## Edge cases covered
- **Security — enumeration (email vs. password in sign-in)** → tested by: "authorize callback error message identical for wrong password vs unknown email" (unit) + "sign-in invalid-credentials error" sub-cases A/B (functional)
- **Security — credential storage (plaintext never stored)** → tested by: "hashPassword produces non-plaintext digest" + "Registration success flow" (stored hash ≠ submitted password)
- **Security — session cannot be reused after sign-out** → see "Not tested" below
- **Email case-insensitivity for uniqueness** → tested by: "InMemoryUserRepository.create throws on duplicate email (case-insensitive)"
- **Email case-insensitivity for sign-in lookup** → tested by: "InMemoryUserRepository.findByEmail is case-insensitive"
- **Minimum 8-character password policy** → tested by: "Registration field validation — password too short"
- **Public routes not blocked by middleware** → tested by: "Middleware leaves public and NextAuth routes unaffected"

## Not tested (with reason)

- **AC6 — session continuity across browser restart** — Session cookie persistence across browser restarts is a browser/NextAuth runtime concern; it cannot be exercised in a Vitest/jsdom unit/integration test. The `authorize` callback and middleware tests together verify session recognition within a request. Covered by: manual verification or e2e tests outside this ticket's scope.
- **AC7 / AC8 — sign-out clears session and previously issued token is rejected** — NextAuth's `signOut` and server-side session invalidation logic are part of the NextAuth runtime (cookie clearing, JWT revocation). The unit and middleware tests confirm unauthenticated requests are blocked; the specific "reuse an old token post-sign-out" scenario requires a running NextAuth server and an e2e harness not currently present. Covered by: manual verification; may be added as a Playwright test in a later ticket.
- **AC6 — session max-age / expiry** — No specific max-age value is asserted; this is a NextAuth configuration concern verified through the solution's `AUTH_SECRET` and `maxAge` option, not a behavioral test.
- **Password strength above minimum** — Only the minimum 8-character rule is tested. No complexity (uppercase/symbol) requirements exist per the solution's stated defaults.
- **Email verification before sign-in** — Explicitly out of scope per solution; no email verification step exists.
- **Rate limiting / lockout** — Explicitly deferred out of scope per solution.
- **Multiple simultaneous sessions / concurrent devices** — Not specified; assumed allowed and not tested.
- **`src/__tests__/env-config.test.ts` regression** — Existing test; not new. The placeholder value for `NEXTAUTH_SECRET` in `.env.example` must be ≤15 printable ASCII chars (e.g. `<your-secret>`) to avoid the existing regex match — this is a **constraint on implementation**, not a new test case.
- **`src/__tests__/readme.test.ts` regression** — Existing test; not new. Adding `NEXTAUTH_SECRET`/`NEXTAUTH_URL` docs to README satisfies its existing assertions without modification.

---

## Fixtures & data

| Fixture | Description | Location |
|---|---|---|
| Valid registration payload | `{name: "Alice Teacher", email: "alice@example.com", password: "password123"}` | Inline in test files or a shared `fixtures/auth.ts` under `src/__tests__/fixtures/` |
| Pre-hashed password | `bcrypt.hash("password123", 10)` result for use in repository stub setup | Produced once in `beforeAll` in `src/auth.__tests__/credentials.test.ts` |
| Stubbed `IUserRepository` | Object implementing `IUserRepository` with Jest/Vitest `vi.fn()` methods | Inline factory in each test file that needs it |
| Valid session token | Encoded JWT produced with `encode()` from NextAuth v5 internals for middleware tests | Produced in `beforeAll` in `src/middleware.__tests__/middleware.test.ts` |

---

## Acceptance criteria traceability matrix

| AC | Test(s) |
|---|---|
| AC1 — register creates account | "InMemoryUserRepository.create stores a new user" (unit); "Registration success flow" (functional) |
| AC2 — duplicate email rejected with message | "InMemoryUserRepository.create throws on duplicate email (exact case/case-insensitive)" (unit); "Registration duplicate-email error" (functional) |
| AC3 — password stored as hash only | "hashPassword produces non-plaintext digest"; "hashPassword is non-deterministic"; "Registration success flow" stored-hash assertion |
| AC4 — correct credentials sign in | "verifyPassword returns true for matching password"; "authorize returns user for correct credentials"; "Sign-in success flow" |
| AC5 — wrong credentials rejected with generic message | "verifyPassword returns false for wrong password"; "authorize returns null for wrong password"; "authorize returns null for unknown email"; "authorize error message identical for both failure cases"; "Sign-in invalid-credentials error" sub-cases A and B |
| AC6 — signed-in user stays recognized | "Middleware passes authenticated request through" |
| AC7 — sign out → unauthenticated | Not tested in automated suite — manual/e2e verification (see "Not tested") |
| AC8 — old session rejected after sign-out | Not tested in automated suite — manual/e2e verification (see "Not tested") |
| AC9 — unauthenticated requests to protected routes rejected | "Middleware blocks unauthenticated request"; "Middleware leaves public/NextAuth routes unaffected" |
| AC10 — friendly error messages | "Registration duplicate-email error" (friendly message assertion); "Sign-in invalid-credentials error" (friendly message assertion) |
| AC11 — missing/malformed fields rejected | "Registration field validation — missing name"; "Registration field validation — invalid email format"; "Registration field validation — password too short"; "Registration validation-error display" |
