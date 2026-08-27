# Impact analysis

## Direct changes

- `src/app/teachers/[username]/page.tsx` *(new)* — App Router Server Component for the public teacher profile page. Fetches teacher identity, published resources, and shareable boards server-side; calls `notFound()` for unknown usernames.
- `src/lib/teachers.ts` *(new, or `src/lib/db/teachers.ts` depending on DAL convention chosen in #3)* — data-access functions: `getTeacherByUsername`, `getPublishedResourcesByTeacher`, `getShareableBoardsByTeacher`. Encapsulates SQL/ORM queries and visibility filters (published-only, shareable-only).
- `src/app/teachers/[username]/__tests__/page.test.tsx` *(new)* — Vitest unit/integration tests covering: profile renders with valid teacher, empty resource/board states, resource/board counts match displayed items, `notFound()` triggered for unknown username.
- `README.md` *(modify)* — Folder structure table needs a row for `src/app/teachers/` to document the new route segment.
- `.env.example` *(modify)* — `DATABASE_URL` must be present (profile page is the first route that requires a live DB; the health route is intentionally DB-free). If `DATABASE_URL` was already added by #3, no additional change needed.

## Indirect: callers & consumers

- `src/__tests__/typescript.test.ts` runs `tsc --noEmit` over the entire `src/` tree — new files are automatically included; impact: **compile-break** if any type errors are introduced in the new files, **none** if they are clean.
- `src/__tests__/scripts.test.ts` runs `npm run build` — same coverage extension; impact: **compile-break** if new page introduces a Next.js build error (missing `notFound`, incorrect async Server Component signature, etc.), **none** otherwise.
- `src/app/layout.tsx` — root layout wraps all pages including the new `/teachers/[username]` route; no change needed, but any global CSS or metadata added here will affect the profile page appearance.
- No other existing file calls or imports the teacher data-access module; all impact is additive.

## Public API surface

- **No new HTTP API route** is introduced — the solution uses a Server Component with server-side data fetching (no `src/app/api/teachers/` route handler). The public URL surface exposed is:
  - `GET /teachers/[username]` — HTML page; rendered server-side, publicly accessible without auth.
- Exported (TypeScript):
  - `getTeacherByUsername(username: string)` in `src/lib/teachers.ts` — new export, no prior consumers.
  - `getPublishedResourcesByTeacher(teacherId: string)` in `src/lib/teachers.ts` — new export, no prior consumers.
  - `getShareableBoardsByTeacher(teacherId: string)` in `src/lib/teachers.ts` — new export, no prior consumers.
  - TypeScript types for `Teacher`, `Resource`, `Board` (or re-exported from the DAL defined in #3).

### Breaking
- None. All changes are purely additive; no existing symbols are modified or removed.

## Tests affected

- `src/app/teachers/[username]/__tests__/page.test.tsx` *(new)* — must be created as part of this ticket; covers happy-path render, empty states, counts, and not-found behaviour.
- `src/__tests__/typescript.test.ts` — automatically picks up new `.ts`/`.tsx` files; will fail if new code has type errors.
- `src/__tests__/scripts.test.ts` — `npm run build` step automatically covers new pages; will fail on Next.js build errors in new files.
- `src/app/api/health/__tests__/route.test.ts` — not affected; health route is DB-free and unchanged.
- `src/__tests__/readme.test.ts` — the test asserts `src/app` appears in README; currently passes. If the README folder-structure update changes the format, verify the regex `src\/app` still matches.

## Docs to update

- `README.md` — **Folder structure** table: add a row for `src/app/teachers/` (public teacher profile pages). Consider noting that this route requires `DATABASE_URL`.

## Migrations / config / infra

- **`DATABASE_URL` env var** — must be set in `.env.local` (and in CI/production environments) for the profile page to function. Template value must appear in `.env.example`. This is the first page in the skeleton that is not DB-free.
- **PostgreSQL schema** — the profile page consumes tables `users`, `resources`, and `boards` with specific columns (`username`/`handle`, `name`, `bio`, `joined_at`; resource `status`/`published` flag; board `shareable` boolean). These are the responsibility of **#3**; if #3's schema does not include `bio` on users or a `shareable` flag on boards, those ACs in #3 must be updated before this ticket can be implemented. No new migrations are introduced by this ticket.
- **No feature flags** required; the new route is either deployed or not.
- **No new build/CI config** changes needed; the existing `npm run lint`, `npm run build`, and `vitest run` pipeline already covers new files automatically.

## External systems

- **PostgreSQL database** — read queries against `users`, `resources`, and `boards` tables. Three new read paths: user lookup by username (single row), resources filtered by owner + published status, boards filtered by owner + shareable flag. No writes from the public profile page itself.
- **No queue, cache, or third-party service** is introduced by this ticket. (Caching of profile responses, e.g. via Next.js `revalidate`, would be a performance concern addressed by #13 if needed.)

## Estimated diff size

- **Files touched: 5** (`page.tsx` new, `teachers.ts` new, `page.test.tsx` new, `README.md` modified, `.env.example` modified)
- **Rough lines changed: ~260**
  - `src/app/teachers/[username]/page.tsx`: ~90 lines (Server Component, teacher info section, resource list, board list, empty states, `notFound()`)
  - `src/lib/teachers.ts`: ~70 lines (3 typed query functions + return-type interfaces)
  - `src/app/teachers/[username]/__tests__/page.test.tsx`: ~90 lines (5–7 test cases: happy path, zero resources, zero boards, combined counts, not-found; mocks for DB calls)
  - `README.md`: ~5 lines (one table row)
  - `.env.example`: ~2 lines (DATABASE_URL stub)
- **Downstream churn from shape changes:** The `Teacher`, `Resource`, and `Board` types introduced in `src/lib/teachers.ts` will be consumed by #13 (profile metrics overlay). When #13 adds aggregate fields (`total_likes`, `total_downloads`) it will need to extend those types or the query functions — estimated 1 file and ~20 lines of additional change in `teachers.ts` at that point. The `page.test.tsx` fixture/mock objects will need updating to include the new fields when #13 lands (~10 lines in mocks). Total downstream churn if types are not forward-designed: ~30 lines across 2 files.
- **Confidence: medium** — line estimates assume a minimal DB client (e.g. raw `pg` or a thin query builder). If #3 introduces a heavier ORM (Prisma, Drizzle), the DAL file structure and line count may shift significantly, though the page component itself would be largely unchanged.

## Warnings

- **Hard dependency on #3 (schema), #4 (resources), and #7 (boards):** This ticket cannot be fully implemented until the `users`, `resources`, and `boards` tables exist with the required columns (`bio` on users, `shareable` on boards, `status`/published flag on resources). None of these exist in the repo today. The ticket must be blocked until those issues land, or the page must be stubbed with hard-coded mock data for parallel development.
- **Hard dependency on #2 (auth) for profile editing:** The acceptance criterion "a signed-in teacher can edit their own profile" requires session/auth infrastructure. The solution defers editing to the account settings surface (#2), but this AC will remain unverifiable until #2 ships. The public read view can be delivered independently.
- **`bio` column not explicitly listed in #3's ACs:** Issue #3 lists `users` as a required table but does not explicitly enumerate a `bio` column in its acceptance criteria. If #3 ships without `bio`, this ticket's "short bio" AC cannot be met without a follow-up schema change.
- **`shareable` flag not defined in #7:** Issue #7 describes boards as personal collections only and does not mention a public/shareable visibility attribute. The board sharing model resolved in the enrichment (per-board `shareable` boolean) must be explicitly incorporated into #7's schema and implementation, or added as a delta migration alongside this ticket. This is a cross-ticket coordination risk.
- **No DB client library yet:** `package.json` has no PostgreSQL client (`pg`, `postgres`, `@prisma/client`, etc.). Whichever client #3 selects will directly determine how query functions in `src/lib/teachers.ts` are written. Starting this ticket before #3's DAL conventions are settled will likely require a rewrite of the data-access layer.
- **Profile editing ownership ambiguity:** The ticket AC states teachers can edit name/bio "from account settings." Account settings is nominally part of #2 (auth), but #2's ACs make no mention of a settings UI. This creates a gap — the edit capability may fall between tickets. Flag for the human at the gate.
- **`src/__tests__/scripts.test.ts` build test:** The existing `npm run build` test will fail during development until the new page's TypeScript types resolve (i.e., until DB client types from #3 are installed). CI will be broken on this branch until dependencies are in place.
