# Implementation plan

## Goal
Teachers can register, sign in, stay authenticated across requests, sign out, and be blocked from protected UI/API surfaces when unauthenticated.

## Approach
Implement authentication with NextAuth v5's credentials provider and keep all auth decisions in server-side code. `src/auth.ts` will own the credentials flow, session strategy, and friendly auth-error mapping, while App Router pages and API routes consume the exported helpers instead of duplicating session logic.

Keep persistence behind a small repository contract so this ticket can ship before the PostgreSQL schema in issue #3. For MVP, the repository will be an in-memory implementation that stores normalized email, hashed password, display name, and timestamps, which lets registration and sign-in work without binding the auth flow to a final database adapter.

Make the UX concrete by adding first-party register and sign-in pages, auto-signing in after successful registration, and exposing a simple protected dashboard plus one protected API route. Route protection will be enforced centrally in middleware, with explicit exclusions for `/api/health`, `/api/auth/**`, and public auth pages.

## Steps
1. **Add auth dependencies and config surface** — Update `package.json` to add `next-auth` and `bcryptjs`, document auth env keys in `.env.example`, and extend `README.md` with local setup notes for auth secrets, session cookies, and the temporary in-memory user store. Depends on: none.
2. **Create auth domain primitives** — Add `src/lib/auth/errors.ts`, `src/lib/auth/password.ts`, and `src/lib/auth/validation.ts` to centralize friendly error types, password hash/compare helpers, the minimum-8-character policy, email normalization, and shared field validation used by both registration and sign-in flows. Depends on: step 1.
3. **Add the swappable user repository** — Create `src/lib/repositories/user-repository.ts` with the teacher-account shape and an in-memory implementation exposing `findByEmail` and `create`, including duplicate-email rejection on normalized email values so issue #3 can later replace only the storage layer. Depends on: step 2.
4. **Wire NextAuth credentials and session helpers** — Create `src/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts` to configure the credentials provider, call the repository during authorization, return enumeration-safe invalid-credentials failures, store the teacher identity in the session/JWT, and export the reusable auth helpers for pages, actions, and middleware. Depends on: step 3.
5. **Build registration flow** — Create `src/app/(auth)/register/actions.ts` and `src/app/(auth)/register/page.tsx` so registration validates name/email/password, rejects duplicate emails with a friendly message, hashes the password before persistence, creates the teacher record, and signs the teacher into a live session immediately after success. Depends on: step 4.
6. **Build sign-in, sign-out, and auth-aware landing UI** — Create `src/app/(auth)/sign-in/actions.ts` and `src/app/(auth)/sign-in/page.tsx`, and update `src/app/page.tsx` to show sign-in/register affordances for guests plus a recognized-signed-in state for authenticated teachers, including a deliberate sign-out action wired through NextAuth. Depends on: step 4.
7. **Add protected UI and API surfaces** — Create `src/app/dashboard/page.tsx`, `src/app/api/me/route.ts`, and `src/middleware.ts` so authenticated teachers have a protected destination, unauthenticated requests are redirected or rejected before protected content loads, and matcher rules keep `/api/health`, `/api/auth/**`, and static assets public. Depends on: steps 5, 6.
8. **Tighten integration and docs-facing details** — Verify the final auth file paths, redirects, and user-facing copy are consistent across the new pages, middleware, and repo docs, and adjust any auth-related wording in `README.md` or `.env.example` that would otherwise conflict with the shipped flow. Depends on: step 7.

## Files
### Create
- `src/auth.ts` — NextAuth v5 configuration, credentials authorization, JWT/session callbacks, and exported auth helpers
- `src/middleware.ts` — centralized protection for authenticated routes with explicit public-route exclusions
- `src/app/api/auth/[...nextauth]/route.ts` — App Router handler that re-exports NextAuth HTTP handlers
- `src/app/api/me/route.ts` — protected API endpoint that proves session-backed identity is available server-side
- `src/app/(auth)/register/actions.ts` — server action for registration validation, persistence, and post-create sign-in
- `src/app/(auth)/register/page.tsx` — teacher registration screen with friendly validation and duplicate-email feedback
- `src/app/(auth)/sign-in/actions.ts` — server action for credential sign-in and friendly invalid-credentials handling
- `src/app/(auth)/sign-in/page.tsx` — teacher sign-in screen for returning users
- `src/app/dashboard/page.tsx` — initial protected page shown only to authenticated teachers
- `src/lib/auth/errors.ts` — typed auth-domain errors and user-safe messages
- `src/lib/auth/password.ts` — password hashing and verification helpers
- `src/lib/auth/validation.ts` — shared field validation, password-policy checks, and email normalization
- `src/lib/repositories/user-repository.ts` — repository contract plus in-memory teacher-account implementation

### Modify
- `package.json` — add runtime auth and password-hashing dependencies
- `README.md` — document auth env setup, local auth behavior, and in-memory persistence caveat
- `.env.example` — add placeholder auth variables without real-looking secret values
- `src/app/page.tsx` — make the home page session-aware with guest/authenticated states and navigation

### Delete
- None.

## Data / schema / migration
No database migration in this ticket. The in-memory repository should model the future teacher record shape (`id`, `name`, normalized `email`, `passwordHash`, `createdAt`) so issue #3 can replace the backing store behind the same interface without rewriting the auth flow. Email uniqueness should be enforced case-insensitively by normalizing before lookup and create.

## Rollout
- Feature flag? no.
- Backfill? no; this introduces new accounts only.
- Ordering: ship after auth env placeholders/docs are in place; production must set the auth secret and app URL before relying on sign-in, but no database rollout is required because storage is intentionally in-memory for MVP.

## Assumptions and non-decisions
- The first protected user destination will be `src/app/dashboard/page.tsx`, and the first protected API example will be `src/app/api/me/route.ts`.
- Sessions use NextAuth's cookie-backed JWT strategy and persist across browser restarts until sign-out or configured max age.
- The in-memory repository is an intentional bridge to issue #3, not a persistence guarantee across server restarts.
- Exact UI styling and component extraction remain the coder's call as long as forms stay accessible and messages stay user-friendly.

## Not doing
- Email verification before first sign-in.
- Password reset, account recovery, MFA, social auth, or role/permission systems.
- Rate limiting or lockout flows for repeated failed sign-in attempts.
- PostgreSQL schema work, migrations, or durable account storage beyond the repository seam for issue #3.
