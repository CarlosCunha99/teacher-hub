# Solution: Download tracking + profile aggregate stats

## Direction

Build the data layer from scratch using Prisma with SQLite (swappable to Postgres), defining four models: User, Resource (with a status enum: draft/published), Like, and Download. Aggregate counts are computed at query time using Prisma's built-in aggregate/count rather than maintained denormalised columns on the resource row.

Expose a POST download endpoint that validates the resource exists and is published, then atomically increments the download counter (Prisma `update` + `increment`) before streaming the file. The counter increments after validation passes but before transfer completes — server-side failures (404s, DB errors) do not increment; client-side aborts are acceptable at MVP.

The teacher profile page is a Next.js Server Component at `/teachers/[teacherId]`. It runs two Prisma aggregate queries server-side to compute total likes and total downloads across that teacher's published resources, displaying a stats header card with "X likes · Y downloads". Cache invalidation is handled by calling `revalidatePath` with the teacher's profile path when a download or like mutation completes — no polling or WebSocket required.

Minimal stub components (ResourceCard and a resource detail page) are delivered to render per-resource download counts, providing surfaces that later issues can extend.

## Key decisions

- Decided to use query-time Prisma aggregates (not maintained counter columns) because MVP traffic is low and it avoids consistency complexity.
- Decided to increment the download counter after validation but before transfer completes because the AC's "no duplicate on failed request" targets server-side failures, not client-side aborts.
- Decided two separate Prisma aggregate queries for profile totals (not a single combined query) because separate queries are simpler and two server-side awaits in a Server Component add no client round-trips.
- Decided revalidation is per-mutation via `revalidatePath('/teachers/{authorId}')` using the `authorId` FK already present on the resource record.
- Decided the download endpoint is publicly accessible for published resources (no auth for MVP, consistent with issue #2 being out of scope).
- Decided profile stats are always publicly visible for MVP.

## Explicitly rejected

- Maintained counter columns on Resource: rejected because they add write-path complexity and consistency risk that is unwarranted at MVP scale.
- Single combined aggregate query for profile totals: rejected as unnecessary optimisation at MVP; two queries are simpler.
- Incrementing after confirmed client transfer: rejected as impractical in HTTP — the server cannot reliably detect client-side aborts.

## Open questions

- None. All ambiguities (A1–A4) were resolved during the brainstorm; A5 (file storage) is deferred to issue #4 with a URL/stub approach for MVP.
