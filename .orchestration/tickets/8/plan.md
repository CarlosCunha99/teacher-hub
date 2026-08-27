# Implementation plan

## Goal
A public, server-rendered teacher profile page at `/teachers/[username]` that shows a teacher's name, bio, joined date, published resources, and shareable boards with accurate counts, and returns a proper 404 for unknown usernames.

## Approach
Per `solution.md`, this is a Next.js App Router **Server Component** at `src/app/teachers/[username]/page.tsx`. It fetches everything server-side on request: the teacher record (by username), their published resources, and their shareable boards. All visibility filtering (published-only resources, shareable-only boards) lives in the data-access layer so the page stays a thin presentational shell. Unknown usernames call `notFound()`.

The repo is currently a bare skeleton — there is no DB client, and #3/#4/#7 have not landed (see Warnings in `impact.md`). To keep this ticket independently implementable, testable, and buildable **today**, the data-access layer (`src/lib/teachers.ts`) is defined as a set of typed async functions with a stable public contract (`getTeacherByUsername`, `getPublishedResourcesByTeacher`, `getShareableBoardsByTeacher`) backed by a small, swappable in-memory data source (`src/lib/teachers-data.ts`). When #3's schema and DB client land, only the internal data source is replaced — the exported function signatures, the page, and the tests remain unchanged. This isolates the hard cross-ticket dependency behind one file.

Types (`Teacher`, `Resource`, `Board`) are exported from `src/lib/teachers.ts` so #13 (profile metrics) can extend them later. The page renders identity, a resources section, a boards section, count badges, and empty states for zero resources/boards.

Profile **editing** is explicitly deferred to the account-settings surface owned by #2 (see `solution.md`); this ticket delivers only the public read view.

## Steps
1. **Define DAL types and query contract** — Create `src/lib/teachers.ts` exporting interfaces `Teacher` (`id`, `username`, `name`, `bio`, `joinedAt`), `Resource` (`id`, `teacherId`, `title`, `status`), `Board` (`id`, `teacherId`, `name`, `shareable`), plus three async functions: `getTeacherByUsername(username)`, `getPublishedResourcesByTeacher(teacherId)`, `getShareableBoardsByTeacher(teacherId)`. Filtering (published-only, shareable-only) happens here. Depends on: none.
2. **Add swappable in-memory data source** — Create `src/lib/teachers-data.ts` holding fixture teachers/resources/boards and lookup helpers the DAL calls. Documented as the seam replaced by #3's real DB client. `src/lib/teachers.ts` imports from it. Depends on: step 1.
3. **Build the Server Component page** — Create `src/app/teachers/[username]/page.tsx` as an async Server Component. Read `params.username`, call `getTeacherByUsername`; if null, call `notFound()` from `next/navigation`. Otherwise fetch resources + boards, render identity (name, bio, joined date), resource list + count, board list + count, and empty states. Depends on: steps 1–2.
4. **Add not-found UI** — Create `src/app/teachers/[username]/not-found.tsx` rendering a clear "teacher not found" message so `notFound()` yields a proper not-found experience, not a blank shell. Depends on: step 3.
5. **Update README folder structure** — Modify `README.md`: add a `src/app/teachers/` row to the folder-structure table; note the route requires `DATABASE_URL` once the real DAL lands. Keep `src/app` text intact so `readme.test.ts` still matches. Depends on: step 3.
6. **Update env template** — Modify `.env.example`: uncomment/add a `DATABASE_URL` stub with a comment that the profile route is the first DB-backed page (only if not already added by #3). Depends on: none.

## Files
### Create
- `src/lib/teachers.ts` — DAL: exported `Teacher`/`Resource`/`Board` types and three visibility-filtered query functions.
- `src/lib/teachers-data.ts` — swappable in-memory data source (fixture seam replaced by #3's DB client).
- `src/app/teachers/[username]/page.tsx` — public profile Server Component; renders identity, resources, boards, counts, empty states; calls `notFound()`.
- `src/app/teachers/[username]/not-found.tsx` — not-found UI for unknown usernames.

### Modify
- `README.md` — add `src/app/teachers/` row to folder-structure table; note DB requirement.
- `.env.example` — add `DATABASE_URL` stub (skip if #3 already added it).

### Delete
- None.

## Data / schema / migration
None introduced by this ticket. It **consumes** schema owned by #3/#4/#7: `users` (`username`, `name`, `bio`, `joined_at`), `resources` (owner + published `status`), `boards` (owner + `shareable` boolean). Until those land, the in-memory data source (step 2) stands in behind the DAL contract; swapping to the real DB is a one-file change with no page/test churn. Note for coordination: `bio` on users and `shareable` on boards are not yet guaranteed by #3/#7 ACs (see `impact.md` Warnings).

## Rollout
- Feature flag? No — the route is either deployed or not.
- Backfill? No.
- Ordering: No deploy-ordering constraint for the read view. Real-data correctness depends on #3/#4/#7 landing; until then the page serves fixture data behind the DAL seam.

## Assumptions and non-decisions
- Usernames are unique, case-insensitive-lookup-friendly handles on the `users` table (assumed from #3's "profile lookup" index).
- `joinedAt` is system-managed/read-only; only `name`/`bio` are user-editable (editing itself is out of scope here).
- The DAL functions return already-filtered lists, so the page's displayed count == `array.length` for both resources and boards, satisfying the "counts match displayed items" AC automatically.
- The in-memory data source is a deliberate temporary seam; the coder may reshape its internals freely as long as the exported `teachers.ts` contract is preserved.
- Presentation (markup, minimal styling) is left to the coder's judgment; no design system exists yet.

## Not doing
- Profile editing / account settings UI (owned by #2).
- Any HTTP API route under `src/app/api/teachers/` — data is fetched directly in the Server Component.
- Aggregate metrics (likes, downloads) on the profile (owned by #13).
- Auth/session handling, private/deactivated-account states, avatars, vanity slugs, SEO — out of scope per ticket.
- Installing a real Postgres client or writing migrations (owned by #3).
