# Impact analysis

## Direct changes

### Existing files modified
- `package.json` — add `@prisma/client` to `dependencies`; add `prisma` to `devDependencies`; add `"db:generate"`, `"db:migrate"`, `"db:seed"` npm scripts
- `next.config.ts` — add `transpilePackages: ['@prisma/client']` (required for Prisma native binary in Next.js App Router) and/or `outputFileTracingIncludes` for production edge tracing
- `.env.example` — update `DATABASE_URL` comment/stub from PostgreSQL placeholder to SQLite format (`DATABASE_URL="file:./dev.db"`)

### New files created
- `prisma/schema.prisma` — Prisma schema: `datasource` (SQLite), `generator` (client), four models: `User`, `Resource` (with `Status` enum: `DRAFT`/`PUBLISHED`), `Like`, `Download`; indexes on `Resource.authorId`, `Like.resourceId`, `Download.resourceId`
- `prisma/seed.ts` — dev seed script populating sample users, resources, likes, downloads
- `src/lib/db.ts` — PrismaClient singleton (prevents connection exhaustion during Next.js hot-reload)
- `src/app/api/resources/[id]/download/route.ts` — `POST` handler: validates resource is published, atomically increments download counter via `prisma.download.create` / `prisma.resource.update({ data: { downloads: { increment: 1 } } })`, calls `revalidatePath('/teachers/{authorId}')`, returns redirect or file URL
- `src/app/teachers/[teacherId]/page.tsx` — Next.js Server Component; two Prisma aggregate queries for `totalLikes` and `totalDownloads` across teacher's `PUBLISHED` resources; renders `StatsHeaderCard`; handles zero-resource empty state
- `src/app/resources/[id]/page.tsx` — Next.js Server Component; fetches resource by `id` with `_count`; renders `ResourceCard`; returns 404 for non-published/missing resources
- `src/components/ResourceCard.tsx` — Client/Server component displaying resource title, description, and `downloadCount`; stub surface for issue #8 extension
- `src/components/StatsHeaderCard.tsx` — Server/presentation component displaying `"X likes · Y downloads"` aggregate header; handles zero state
- `src/app/api/resources/[id]/download/__tests__/route.test.ts` — unit/integration tests for the download endpoint (published resource → 200 + counter increment; unpublished → 404 + no increment; missing → 404; concurrent safety)
- `src/app/teachers/[teacherId]/__tests__/page.test.ts` — tests for profile page aggregate queries (published-only filter, zero-resource state, DRAFT exclusion)
- `src/components/__tests__/ResourceCard.test.tsx` — render tests for `ResourceCard`
- `src/components/__tests__/StatsHeaderCard.test.tsx` — render tests for `StatsHeaderCard` including zero state

---

## Indirect: callers & consumers

- `src/app/api/health/route.ts` — no DB dependency; unchanged — impact: **none**
- `src/app/page.tsx` — homepage stub; no direct dependency on new data layer — impact: **none** (optionally may add links to teacher profiles, but not required)
- `src/app/layout.tsx` — root layout; no dependency on new routes or data — impact: **none**
- `src/__tests__/scripts.test.ts` → calls `npm run build` — **behavior-change**: build will fail if `prisma generate` has not been run first; CI must add a `prisma generate` step before `npm run build`
- `src/__tests__/env-config.test.ts` → reads `.env.example` — impact: **none** (existing assertions are format-only; the updated DATABASE_URL line passes all three checks)
- `src/__tests__/readme.test.ts` → reads `README.md` — impact: **none** if README is updated to document DB setup; **behavior-change** if the `npm install` / `npm run dev` section implies a working app without mentioning `prisma migrate dev`

---

## Public API surface

- Exported: `POST /api/resources/[id]/download` (new route handler) — **new addition**
- Exported: `GET /teachers/[teacherId]` (new Next.js page route) — **new addition**
- Exported: `GET /resources/[id]` (new Next.js page route) — **new addition**
- Exported: `ResourceCard` component in `src/components/ResourceCard.tsx` — **new addition**
- Exported: `StatsHeaderCard` component in `src/components/StatsHeaderCard.tsx` — **new addition**
- Exported: `db` (PrismaClient singleton) in `src/lib/db.ts` — **new addition**

### Breaking
None. All changes are purely additive. No existing exports are modified or removed.

---

## Tests affected

- `src/__tests__/scripts.test.ts` — the `npm run build` test will fail unless `prisma generate` is run first in CI; the test itself doesn't need code changes but the CI environment / pre-test setup does
- `src/app/api/resources/[id]/download/__tests__/route.test.ts` — **new file** to be created
- `src/app/teachers/[teacherId]/__tests__/page.test.ts` — **new file** to be created
- `src/components/__tests__/ResourceCard.test.tsx` — **new file** to be created
- `src/components/__tests__/StatsHeaderCard.test.tsx` — **new file** to be created
- `src/app/api/health/__tests__/route.test.ts` — no change needed; health route remains DB-free

---

## Docs to update

- `README.md` — **Getting started** section: add `npx prisma migrate dev` and `npx prisma db seed` steps between `npm install` and `npm run dev`; add entry to **Folder structure** table for `prisma/` directory
- `README.md` — **Environment configuration** section: update note about `DATABASE_URL` to reflect SQLite usage in dev (was deferred to issue #3)
- `.env.example` — inline comment update: change PostgreSQL placeholder to SQLite `file:./dev.db` with note that Postgres URL format applies in production (issue #3)

---

## Migrations / config / infra

- `prisma/schema.prisma` — initial Prisma migration file(s) generated by `prisma migrate dev`; creates `dev.db` (SQLite) locally; `prisma/migrations/` directory will appear in repo
- `prisma/migrations/` — migration history folder; should be committed to version control
- `dev.db` / `dev.db-journal` — SQLite database files; must be added to `.gitignore`
- `DATABASE_URL` env var — new required variable for all environments running the app; dev default: `file:./dev.db`; must be present for build (Prisma client generation reads schema, not DB, at build time — but `prisma migrate dev` requires a live DB)
- `next.config.ts` — `transpilePackages` or `outputFileTracingIncludes` config change ensures Prisma native binary is bundled correctly for Next.js production builds and Vercel deployments

---

## External systems

- **SQLite file (local)** — new: `dev.db` created on first `prisma migrate dev`; not present in CI unless migration step is added
- **PostgreSQL (future)** — schema is written to be promotable; switching `datasource` provider from `sqlite` to `postgresql` and updating `DATABASE_URL` is the only required change when issue #3 provisions Postgres

---

## Estimated diff size

- **Files touched:** 16 (3 modified + 13 new)
- **Rough lines changed:** ~540 (≈480 new lines across new files + ≈60 modified lines in existing files)
- **Confidence:** medium (exact line counts depend on component complexity and test depth; component stubs may be smaller, tests may be larger)
- **Downstream churn.** Issues #7 (likes UI), #8 (profile page shell), and #4 (file upload) will all build directly on top of the models, components, and pages introduced here. Any schema change in those issues (e.g. renaming `Resource.status` or adding columns) will require a new Prisma migration and may require changes to the aggregate queries in `teachers/[teacherId]/page.tsx` and the download route.

---

## Warnings

- **`prisma generate` must run before `npm run build`** — the existing `scripts.test.ts` test executes `npm run build`. Without `@prisma/client` being generated, the TypeScript compiler will fail on imports of `PrismaClient`. CI pipelines need an explicit `npx prisma generate` step inserted before the build/test step.
- **`dev.db` must be added to `.gitignore`** — SQLite database files (`dev.db`, `dev.db-journal`, `dev.db-wal`) must never be committed; the current `.gitignore` has not been verified to cover these patterns.
- **Prisma native binary in Next.js production build** — Prisma's query engine is a native binary that Next.js does not automatically include in output file tracing. Without `outputFileTracingIncludes` or `transpilePackages` in `next.config.ts`, production deployments (e.g. Vercel) will fail at runtime with "PrismaClientInitializationError".
- **SQLite single-writer limit** — Prisma's `update { increment }` is atomic per SQLite's single-writer model. This is safe for MVP but must be revisited when migrating to Postgres under concurrent load (consider `SELECT FOR UPDATE` or Postgres advisory locks for high-concurrency download tracking).
- **`revalidatePath` requires Next.js 13.4+ Route Handler context** — calling `revalidatePath` inside the `POST /api/resources/[id]/download` route handler is valid in Next.js 15 App Router, but it only invalidates the server-side fetch cache; it does NOT force a client-side navigation. Users already on the profile page will not see updated counts until they navigate away and back.
- **File storage is a stub** — the download endpoint for MVP returns a redirect to a URL stored on the resource record (or a stub response). No actual file bytes are served until issue #4 (PDF upload/storage) is implemented. The download counter will increment but there is no file to deliver, so the download AC ("receives the file") is only partially satisfied until #4 lands.
- **`.env.example` DATABASE_URL comment is currently PostgreSQL-flavoured** — the existing comment says `# Database connection (added in issue #3 — PostgreSQL schema)` with a PostgreSQL URL. This ticket changes the underlying database to SQLite for dev; the comment and stub value must be updated to avoid developer confusion.
