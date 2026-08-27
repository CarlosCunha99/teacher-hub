# Implementation context (shared A/B brief)

> This brief is for both the **coder** and the **tester**. Read it before touching any
> file. It captures codebase conventions, utilities to reuse, and commands that are
> verified to work.

---

## Files this touches

- `src/auth.ts` — NextAuth v5 config: credentials provider, `authorize` callback, JWT/session callbacks, exported helpers (`auth`, `signIn`, `signOut`, `handlers`)
- `src/middleware.ts` — centralized route protection; public exclusions for `/api/health`, `/api/auth/**`, `/sign-in`, `/register`
- `src/app/api/auth/[...nextauth]/route.ts` — thin re-export of NextAuth HTTP handlers from `src/auth.ts`
- `src/app/api/me/route.ts` — protected API endpoint proving session-backed identity server-side
- `src/app/(auth)/register/actions.ts` — `"use server"` action for registration: validate → deduplicate → hash → persist → auto-sign-in
- `src/app/(auth)/register/page.tsx` — registration form; client component; wires to `registerAction`
- `src/app/(auth)/sign-in/actions.ts` — `"use server"` action (or direct NextAuth `signIn` call) for credential sign-in
- `src/app/(auth)/sign-in/page.tsx` — sign-in form for returning teachers
- `src/app/dashboard/page.tsx` — first protected page; shown only to authenticated teachers
- `src/lib/auth/errors.ts` — typed auth-error string constants: `AUTH_ERRORS.INVALID_CREDENTIALS`, `EMAIL_IN_USE`, `VALIDATION_ERROR`
- `src/lib/auth/password.ts` — `hashPassword` / `verifyPassword` wrappers around `bcryptjs`
- `src/lib/auth/validation.ts` — `validateRegistrationInput`, `validateSignInInput`, `normalizeEmail`; pure functions, no I/O
- `src/lib/repositories/user-repository.ts` — `IUserRepository` interface + `InMemoryUserRepository` implementation; `TeacherAccount` shape
- `package.json` — add `next-auth@^5`, `bcryptjs`, `@types/bcryptjs`
- `src/app/layout.tsx` — gains `SessionProvider` wrapper (NextAuth client context)
- `src/app/page.tsx` — becomes session-aware: guest vs authenticated states
- `.env.example` — add `NEXTAUTH_SECRET=change-me` and `NEXTAUTH_URL=http://localhost:3000`
- `README.md` — document `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and the in-memory store caveat

---

## Patterns to follow

- **Naming:** `camelCase` for functions and variables; `PascalCase` for React components, TypeScript interfaces, and type aliases; `SCREAMING_SNAKE_CASE` for module-level constants (e.g. `AUTH_ERRORS`, `HEALTH_STATUS`); `kebab-case` for file and directory names.
- **Error handling:** Return discriminated unions (`{ ok: false; error: string }`) from server actions — never throw to the client. Throw (reject) from repository methods on constraint violations (duplicate email). Route handlers return `NextResponse.json(...)` with appropriate HTTP status.
- **Async style:** `async/await` throughout. No callbacks, no bare `.then()` chains. All App Router handlers and server actions are `async function`.
- **Testing style:** Vitest with Jest-compatible globals (`describe`, `it`, `expect`, `beforeAll`, `beforeEach`, `afterEach`, `vi`). Arrange / Act / Assert structure inside each `it` block. No shared mutable state across tests. Use `vi.fn()` for repository stubs — no external mocking libraries. Fresh `InMemoryUserRepository` instance per test (no module-level singleton in tests).
- **Module imports:** Use the `@/` path alias for cross-directory imports (e.g. `import { hashPassword } from "@/lib/auth/password"`). Relative imports are only acceptable within the same feature folder.
- **`"use server"` placement:** Add the `"use server"` directive as the very first line of `src/app/(auth)/register/actions.ts` and `src/app/(auth)/sign-in/actions.ts`.
- **`"use client"` placement:** Add to page components that use `useFormState` / `useFormStatus` / other React hooks.

---

## Utilities to reuse

- `@/lib/auth/password::hashPassword` — hash a plaintext password with bcrypt (cost 10). Use in `registerAction` before calling `repository.create`.
- `@/lib/auth/password::verifyPassword` — compare plaintext against a bcrypt hash. Use in `authorize` callback inside `src/auth.ts`.
- `@/lib/auth/validation::validateRegistrationInput` — validate name + email + password before any I/O. Use in `registerAction` as the first call.
- `@/lib/auth/validation::validateSignInInput` — validate email + password format before calling NextAuth. Use in sign-in action if a custom action is needed.
- `@/lib/auth/validation::normalizeEmail` — `email.trim().toLowerCase()`. Use before every `findByEmail` and `create` call.
- `@/lib/auth/errors::AUTH_ERRORS` — canonical user-facing error strings. Use `AUTH_ERRORS.INVALID_CREDENTIALS` in `authorize`; `AUTH_ERRORS.EMAIL_IN_USE` in `registerAction`.
- `@/lib/repositories/user-repository::InMemoryUserRepository` — the concrete in-memory store. Instantiate once at module level in `src/auth.ts` (or a shared module) and inject into `registerAction` and `authorize`.
- `next/server::NextResponse` — use `NextResponse.json(body, { status })` in all App Router route handlers and `NextResponse.redirect(url)` in middleware.
- `next-auth::NextAuth` — import default from `"next-auth"` when configuring `src/auth.ts`. Do NOT import `NextAuth` from `"@auth/nextjs"` (wrong package for next-auth v5).

---

## Anti-patterns in this codebase

- **Do not include `passwordHash` in the JWT or session user object.** The `authorize` callback must return `{ id, email, name }` only. The JWT and session callbacks must not forward hash-related fields.
- **Do not throw from `authorize`.** Both failure cases (unknown email, wrong password) must return `null`. Throwing causes NextAuth to surface a generic unhandled error rather than routing the user back to the sign-in form cleanly.
- **Do not distinguish unknown email from wrong password in error messages.** Both paths must produce the same user-visible text (`AUTH_ERRORS.INVALID_CREDENTIALS`) to prevent account enumeration.
- **Do not import `bcrypt` (native binding).** The project uses `bcryptjs` (pure JS). The native `bcrypt` binding requires compiled native modules and is not listed in `package.json`.
- **Do not create a global/module-level `InMemoryUserRepository` singleton in test files.** Each test must create a fresh instance to avoid state leaking between tests.
- **Do not call `hashPassword` before validating input and checking for duplicate email.** Bcrypt is intentionally slow (cost 10); run it only after all cheap checks pass.
- **Do not add `"use client"` to route handlers** (`src/app/api/**`). Route handlers are always server-side.
- **Do not import `next/headers` or `next/navigation` in unit-tested modules** (e.g. `password.ts`, `validation.ts`, `errors.ts`). These modules require Next.js server context and will break Vitest.
- **Do not use `lodash` or any utility library not already in `package.json`.** Add only `next-auth`, `bcryptjs`, and `@types/bcryptjs`.
- **Do not block `/api/health` in middleware.** The existing health-route test (`src/app/api/health/__tests__/route.test.ts`) must continue to pass; the middleware matcher must exclude `/api/health`.
- **Do not set `NEXTAUTH_SECRET` placeholder to a value ≥16 printable alphanumeric characters** in `.env.example`. The existing `src/__tests__/env-config.test.ts` asserts `/(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}/i` does NOT match. Use `change-me` (9 chars).

---

## Repo commands (verified)

- **Test:** `npm test` (runs `vitest run`)
- **Lint:** `npm run lint` (runs `next lint`)
- **Type check:** `npx tsc --noEmit`
- **Build:** `npm run build` (runs `next build`)
- **Dev server:** `npm run dev`

> After modifying `package.json` to add `next-auth`, `bcryptjs`, and `@types/bcryptjs`,
> run `npm install` before running any other command.

---

## Test environment notes

- `vitest.config.ts` sets `environment: "node"` globally — no DOM APIs are available by default.
- Tests that render React components (e.g. `page.test.tsx`) need `@vitest-environment jsdom` at the top of the file, or the global environment must be changed in `vitest.config.ts`. Neither is done yet — the coder/tester must decide.
- Vitest globals (`describe`, `it`, `expect`, `vi`, `beforeAll`, `beforeEach`, `afterEach`) are enabled via `globals: true` in `vitest.config.ts`. No explicit imports needed.
- Use `vi.fn()` to stub `IUserRepository` methods. Example:
  ```typescript
  const mockRepo: IUserRepository = {
    findByEmail: vi.fn(),
    create: vi.fn(),
  };
  ```
- Path alias `@/` is resolved via `vite-tsconfig-paths` plugin in `vitest.config.ts`.
- There are no external testing libraries (no `@testing-library/react`, no `msw`, no `jest-mock-extended`). Keep mocks hand-rolled with `vi.fn()`.
