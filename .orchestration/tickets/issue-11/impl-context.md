# Implementation context (shared A/B brief)

## Files this touches

### New files to create
- `prisma/schema.prisma` — Prisma schema: SQLite datasource, client generator, `ResourceStatus` enum, `User`, `Resource`, `Like`, `Download` models with indexes
- `src/lib/db.ts` — PrismaClient singleton (globalThis hot-reload guard); exports `db`
- `src/app/api/resources/[id]/download/route.ts` — POST handler: validates PUBLISHED, inserts Download row, revalidates path
- `src/app/api/resources/[id]/download/__tests__/route.test.ts` — unit tests for download endpoint (5 behaviors)
- `src/components/ResourceCard.tsx` — presentational card: title + downloadCount
- `src/components/StatsHeaderCard.tsx` — presentational header: totalLikes + totalDownloads
- `src/components/__tests__/ResourceCard.test.tsx` — jsdom render tests (behaviors 6–7)
- `src/components/__tests__/StatsHeaderCard.test.tsx` — jsdom render tests (behaviors 8–10)
- `src/app/resources/[id]/page.tsx` — Server Component: fetches resource with _count, renders ResourceCard, 404 on missing/unpublished
- `src/app/resources/[id]/__tests__/page.test.ts` — integration test F4 (resource detail data layer)
- `src/app/teachers/[teacherId]/page.tsx` — Server Component: fetchTeacherProfileData helper + default export page
- `src/app/teachers/[teacherId]/__tests__/page.test.ts` — integration tests F1–F3 (profile aggregates)

### Existing files to modify
- `package.json` — add `@prisma/client` (dep), `prisma` (devDep), `@testing-library/react` + `@testing-library/jest-dom` (devDep for jsdom tests), `db:generate` / `db:push` scripts
- `next.config.ts` — add `experimental.serverComponentsExternalPackages: ['@prisma/client', '.prisma/client']` (or equivalent `outputFileTracingIncludes`)
- `.env.example` — update `DATABASE_URL` to `file:./dev.db` (was PostgreSQL stub)
- `.gitignore` — add `dev.db`, `dev.db-journal`, `dev.db-wal`
- `src/app/page.tsx` — add nav links to `/teachers/[id]` and `/resources/[id]` stub routes
- `README.md` — document Prisma setup steps

---

## Patterns to follow

- **Naming:** Match the health route style — named exports for route handlers (`export async function POST`), default exports for page Server Components. Export component name matches file name (`ResourceCard`, `StatsHeaderCard`). Singleton is `export const db`.
- **Error handling:** Route handlers use try/catch; return `NextResponse.json({ error: '...' }, { status: NNN })`. Server Components call `notFound()` from `next/navigation` for 404; let other errors propagate to Next.js error boundary. Never swallow errors silently.
- **Async style:** All route handlers and Server Components are `async` functions returning `Promise<Response>` or `Promise<JSX.Element>`. No `use client` directive on route handlers or data-fetching Server Components.
- **Testing style:** Mirror `src/app/api/health/__tests__/route.test.ts` — import the function directly, call it with `new Request(...)`, assert on `response.status` and `await response.json()`. No test server, no fetch mock. For jsdom component tests, add `// @vitest-environment jsdom` pragma at top of file (global config is `environment: "node"`). Use `vi.mock('@/lib/db')` for all DB-touching tests; mock `next/cache` for revalidatePath.
- **Import paths:** Always use `@/` alias (tsconfig paths) — never relative imports for cross-module references. `import { db } from '@/lib/db'`, `import { ResourceCard } from '@/components/ResourceCard'`.
- **Component style:** Server Components by default (no `'use client'`); add `'use client'` only if interactive state is needed. `ResourceCard` and `StatsHeaderCard` can be server-side presentational for MVP.

---

## Utilities to reuse

- `NextResponse.json(body, { status })` from `next/server` — used in health route; use same pattern in download route
- `revalidatePath(path)` from `next/cache` — call after successful download to invalidate teacher profile cache
- `notFound()` from `next/navigation` — call in Server Components for 404 cases
- `vi.mock`, `vi.fn()`, `vi.mocked()` from `vitest` — mock pattern established in existing tests

---

## Anti-patterns in this codebase

- **No `downloadCount` column on `Resource`** — resolved conflict: use `_count.downloads` (Prisma relation count) for per-resource display and `db.download.count(...)` for aggregates. Never add a denormalized counter column.
- **No `src/lib/prisma.ts`** — the singleton lives at `src/lib/db.ts` and exports `db`. Do not create a second singleton file.
- **No `use client` on data-fetching components** — Server Components fetch data directly via `db`; do not wrap pages in client components.
- **No pager/interactive output in CI** — `PRISMA_CLI_QUERY_ENGINE_TYPE=binary` may be needed in CI; add to `.env.example` comments if required.
- **No test-time DB connection** — all DB calls in tests must be mocked via `vi.mock('@/lib/db')`. Never connect to a real DB in unit/integration tests.

---

## Repo commands (verified)

- **Test:** `npx vitest run`
- **Fast subset:** `npx vitest run src/app/api/resources src/app/teachers src/components`
- **Lint:** `npm run lint` (runs `next lint`)
- **Type check:** `npx tsc --noEmit`
- **Build:** `npm run build` _(requires `npx prisma generate` first — see warning below)_
- **DB generate:** `npm run db:generate` → `prisma generate` _(add this script to package.json)_
- **DB push:** `npm run db:push` → `prisma db push` _(add this script to package.json)_

> ⚠️ **CI warning:** `prisma generate` must run before `npm run build` or `npx tsc --noEmit`. The existing `src/__tests__/scripts.test.ts` runs `npm run build`; CI must insert `npx prisma generate` before the test step.
