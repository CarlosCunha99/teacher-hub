# Contract — issue-2: MVP Teacher Authentication with NextAuth v5

> **This file is the interface lock.** Coder and tester must treat every signature,
> shape, and invariant here as ground truth. Do not deviate without updating this file
> first and informing both workers.

---

## Disambiguation log

| Ambiguity | Resolution | Source |
|---|---|---|
| `authorize` failure — throw vs. return `null` | **Return `null`** — locked. The `authorize` callback must return `null` on invalid credentials (wrong password or unknown email). It must NOT throw a `CredentialsSignin` error or any other exception. Both failure paths return the same `null` value to ensure enumeration resistance. | test-plan.md is explicit ("return value is `null`"); solution.md says "sign-in failure messages that do not distinguish". |
| Error constant shape — class vs. string constants | **String constant object** (`as const`) — locked. `src/lib/auth/errors.ts` exports typed string constants (`INVALID_CREDENTIALS`, `EMAIL_IN_USE`, `VALIDATION_ERROR`), not Error subclasses. Actions and forms use these strings to produce user-facing messages. | plan.md step 2 ("typed auth-error constants"); test-plan is consistent. |
| `validateRegistrationInput` / `validateSignInInput` return shape | **`{ ok: true }` or `{ ok: false; field: string; message: string }`** — locked. Both validators return a discriminated union; they do not throw. | test-plan.md asserts "action returns a validation error (not an unhandled exception)" and "error message references the name/email/password field". |
| Password hashing library | **`bcryptjs`** — locked. `hashPassword` wraps `bcryptjs.hash`; `verifyPassword` wraps `bcryptjs.compare`. Hash output starts with `$2b$`. | impact.md identifies `bcryptjs` as the chosen library; plan.md step 2 references it implicitly. |
| Session strategy | **JWT (cookie-backed)** — locked. No server-side session store. NextAuth v5 `strategy: "jwt"`. | solution.md: "cookie-backed session"; plan.md step 4. |
| `InMemoryUserRepository` email normalization site | **Both `create` and `findByEmail` normalize to lowercase before comparison/storage** — locked. Input email is stored already lowercased. Duplicate detection and lookup are always case-insensitive. | plan.md step 3 ("normalized email values"); test-plan.md tests for case-insensitive create and lookup. |
| `.env.example` `NEXTAUTH_SECRET` placeholder length | **`change-me` (9 chars)** — locked to ≤15 printable ASCII, not matching `/(password\|secret\|key)\s*=\s*[a-zA-Z0-9+\/]{16,}/i`. | test-plan.md regression note; env-config.test.ts regex. |
| Registration action — duplicate-email message | **Use `AUTH_ERRORS.EMAIL_IN_USE` constant** as the user-facing message prefix — locked. | plan.md step 5 ("rejects duplicate emails with a friendly message"); test-plan.md functional test asserts visible human-readable message. |

---

## Interface 1 — `src/lib/repositories/user-repository.ts`

### Path
`src/lib/repositories/user-repository.ts`

### Exports
```typescript
export interface TeacherAccount {
  id: string;
  name: string;
  email: string;          // stored lowercase-normalized
  passwordHash: string;
  createdAt: Date;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<TeacherAccount | null>;
  create(input: { name: string; email: string; passwordHash: string }): Promise<TeacherAccount>;
}

export class InMemoryUserRepository implements IUserRepository {
  findByEmail(email: string): Promise<TeacherAccount | null>;
  create(input: { name: string; email: string; passwordHash: string }): Promise<TeacherAccount>;
}
```

### Semantics

#### `findByEmail(email)`
- Normalizes `email` to lowercase before lookup (`email.toLowerCase()`).
- Returns the matching `TeacherAccount` if found, `null` otherwise.
- Never throws.

#### `create(input)`
- Normalizes `input.email` to lowercase before storing.
- Generates a unique `id` (e.g. `crypto.randomUUID()`).
- Sets `createdAt = new Date()`.
- Throws (rejects) with a human-readable message containing `"email already in use"` (case-insensitive match) if a record with the same normalized email already exists.
- Returns the persisted `TeacherAccount` including `id` and `createdAt`.

### Invariants
- `TeacherAccount.email` is always lowercase in storage.
- `id` is non-empty and unique across all records in the same instance.
- `InMemoryUserRepository` state is per-instance (no module-level singleton); tests must create a fresh instance per test.

### Import rule
```typescript
import { IUserRepository, InMemoryUserRepository, TeacherAccount } from "@/lib/repositories/user-repository";
// NOT: import ... from "../../lib/repositories/user-repository"
```

### NOT in contract
- Persistence across server restarts (intentionally in-memory for MVP).
- Pagination, update, or delete methods (out of scope for this ticket).
- Any SQL, Prisma, or network calls (issue #3 will provide those).

---

## Interface 2 — `src/lib/auth/password.ts`

### Path
`src/lib/auth/password.ts`

### Exports
```typescript
export async function hashPassword(plaintext: string): Promise<string>;
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean>;
```

### Semantics

#### `hashPassword(plaintext)`
- Returns a bcrypt hash string starting with `$2b$`.
- Uses a cost factor of `10` (rounds).
- The same `plaintext` produces different hashes on successive calls (salted).
- Does not validate minimum length — callers (validation layer) are responsible for that.

#### `verifyPassword(plaintext, hash)`
- Returns `true` if `hash` was produced from `plaintext`; `false` otherwise.
- Never throws on mismatches — only returns `false`.
- Wraps `bcryptjs.compare(plaintext, hash)`.

### Import rule
```typescript
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import bcrypt from "bcryptjs";   // internal use only — do NOT re-export bcrypt
```
> **Forbidden alternative:** `import bcrypt from "bcrypt"` — the project uses `bcryptjs`
> (pure-JS), not the native `bcrypt` binding. Using the native binding will fail in
> environments without build tooling for native modules.

### NOT in contract
- Key derivation functions other than bcrypt.
- Synchronous variants (`hashSync`, `compareSync`).

---

## Interface 3 — `src/lib/auth/errors.ts`

### Path
`src/lib/auth/errors.ts`

### Exports
```typescript
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  EMAIL_IN_USE: "An account with that email already exists.",
  VALIDATION_ERROR: "Please correct the errors below.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERRORS;
```

### Semantics
- `AUTH_ERRORS` is a frozen, string-literal constant object. Values are end-user-safe messages.
- `INVALID_CREDENTIALS` must be identical for wrong-password and unknown-email failures — callers must never reveal which case triggered the error.
- `EMAIL_IN_USE` is surfaced only by the registration flow, never by sign-in.
- `VALIDATION_ERROR` is a generic form-level header; field-specific messages come from the validation layer (Interface 4).

### Invariants
- The string value of `AUTH_ERRORS.INVALID_CREDENTIALS` is identical in all sign-in error paths (unit-tested in `src/auth.__tests__/credentials.test.ts`).

### NOT in contract
- Error classes or `Error` subclasses.
- HTTP status codes (those live in route handlers).

---

## Interface 4 — `src/lib/auth/validation.ts`

### Path
`src/lib/auth/validation.ts`

### Exports
```typescript
export interface ValidationSuccess {
  ok: true;
}

export interface ValidationFailure {
  ok: false;
  field: "name" | "email" | "password" | "form";
  message: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export function validateRegistrationInput(input: {
  name: string;
  email: string;
  password: string;
}): ValidationResult;

export function validateSignInInput(input: {
  email: string;
  password: string;
}): ValidationResult;

export function normalizeEmail(email: string): string;
```

### Semantics

#### `validateRegistrationInput(input)`
- Returns `{ ok: false, field: "name", message: "..." }` if `name` is empty or whitespace-only.
- Returns `{ ok: false, field: "email", message: "..." }` if `email` is not a valid email format (must contain `@` and a domain with a `.`).
- Returns `{ ok: false, field: "password", message: "..." }` if `password.length < 8`.
- Returns `{ ok: true }` when all fields pass.
- Validation is short-circuit: returns on the first failing field in name → email → password order.
- Does NOT call the repository or perform I/O.

#### `validateSignInInput(input)`
- Returns `{ ok: false, field: "email", message: "..." }` if `email` is not a valid email format.
- Returns `{ ok: false, field: "password", message: "..." }` if `password` is empty.
- Returns `{ ok: true }` when both fields pass.
- Does NOT call the repository or perform I/O.

#### `normalizeEmail(email)`
- Returns `email.trim().toLowerCase()`.
- Pure function; used by both the repository and the registration action before passing to `create`.

### Invariants
- Neither function throws; they always return a `ValidationResult`.
- `field: "password"` message must reference the 8-character minimum (e.g. `"Password must be at least 8 characters."`).
- `field: "name"` message must reference the name field (e.g. `"Name is required."`).
- `field: "email"` message must reference invalid format (e.g. `"Please enter a valid email address."`).

### NOT in contract
- Async variants.
- Password complexity checks beyond minimum length.
- HTML5 email spec full validation — a simple `@` + domain presence check is sufficient.

---

## Interface 5 — `src/auth.ts` (`authorize` callback)

### Path
`src/auth.ts`

### Exports
```typescript
import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // ... configuration
});
```

The `authorize` callback has this locked signature and behaviour:

```typescript
// Inside the Credentials provider configuration:
async authorize(credentials: Record<string, string> | undefined): Promise<{
  id: string;
  email: string;
  name: string;
} | null>
```

### Semantics

#### `authorize(credentials)`
- Accepts `credentials` with `{ email: string; password: string }`.
- Normalizes `credentials.email` with `normalizeEmail` before lookup.
- Calls `repository.findByEmail(normalizedEmail)`.
- If `findByEmail` returns `null` → returns `null` immediately (no exception).
- Calls `verifyPassword(credentials.password, user.passwordHash)`.
- If `verifyPassword` returns `false` → returns `null` immediately (no exception).
- On success: returns `{ id: user.id, email: user.email, name: user.name }`.
- **MUST NOT** include `passwordHash` in the returned object.
- **MUST NOT** throw — both failure branches return `null`.

#### Session / JWT callbacks
```typescript
// jwt callback — adds id to token
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
  }
  return token;
}

// session callback — exposes id on session.user
async session({ session, token }) {
  if (token?.id) {
    session.user.id = token.id as string;
  }
  return session;
}
```

#### Exported session user shape (locked — `passwordHash` excluded)
```typescript
// Available via auth() or useSession():
interface SessionUser {
  id: string;
  email: string;
  name: string;
  // passwordHash is NEVER present
}
```

### Invariants
- `passwordHash` must never appear in the JWT payload or the session object.
- The same `null` is returned for unknown email and wrong password — the caller cannot distinguish the two.
- `authorize` is a pure async function with no side effects beyond reads.

### Import rule
```typescript
import { auth, signIn, signOut, handlers } from "@/auth";
// NOT: import ... from "next-auth" directly in page/middleware code
```

### NOT in contract
- Social/OAuth providers.
- Session max-age exact value (coder's discretion; default NextAuth value is acceptable).
- The `pages` option shape (sign-in redirect URL; coder's discretion as long as it points to `/(auth)/sign-in`).

---

## Interface 6 — `src/app/(auth)/register/actions.ts`

### Path
`src/app/(auth)/register/actions.ts`

### Exports
```typescript
export interface RegisterActionState {
  ok: boolean;
  error?: string;       // user-safe message (from AUTH_ERRORS or validation)
  field?: string;       // field name if the error is field-specific
}

export async function registerAction(
  _prevState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState>;
```

### Semantics

#### `registerAction(_prevState, formData)`
- Extracts `name`, `email`, `password` from `formData`.
- Calls `validateRegistrationInput({ name, email, password })`.
  - On failure: returns `{ ok: false, error: result.message, field: result.field }` immediately. Does NOT call repository.
- Normalizes email with `normalizeEmail(email)`.
- Calls `repository.findByEmail(normalizedEmail)` — if a user exists, returns `{ ok: false, error: AUTH_ERRORS.EMAIL_IN_USE }`. Does NOT call `hashPassword`.
- Calls `hashPassword(password)`.
- Calls `repository.create({ name, email: normalizedEmail, passwordHash })`.
- On repository success: calls NextAuth `signIn("credentials", { email: normalizedEmail, password, redirect: false })` to auto-sign-in the new teacher.
- Returns `{ ok: true }` on complete success.
- Returns `{ ok: false, error: AUTH_ERRORS.VALIDATION_ERROR }` on unexpected errors (catches should NOT re-throw to the client).

### Invariants
- The function is a Next.js `"use server"` action (file must have `"use server"` directive at top).
- `passwordHash` is never returned to the client; only `ok`, `error`, and `field` are included in the state.
- Validation runs before any repository or password-hashing I/O.
- Duplicate-email check runs before `hashPassword` (avoid wasting bcrypt cycles).

### Import rules
```typescript
import { validateRegistrationInput, normalizeEmail } from "@/lib/auth/validation";
import { hashPassword } from "@/lib/auth/password";
import { AUTH_ERRORS } from "@/lib/auth/errors";
import { signIn } from "@/auth";
// Repository is injected or imported from a module-level singleton; see impl-context.md
```

### NOT in contract
- The exact redirect destination after successful registration (coder's call; typically `/dashboard`).
- UI or form rendering (that is in `page.tsx`).

---

## Interface 7 — `src/middleware.ts`

### Path
`src/middleware.ts`

### Required shape
```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth(function middleware(req: NextRequest) {
  // ... redirect unauthenticated requests to /sign-in
});

export const config = {
  matcher: [
    "/((?!api/health|api/auth|_next/static|_next/image|favicon.ico|register|sign-in).*)",
  ],
};
```

### Semantics

#### Protected routes
- Any request matching `config.matcher` with **no valid session** must be redirected to `/sign-in`.
- Use `NextResponse.redirect(new URL("/sign-in", req.url))`.

#### Authenticated pass-through
- Any request matching `config.matcher` with a **valid session** must call `NextResponse.next()` (pass through).

#### Explicitly public (MUST NOT redirect regardless of session)
| Path pattern | Reason |
|---|---|
| `/api/health` | Existing health check; must stay public (regression guard) |
| `/api/auth/**` | NextAuth's own sign-in/callback endpoints |
| `/sign-in` | Public auth page |
| `/register` | Public auth page |
| `/_next/static/**` | Static assets |
| `/_next/image/**` | Image optimisation |
| `/favicon.ico` | Browser asset |

### Invariants
- The middleware **never** blocks `/api/health` — existing `route.test.ts` must remain green.
- The `matcher` regex excludes all paths in the "Explicitly public" table above.
- Unauthenticated requests to `/dashboard` (and any other protected path) are redirected, not returned as 401/403.

### NOT in contract
- Role-based access control.
- API routes returning 401 JSON (middleware redirect is sufficient for MVP).
- Rate limiting.

---

## Interface 8 — `.env.example` additions (constraint lock)

### Path
`.env.example`

### Required additions
```dotenv
# NextAuth — copy to .env.local and replace with a real secret before running
NEXTAUTH_SECRET=change-me
NEXTAUTH_URL=http://localhost:3000
```

### Invariants
- `NEXTAUTH_SECRET` placeholder value is `change-me` (9 characters, no base64, no alphanumeric run ≥16 chars).
- The file must NOT match `/(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}/i` on any line — this is enforced by `src/__tests__/env-config.test.ts`.

### NOT in contract
- Comments wording.
- Ordering relative to existing entries.

---

## Acceptance criterion traceability

| Criterion | Interface(s) |
|---|---|
| AC1 — registration creates a new account | 1 (`create`), 6 (`registerAction`) |
| AC2 — duplicate email rejected with friendly message | 1 (`create` throws on duplicate), 3 (`EMAIL_IN_USE`), 6 (`registerAction` duplicate check) |
| AC3 — password stored as hash only | 2 (`hashPassword`), 6 (`registerAction` hashes before `create`) |
| AC4 — correct credentials sign in | 2 (`verifyPassword`), 5 (`authorize` success path), 4 (`validateSignInInput`) |
| AC5 — wrong credentials rejected with generic message | 3 (`INVALID_CREDENTIALS`), 5 (`authorize` returns `null` for both failure cases) |
| AC6 — signed-in user stays recognized | 5 (JWT/session callbacks, `id` in session) |
| AC7 — sign out → unauthenticated | 5 (`signOut` export from `src/auth.ts`) |
| AC8 — old session rejected after sign-out | 5 (NextAuth JWT strategy; not unit-tested — manual/e2e) |
| AC9 — unauthenticated requests to protected routes rejected | 7 (middleware redirect) |
| AC10 — friendly error messages | 3 (`AUTH_ERRORS` values), 4 (`ValidationResult` messages) |
| AC11 — missing/malformed fields rejected | 4 (`validateRegistrationInput`, `validateSignInInput`) |
| env-config regression | 8 (`.env.example` placeholder ≤15 chars) |
