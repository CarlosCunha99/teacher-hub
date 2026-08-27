# Implementation plan

## Goal
A Prisma-backed MVP exists for resource likes/downloads, with per-resource counts and public teacher-profile aggregates rendered from published resources.

## Approach
Start by adding Prisma and a local SQLite development database so the app has a durable schema and generated client without waiting on later infrastructure work. Keep the integration small and conventional: environment variable wiring, Prisma client generation scripts, a checked-in schema, and the standard Next.js Prisma singleton.

For the data model, keep ownership and publication state explicit with `User` and `Resource`, and model engagement separately with `Like` and `Download` so profile totals can be computed with Prisma aggregates at read time. That avoids maintaining a teacher-level summary while still letting the download mutation update the resource's own displayed counter atomically for MVP UX.

On the app side, add the missing surfaces in thin server-rendered slices: a download route that validates `published` resources before recording usage, a resource detail page, a teacher profile page that aggregates only published resources, and a minimal `ResourceCard` used by the stub pages. Finish by wiring the home page, Next.js Prisma config, and setup docs so the feature is runnable locally.

## Steps
1. **Add Prisma tooling** — Install `prisma` and `@prisma/client`, add `DATABASE_URL` to `.env.example`, add `dev.db*` to `.gitignore`, and add `db:generate` / `db:push` scripts in `package.json` so local setup can generate and sync the client. Depends on: none.
2. **Define the initial schema** — Create `prisma/schema.prisma` with a SQLite datasource, Prisma client generator, `ResourceStatus` enum (`DRAFT`, `PUBLISHED`), and models for `User`, `Resource`, `Like`, and `Download`. Include `Resource.downloadCount` for atomic per-resource updates, plus relations/indexes needed for author lookups and aggregate profile queries. Depends on: step 1.
3. **Sync and generate Prisma artifacts** — Run `prisma db push` for local development and `prisma generate` so the repository has a working generated client baseline for the new imports. Depends on: step 2.
4. **Add shared database access** — Create `src/lib/prisma.ts` with the standard Next.js Prisma singleton pattern so route handlers and server components reuse one `PrismaClient` in development. Depends on: step 3.
5. **Implement the download mutation** — Create `src/app/api/resources/[id]/download/route.ts` as a `POST` handler that loads the resource by id, rejects missing or non-`PUBLISHED` resources, atomically increments `Resource.downloadCount`, optionally records a `Download` row for auditability, calls `revalidatePath` for the resource and teacher profile paths, and returns HTTP 200 with the download target payload/stub. Depends on: step 4.
6. **Add a minimal resource surface** — Create `src/components/ResourceCard.tsx` to render a resource title plus likes/downloads counts in a reusable stub UI used by the new pages. Depends on: step 4.
7. **Create the resource detail page** — Add `src/app/resources/[id]/page.tsx` as a Server Component that fetches one resource with its engagement counts, guards unpublished/missing resources, and renders the `ResourceCard` plus any minimal download action stub. Depends on: steps 5, 6.
8. **Create the teacher profile aggregates** — Add `src/app/teachers/[teacherId]/page.tsx` as a Server Component that runs aggregate queries over only the teacher's `PUBLISHED` resources to compute total likes and total downloads, then renders a stats header and a minimal list of that teacher's resources. Depends on: steps 4, 6.
9. **Wire discovery from the home page** — Update `src/app/page.tsx` to link to example teacher-profile and resource-detail routes so the new MVP surfaces are reachable in the skeleton app. Depends on: steps 7, 8.
10. **Make Next.js Prisma-safe** — Update `next.config.ts` with the Prisma-compatible server bundling setting (`experimental.serverComponentsExternalPackages` or equivalent tracing include) needed for App Router deployments. Depends on: step 4.
11. **Document local database setup** — Update `README.md` with Prisma install/setup instructions, including copying `.env.example`, running `npm install`, `npm run db:generate`, and `npm run db:push`, plus a short note on the local SQLite database. Depends on: steps 1, 3.

## Files
### Create
- `prisma/schema.prisma` — initial Prisma schema for users, resources, and engagement data.
- `src/lib/prisma.ts` — shared Prisma client singleton for server-side code.
- `src/app/api/resources/[id]/download/route.ts` — published-resource download mutation and cache revalidation.
- `src/components/ResourceCard.tsx` — minimal reusable resource stats card.
- `src/app/resources/[id]/page.tsx` — resource detail route showing per-resource engagement.
- `src/app/teachers/[teacherId]/page.tsx` — teacher profile route with aggregate likes/downloads.

### Modify
- `.gitignore` — ignore local SQLite database files.
- `.env.example` — document `DATABASE_URL` for Prisma local development.
- `package.json` — add Prisma dependencies and database scripts.
- `next.config.ts` — include Prisma-compatible server bundling config.
- `src/app/page.tsx` — link to the new teacher/resource stub routes.
- `README.md` — document database setup and local run steps.

### Delete
- None.

## Data / schema / migration
Add the first Prisma schema backed by SQLite for development. Use `prisma db push` for MVP setup; no production migration or backfill is needed because there is no existing persisted app data.

## Rollout
- Feature flag? no
- Backfill? no
- Ordering: land schema/tooling first, then route/page code; local `db:generate` and `db:push` must run before build or app execution.

## Assumptions and non-decisions
- Profile totals are public and include only `PUBLISHED` resources, matching the ticket/solution assumptions.
- The MVP download route may return a stub payload or redirect target until upload/storage work lands; this ticket focuses on count tracking and surface rendering.
- Keep exact UI styling minimal; the coder can choose simple markup as long as the counts are visible.
- If `Download` rows are recorded, they are for future extensibility; the resource's displayed download count remains driven by `Resource.downloadCount` for simple atomic updates.

## Not doing
- No authentication/authorization system.
- No full upload/storage pipeline or binary file-serving implementation beyond a minimal stubbed download path.
- No like/unlike interaction UI, admin analytics screens, or broader teacher-profile shell work.
