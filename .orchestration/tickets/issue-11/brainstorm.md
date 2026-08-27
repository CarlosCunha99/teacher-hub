# Brainstorm — issue-11

### 2026-08-27 21:57 — dev

Looking at this ticket, we need to build several things from scratch since the repo has no DB yet:

1. Data layer: User, Resource, Like, Download models
2. Download endpoint that atomically increments counter + serves file
3. Profile page surfacing aggregate totals

For the data layer, I'm thinking Prisma with SQLite for local dev, configured to swap to Postgres in production (matching issue #3's direction). The schema needs: resources with a `status` field (draft/published), a downloads table with `resourceId`, a likes table, and a users table. Aggregate counts can either be maintained columns on the resource (denormalized) or computed at query time with Prisma's `_count` aggregate.

Maintained columns are faster for reads but more complex to keep consistent. For MVP with low traffic, a query-time aggregate via Prisma's GROUP BY count is simpler and correct.

### 2026-08-27 21:58 — agent

The query-time aggregate is simpler. One issue worth noting: if you're computing the profile-level totals (sum of all downloads across all published resources for a teacher) with two separate aggregate queries, they'll hit the DB twice per profile render. For MVP that's fine, but worth keeping in mind for scale. Does the profile page need both totals in a single round-trip, or are separate queries acceptable?

### 2026-08-27 21:59 — dev

Separate queries are fine for MVP. I'll use two Prisma `aggregate` / `count` calls. The profile page will be a Server Component, so both awaits happen server-side — no client roundtrip.

For the download endpoint specifically: the AC says "count only increments after successful download." In HTTP terms, if the client aborts mid-transfer the server can't easily know. The pragmatic MVP approach is to increment the counter when we decide to serve the file (after auth/status validation) — not after transfer completes. The duplicate-prevention requirement from the original issue means we shouldn't increment on retried failed requests, but a simple "increment before streaming" is acceptable for MVP since we validate the resource exists and is published first.

### 2026-08-27 22:00 — agent

That's a practical call. The "no duplicate on failed request" AC specifically calls out server-side failures (DB errors, 404s) not client-side aborts. Increment after validation passes but before streaming is consistent with that reading. Worth documenting in the contract.

### 2026-08-27 22:01 — dev

Agreed. For the profile page, the stats block will be a simple card at the top showing two numbers: "X likes · Y downloads". The page is a Server Component at `/teachers/[teacherId]`. I'll revalidate via `revalidatePath('/teachers/[teacherId]')` when a download or like mutation fires.

For the resource detail page and resource cards — those don't exist yet. I'll create minimal stub components: a `ResourceCard` component and a `/resources/[id]` detail page, both showing the download count. The like count on cards can be stubbed from the DB.

### 2026-08-27 22:02 — agent

Reasonable scope. One thing to verify: the revalidation for the profile page — since the teacher's profile path includes their ID, you'll need to know the teacher ID at mutation time to call `revalidatePath('/teachers/[teacherId]')`. Is the download endpoint expected to know which teacher owns the resource?

### 2026-08-27 22:03 — dev

Yes — resource has an `authorId` FK to users. When the download POST fires, we load the resource (which includes `authorId`), increment the counter, then revalidate `/teachers/{resource.authorId}`. Simple.

Let's go with this direction:
- Prisma + SQLite, schema in `prisma/schema.prisma`
- Models: User, Resource (with status enum), Like, Download  
- Server Component profile page at `/teachers/[teacherId]` with stats header
- POST `/api/resources/[id]/download` — validates resource is published, increments download count atomically (Prisma `update` with `increment`), revalidates teacher profile
- Minimal ResourceCard + resource detail page stubs
- Two Prisma aggregate queries for profile totals (count where status=published)
