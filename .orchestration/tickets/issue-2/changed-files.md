# Changed Files — issue-2

Branch: `mvp-teacher-auth-session-management`
Base: `main`
Agent review: **approve** (0 blocking, 1 important, 3 suggestions)

## Production files (new)

| File | Purpose |
|------|---------|
| `src/auth.ts` | NextAuth v5 config, credentials provider, JWT/session callbacks, `userRepository` singleton export |
| `src/middleware.ts` | Route protection via `auth()` wrapper; matcher excludes auth routes + static assets |
| `src/app/api/auth/[...nextauth]/route.ts` | Thin handler re-export for NextAuth |
| `src/app/api/me/route.ts` | Protected API — returns `{ id, email, name }` or 401 |
| `src/app/dashboard/page.tsx` | Protected dashboard page (redirects unauthenticated) |
| `src/app/(auth)/register/actions.ts` | `"use server"` registration action: validate → dedup → hash → create → signIn |
| `src/app/(auth)/register/page.tsx` | Registration form (React 19 `useActionState`) |
| `src/app/(auth)/sign-in/actions.ts` | Sign-in server action |
| `src/app/(auth)/sign-in/page.tsx` | Sign-in form |
| `src/lib/auth/errors.ts` | `AUTH_ERRORS` constants |
| `src/lib/auth/password.ts` | `hashPassword` / `verifyPassword` via bcryptjs |
| `src/lib/auth/validation.ts` | Input validation + `normalizeEmail` |
| `src/lib/repositories/user-repository.ts` | `IUserRepository` interface + `InMemoryUserRepository` |

## Production files (modified)

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Added `SessionProvider` wrapper |
| `src/app/page.tsx` | Session-aware home (guest vs authenticated) |
| `package.json` | Added `next-auth@^5.0.0-beta.32`, `bcryptjs`, `@types/bcryptjs` |
| `.env.example` | Added `NEXTAUTH_SECRET` + `NEXTAUTH_URL` placeholders |
| `README.md` | Auth setup docs, in-memory store caveat |

## Test files (new)

| File | Coverage |
|------|---------|
| `src/lib/auth/__tests__/password.test.ts` | `hashPassword`/`verifyPassword` unit tests |
| `src/lib/repositories/__tests__/user-repository.test.ts` | `InMemoryUserRepository` unit tests |
| `src/auth.__tests__/credentials.test.ts` | `authorize` callback via real repo+verifyPassword |
| `src/app/(auth)/register/__tests__/actions.test.ts` | `registerAction` validation unit tests |
| `src/app/(auth)/register/__tests__/page.test.ts` | Registration flow integration tests |
| `src/app/(auth)/sign-in/__tests__/page.test.ts` | Sign-in flow + validation tests |
| `src/middleware.__tests__/middleware.test.ts` | Middleware route protection tests |

## Test results
47 passed, 1 skipped (e2e sign-out invalidation — requires running NextAuth server)

## Important finding (non-blocking)
In `register/actions.ts`: if the post-register `signIn` throws for a non-duplicate reason, the account is already persisted but the user sees a misleading generic error. Registration succeeded; the message is inaccurate.
