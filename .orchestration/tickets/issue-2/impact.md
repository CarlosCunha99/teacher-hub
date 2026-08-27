# Impact analysis

## Direct changes

### Net-new files
- `src/auth.ts` — NextAuth v5 config: credentials provider, `authorize` callback, session/JWT callbacks, minimum-8-char password policy, enumeration-safe error messages
- `src/middleware.ts` — Next.js middleware that intercepts all requests and redirects unauthenticated visitors away from protected routes to sign-in
- `src/app/api/auth/[...nextauth]/route.ts` — thin NextAuth HTTP handler (re-exports from `src/auth.ts`)
- `src/app/(auth)/register/page.tsx` — registration form (name, email, password); client component; calls a server action or API route
- `src/app/(auth)/register/actions.ts` (or `route.ts`) — server action / API route that validates fields, checks for duplicate email, hashes password, persists via repository
- `src/app/(auth)/sign-in/page.tsx` — sign-in form; may use NextAuth's default page or a custom one wired to `signIn()`
- `src/lib/repositories/user-repository.ts` — `IUserRepository` interface + in-memory implementation (swappable for PostgreSQL in issue #3); exposes `findByEmail`, `create`
- `src/lib/auth/password.ts` — bcrypt (or argon2) hash/compare helpers; wraps the chosen hashing library
- `src/lib/auth/errors.ts` — typed auth-error constants (`INVALID_CREDENTIALS`, `EMAIL_IN_USE`, `VALIDATION_ERROR`)

### Modified existing files
- `src/app/layout.tsx` — gains `SessionProvider` wrapper (NextAuth client context); changes the root layout from a pure server component to one that renders a client boundary
- `src/app/page.tsx` — gains auth-aware UI (sign-in / sign-out links, current-user display or redirect logic)
- `.env.example` — gains `NEXTAUTH_SECRET` and `NEXTAUTH_URL` placeholder entries (no real values)
- `package.json` — gains `next-auth` (v5) runtime dep and `bcryptjs` (or `argon2`) runtime dep; gains `@types/bcryptjs` dev dep

## Indirect: callers & consumers

- `src/app/api/health/route.ts` calls nothing auth-related — impact: **none** (health route is intentionally auth-free)
- `src/lib/health.ts` exports `HEALTH_STATUS`, `HealthPayload` — not touched by auth — impact: **none**
- `src/app/layout.tsx` is the root shell imported by every page — adding `SessionProvider` changes server/client rendering boundary — impact: **behavior-change** (root layout gains a client boundary; pages that previously were pure RSC will still be RSC inside the provider, but the shell itself becomes a client component wrapper; acceptable and standard NextAuth v5 pattern)
- `src/middleware.ts` (new) intercepts every request matching its `matcher` — any future route added to the app will automatically be subject to auth enforcement if it falls within the matcher pattern — impact: **behavior-change** for all protected routes added by downstream tickets

## Public API surface

- Exported: `IUserRepository` in `src/lib/repositories/user-repository.ts` — new interface; no existing callers, but issue #3 will implement it for PostgreSQL
- Exported: `auth`, `signIn`, `signOut`, `handlers` from `src/auth.ts` — new; consumed by middleware, layout, pages, and the NextAuth route handler
- Exported: `hashPassword`, `verifyPassword` from `src/lib/auth/password.ts` — new; consumed by registration action and `authorize` callback
- Exported: auth error constants from `src/lib/auth/errors.ts` — new; consumed by register/sign-in forms and server actions

**Breaking:** None. No existing exported symbols are removed or signature-changed.

## Tests affected

- `src/app/api/health/__tests__/route.test.ts` — **not broken** by auth changes (health route remains public and middleware matcher should exclude `/api/health`); verify matcher config keeps it open
- `src/__tests__/env-config.test.ts` — **affected**: the test asserts `.env.example` contains no secret-looking values matching `(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}`; the new `NEXTAUTH_SECRET=` placeholder must use a short or obviously fake value (e.g. `your-secret-here`) to avoid tripping this regex — must be verified
- `src/__tests__/readme.test.ts` — potentially affected if it asserts documented env vars; `README.md` may need updating to mention `NEXTAUTH_SECRET` / `NEXTAUTH_URL`

### New test files required
- `src/lib/auth/__tests__/password.test.ts` — unit tests for `hashPassword` / `verifyPassword`
- `src/lib/repositories/__tests__/user-repository.test.ts` — unit tests for in-memory repository (`findByEmail`, `create`, duplicate-email guard)
- `src/auth.__tests__/credentials.test.ts` (or colocated) — unit tests for the `authorize` callback: correct credentials, wrong password, unknown email, enumeration-safe error
- `src/middleware.__tests__/middleware.test.ts` — tests for route protection: unauthenticated request redirected, authenticated request passed through, public routes unaffected
- `src/app/(auth)/register/__tests__/page.test.tsx` — integration/component tests for registration form: success flow, duplicate email error, validation errors
- `src/app/(auth)/sign-in/__tests__/page.test.tsx` — integration/component tests for sign-in form: success flow, invalid credentials error

## Docs to update

- `README.md` — **Environment configuration** section: add `NEXTAUTH_SECRET` and `NEXTAUTH_URL` to the list of variables that arrive in issue #2; describe that `NEXTAUTH_SECRET` must be a strong random value in production
- `.env.example` — add `NEXTAUTH_SECRET` and `NEXTAUTH_URL` placeholder lines with comments explaining their purpose and how to generate a secret

## Migrations / config / infra

- `.env.example` / `.env.local` — two new required variables:
  - `NEXTAUTH_SECRET=<random-32-byte-hex-or-base64>` — required by NextAuth v5 in production to sign/verify JWTs and session cookies
  - `NEXTAUTH_URL=http://localhost:3000` — required by NextAuth v5 to construct redirect URLs (can be omitted in some v5 configurations if `AUTH_URL` is used instead; confirm with NextAuth v5 docs)
- `package.json` — new runtime deps (`next-auth@^5`, `bcryptjs` or `argon2`); no build pipeline changes beyond `npm install`
- No database migrations in this ticket — persistence is intentionally behind an in-memory repository until issue #3 delivers the PostgreSQL schema

## External systems

- **In-memory user store** (new) — users registered during a server process lifetime are lost on restart; this is expected and by design for this ticket; issue #3 will replace it with PostgreSQL
- **Session cookie** — NextAuth v5 issues a signed, httpOnly, Secure cookie; no external session store (Redis, DB) is needed for the JWT strategy; browser is the only external party holding session state
- **No email service** — registration does not send a verification email (explicitly deferred per solution); no SMTP/email provider dependency introduced

## Estimated diff size

- Files touched: ~18 (9 net-new production files, 4 modified production files, ~5 new test files)
- Rough lines changed:
  - Production code: ~450 lines added, ~30 lines modified
  - Test code: ~250 lines added (password helpers, repository, authorize callback, middleware, register/sign-in form tests)
  - Config / docs: ~20 lines (.env.example, README)
  - **Total: ~750 lines**
- Confidence: **medium** — NextAuth v5 config boilerplate is well-known; form/action implementation line counts depend on chosen validation library (zod vs. native) and whether NextAuth's built-in sign-in page is reused

**Downstream churn:** The `IUserRepository` interface and its in-memory implementation will be replaced or extended when issue #3 delivers the PostgreSQL adapter. The in-memory implementation test file (`src/lib/repositories/__tests__/user-repository.test.ts`) and any fixtures relying on it will need updating then — estimated ~50 additional lines of test rewrite at that point (counted here as a downstream cost, not in the diff above). No wire-format or cookie-shape breaking changes are expected between the in-memory and PostgreSQL variants.

## Warnings

- **`env-config.test.ts` secret regex:** The existing test at `src/__tests__/env-config.test.ts` rejects `.env.example` values matching `(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}`. The new `NEXTAUTH_SECRET=` placeholder must use a clearly non-secret sentinel value (e.g. `NEXTAUTH_SECRET=your-nextauth-secret-here`) or the test will fail in CI. The placeholder must be short or non-base64 to stay under 16 printable characters after the `=`.
- **Root layout becomes a client boundary:** Wrapping `RootLayout` in `SessionProvider` introduces a client component at the very top of the component tree. Any page that currently relies on `RootLayout` being a pure React Server Component will be rendered inside a client boundary. This is standard NextAuth v5 usage but should be verified against any RSC-specific assumptions in downstream tickets.
- **In-memory store is not persisted:** The in-memory `IUserRepository` implementation is wiped on every server restart or hot-reload. Developers who restart `npm run dev` between registration and sign-in will lose their test accounts. This must be called out in the README dev-setup notes to avoid confusion.
- **No `bcryptjs` / `argon2` in current deps:** `package.json` has no password-hashing library. Adding one (and its `@types/*` counterpart) is a required change not mentioned in the ticket text. The solution references bcrypt implicitly; the concrete library choice must be made during planning.
- **NextAuth v5 is in release-candidate / stable v5 state:** The existing `package.json` pins `next@^15.1.6`. NextAuth v5 targets Next.js 14/15 and is the correct major to use, but the exact semver range should be pinned carefully (e.g. `^5.0.0`) since v5 had breaking changes relative to v4 and the `@auth/nextjs` package name differs from `next-auth` in some v5 distributions.
- **Middleware matcher scope:** `src/middleware.ts` will run on every matched request. If the matcher is too broad (e.g. `matcher: ['/((?!api/health).*)']`), it may inadvertently block the health-check endpoint used in CI, breaking the existing health-route test. The matcher pattern must explicitly exclude `/api/health` and NextAuth's own `/api/auth/**` routes.
