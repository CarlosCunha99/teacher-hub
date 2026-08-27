# Implementation context (shared A/B brief)

## Files this touches

- `src/lib/teachers.ts` *(create)* — DAL: exported `Teacher`, `Resource`, `Board` interfaces and three async query functions; imports from `teachers-data.ts`.
- `src/lib/teachers-data.ts` *(create)* — in-memory fixture data store; the seam replaced by a real DB client when #3 lands. Not exported beyond `teachers.ts`.
- `src/app/teachers/[username]/page.tsx` *(create)* — async Server Component; awaits `params`, calls DAL, calls `notFound()` or renders profile.
- `src/app/teachers/[username]/not-found.tsx` *(create)* — not-found UI rendered by Next.js when `notFound()` is called in the page.
- `src/app/teachers/[username]/__tests__/page.test.tsx` *(create)* — Vitest functional tests for the page component.
- `src/lib/__tests__/teachers.test.ts` *(create)* — Vitest unit tests for DAL query functions.
- `README.md` *(modify)* — add `src/app/teachers/` row to folder-structure table.
- `.env.example` *(modify)* — add `DATABASE_URL` stub if not already present.

---

## Patterns to follow

- **Naming:**
  - Functions: `camelCase` (`getTeacherByUsername`, `getPublishedResourcesByTeacher`).
  - Types/interfaces: `PascalCase` (`Teacher`, `Resource`, `Board`).
  - Files: `kebab-case` (`teachers.ts`, `teachers-data.ts`).
  - Test files: `<subject>.test.ts` / `<subject>.test.tsx` inside a colocated `__tests__/` directory (see `src/app/api/health/__tests__/route.test.ts`).
  - Page component function: `PascalCase` matching route semantics (e.g. `TeacherProfilePage`); default export.
  - Path alias: use `@/*` for all cross-directory imports (e.g. `import { getTeacherByUsername } from "@/lib/teachers"`).

- **Type exports:** Export types as named exports from the module that owns them (`export interface Teacher { … }`). Use `import type` at call sites when only the type is needed.

- **Constants:** Use `as const` for literal-type constants (see `health.ts`).

- **Module structure:** `src/lib/` files use named exports only — no default export from lib modules (see `health.ts`). Pages use a default export for the component function.

---

## Error handling style

- **Return `null`, not throw,** for "not found" cases in async DAL functions (see `getTeacherByUsername` → `Promise<Teacher | null>`).
- **Return `[]`, not throw,** for "no results" cases (see `getPublishedResourcesByTeacher`, `getShareableBoardsByTeacher`).
- **Let data-source I/O errors propagate** — do not swallow unexpected exceptions; the page or framework handles them.
- **Call `notFound()` from `next/navigation`** in the Server Component for unknown usernames — do not throw manually.
- Do **not** use `try/catch` around DAL calls in the page unless the plan explicitly requires fallback UI for data-source errors (it does not for this ticket).

---

## Async style

- All DAL functions are `async function` returning a `Promise<T>` — use `async/await`, not `.then()` chains.
- The page component is an `async function` — `await` each DAL call at the top of the function body.
- In Next.js 15, `params` in a Server Component is a `Promise` — always `await props.params` before accessing `username`.

---

## Testing style

- Framework: **Vitest** (`npm test` runs `vitest run`).
- Style: `describe` / `it` blocks; **Arrange → Act → Assert** within each `it`.
- Mocking: `vi.mock(modulePath, factory)` at the module level; `vi.mocked(fn)` for typed mock access; restore with `vi.restoreAllMocks()` in `afterEach`.
- **DAL unit tests** (`src/lib/__tests__/teachers.test.ts`): mock `@/lib/teachers-data` (or exercise the real in-memory store directly — either is valid); assert return shapes and filtering invariants.
- **Page functional tests** (`src/app/teachers/[username]/__tests__/page.test.tsx`): mock `@/lib/teachers` module entirely with `vi.mock`; mock `next/navigation` → `{ notFound: vi.fn() }`; call the async component function directly and render with React Testing Library if DOM assertions are needed.
- Existing tests use plain `describe`/`it` with no `test` alias — stay consistent.

---

## Utilities to reuse

- `next/navigation::notFound` — call in the page when teacher is `null`; import as `import { notFound } from "next/navigation"`.
- `next/navigation::notFound` mock pattern in tests: `vi.mock("next/navigation", () => ({ notFound: vi.fn() }))`.
- No shared UI utilities exist yet; the page is a from-scratch component.

---

## Anti-patterns in this codebase

- **Do not use `any`** — TypeScript is in `strict` mode; all types must be explicit.
- **Do not use CommonJS** (`require`, `module.exports`) — ESM only (`import`/`export`).
- **Do not add `console.log`** to production code (lib or page files); it is acceptable in test output helpers only.
- **Do not co-locate type definitions in page files** — types (`Teacher`, `Resource`, `Board`) belong in `src/lib/teachers.ts` so they are re-usable by #13 and others.
- **Do not call `notFound()` and then continue rendering** — `notFound()` is a control-flow exit; return immediately or ensure no markup follows.
- **Do not create an HTTP API route** (`src/app/api/teachers/`) — data is fetched directly in the Server Component; no REST endpoint is introduced by this ticket.
- **Do not mock `@/lib/db`** in DAL tests for this ticket — there is no `@/lib/db` module yet; mock `@/lib/teachers-data` instead.

---

## Repo commands (verified)

- **Test:** `npm test` (alias for `vitest run`; exits 0 on all pass)
- **Fast subset:** `npx vitest run src/lib/__tests__/teachers.test.ts src/app/teachers`
- **Lint:** `npm run lint` (runs `next lint`; verified by `src/__tests__/scripts.test.ts`)
- **Format check:** `npm run format:check` (runs `prettier --check .`)
- **Type check:** `npx tsc --noEmit` (verified by `src/__tests__/typescript.test.ts`)
- **Build:** `npm run build` (runs `next build`; verified by `src/__tests__/scripts.test.ts`)
