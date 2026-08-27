# Implementation context (shared A/B brief)

> This brief is for both the **coder** and the **tester**. Read it before touching any
> file. It captures codebase conventions, utilities to reuse, and commands that are
> verified to work.

---

## Files this touches

- `src/lib/taxonomy.ts` *(new)* — `SUBJECTS` and `YEAR_LEVELS` `as const` arrays, plus exported types (`Subject`, `YearLevel`, `SubjectId`, `YearLevelId`, `Taxonomy`)
- `src/lib/taxonomy-service.ts` *(new)* — `getTaxonomy()`, `validateSubjectIds()`, `validateYearLevelIds()`, and exported `TaxonomyValidationError` class
- `src/app/api/taxonomy/route.ts` *(new)* — thin `GET` handler returning `{ subjects, yearLevels }` via `NextResponse.json`
- `src/lib/__tests__/taxonomy.test.ts` *(new)* — unit tests for constants (tests 1–7 from test-plan)
- `src/lib/__tests__/taxonomy-service.test.ts` *(new)* — unit tests for service functions (tests 8–20 from test-plan)
- `src/app/api/taxonomy/__tests__/route.test.ts` *(new)* — integration tests for the GET handler (tests 21–25 from test-plan)
- `README.md` *(modify)* — add `GET /api/taxonomy` entry to the API section alongside the existing health endpoint

### Reference / pattern files (read, do not modify)
- `src/lib/health.ts` — canonical example of a constants+types lib module
- `src/app/api/health/route.ts` — canonical example of a thin App Router `GET` handler
- `src/app/api/health/__tests__/route.test.ts` — canonical example of a route test using `new Request(...)`

---

## Patterns to follow

- **Naming:** `camelCase` for functions and variables; `PascalCase` for TypeScript classes, interfaces, and type aliases; `SCREAMING_SNAKE_CASE` for module-level `as const` arrays (e.g. `SUBJECTS`, `YEAR_LEVELS`); `kebab-case` for file and directory names.
- **Error handling:** Route handlers return `NextResponse.json(...)` with an appropriate status — never throw through to the framework. Service-layer validators throw a typed `TaxonomyValidationError`; callers (e.g. `#4`'s resource handler) must `catch` and convert to a 422 response.
- **Async style:** `async/await` throughout. All App Router handlers are `async function`. Service functions in this ticket are **synchronous** (no DB) — do not wrap them in `async`.
- **Testing style:** Vitest with Jest-compatible API (`describe`, `it`, `expect`). Arrange / Act / Assert inside each `it`. No shared mutable state across tests. Import constants directly from `@/lib/taxonomy` rather than hard-coding literal ID strings in tests — derive test inputs from the exported arrays so a slug change doesn't silently break assertions.

---

## Utilities to reuse

- `src/lib/health.ts` — shows the exact module shape for a constants+types lib file; follow the same `export const … as const` + `export type …` pattern for `taxonomy.ts`.
- `src/app/api/health/route.ts` — shows the exact route handler shape; copy the `NextResponse` import and `async function GET(_request: Request): Promise<Response>` signature.
- `src/app/api/health/__tests__/route.test.ts` — shows how to unit-test a Next.js App Router handler by calling it directly with `new Request("http://localhost/api/...")` without spinning up a server.

---

## Anti-patterns in this codebase

- **No relative cross-directory imports in tests.** Always use `@/` path alias (e.g. `import { SUBJECTS } from "@/lib/taxonomy"`, never `"../../lib/taxonomy"`).
- **No database packages.** `package.json` has zero DB dependencies. Do not add `pg`, `prisma`, `drizzle-orm`, or any ORM. The taxonomy constants are in-memory for this ticket.
- **No hard-coded ID literals in tests.** Do not write `validateSubjectIds(["mathematics"])` — derive the value from `SUBJECTS[0].id` so tests survive a slug rename.
- **No extra exported handlers.** The taxonomy route must not export `POST`, `PUT`, `PATCH`, or `DELETE` — those methods must remain 405 by Next.js default.
- **No widened return type.** `getTaxonomy()` returns `Taxonomy` (which carries `typeof SUBJECTS` / `typeof YEAR_LEVELS`), not `{ subjects: Subject[]; yearLevels: YearLevel[] }`. The narrower type preserves const inference for downstream callers.

---

## Repo commands (verified)

- **Test:** `npm test` (`vitest run`) — or fast subset: `npx vitest run src/lib/__tests__/taxonomy.test.ts src/lib/__tests__/taxonomy-service.test.ts src/app/api/taxonomy/__tests__/route.test.ts`
- **Lint:** `npm run lint` (`next lint`)
- **Type check:** `npx tsc --noEmit`
- **Build:** `npm run build`
