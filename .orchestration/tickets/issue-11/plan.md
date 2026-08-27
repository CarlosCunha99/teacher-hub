# Implementation plan

## Goal
Authenticated teachers can view resource metadata, download the underlying PDF through a secure API, and see persistent per-resource download counts backed by local disk storage.

## Approach
Use a small shared domain model in `src/lib/types.ts` to define the JSON-backed contracts the feature depends on: resource metadata, download audit records, and the minimal user shape needed by the auth stub. Keep the storage format simple and explicit so API routes, UI components, and seed data all agree on the same fields from day one.

Implement persistence in two thin server-side utilities. `src/lib/store.ts` will own reading and atomically rewriting `data/resources.json`, including a module-level async mutex so concurrent increments do not lose updates. `src/lib/file-storage.ts` will isolate filesystem access for PDF bytes under `data/uploads/`, so routes never expose internal paths and the storage layer stays swappable when a real upload pipeline arrives.

Build the HTTP surface as three App Router handlers that follow the existing `NextResponse.json(...)` convention for JSON responses. The metadata route returns one resource plus its `downloadCount`; the collection route supports `?owner=` for owner metrics; the download route authenticates, streams the PDF, and only updates the JSON store after the stream finishes successfully. Error paths stay JSON-only and never mutate counts.

Finish by wiring the UI to those APIs rather than the filesystem directly. The resource detail page fetches server metadata, shows the current count, and links to the download endpoint; `ResourceCard` renders the same count anywhere resources are listed. Seed data in `data/resources.json` plus a tracked placeholder under `data/uploads/` make local development predictable, while `.gitignore` keeps runtime artifacts out of Git.

## Steps
1. **Define shared contracts and seed layout** — Add `src/lib/types.ts` with `Resource`, `DownloadRecord`, and the minimal `User` shape the auth stub returns; create `data/resources.json` with sample resource metadata and download state; add a tracked placeholder such as `data/uploads/.gitkeep`; update `.gitignore` to ignore mutable `data/` contents while preserving committed seed files. Depends on: none.
2. **Build disk-backed storage utilities** — Implement `src/lib/store.ts` to load resource data, resolve by id/owner, and perform atomic write-to-temp-then-rename updates guarded by an in-process mutex; implement `src/lib/file-storage.ts` to resolve safe paths under `data/uploads/`, verify file existence, and provide readable file access without leaking storage paths. Depends on: step 1.
3. **Add authentication stub** — Implement `src/lib/auth.ts` with `getAuthenticatedUser`, reading `TEST_USER_ID` first and then the `__session` cookie, returning `User | null` through one stable interface that future real auth can replace. Depends on: step 1.
4. **Expose resource read APIs** — Add `src/app/api/resources/[id]/route.ts` for single-resource metadata and `src/app/api/resources/route.ts` for collection reads with `?owner=` filtering, both returning JSON payloads derived from `src/lib/store.ts` and including current `downloadCount`. Depends on: steps 2, 3.
5. **Implement secure streaming download** — Add `src/app/api/resources/[id]/download/route.ts` to authenticate the caller, look up metadata, stream the PDF with `Content-Type: application/pdf` and sanitized `Content-Disposition`, and only after successful stream completion persist the incremented count plus appended `DownloadRecord` in one store update. Depends on: steps 2, 3, 4.
6. **Wire the user-facing surfaces** — Add `src/components/ResourceCard.tsx` to display resource name and download count, then add `src/app/resources/[id]/page.tsx` to fetch resource metadata, render the count, and trigger downloads through `/api/resources/[id]/download` rather than direct file URLs. Depends on: steps 4, 5.

## Files
### Create
- `src/lib/types.ts` — shared TypeScript contracts for resources, audit records, and auth user shape.
- `src/lib/store.ts` — JSON-backed metadata/audit store with mutex-protected atomic writes.
- `src/lib/file-storage.ts` — local file access helper rooted at `data/uploads/`.
- `src/lib/auth.ts` — auth stub for `TEST_USER_ID` and `__session` cookie lookup.
- `src/app/api/resources/[id]/route.ts` — single-resource metadata endpoint.
- `src/app/api/resources/route.ts` — owner metrics / resource collection endpoint with `?owner=` filter.
- `src/app/api/resources/[id]/download/route.ts` — authenticated streaming download endpoint.
- `src/app/resources/[id]/page.tsx` — resource detail page with count display and download action.
- `src/components/ResourceCard.tsx` — reusable card showing resource name and download count.
- `data/resources.json` — local sample metadata, counters, and audit seed structure.
- `data/uploads/.gitkeep` — tracked placeholder for local PDF storage.

### Modify
- `.gitignore` — ignore mutable local data under `data/` while keeping intentional seed/placeholder files tracked.

### Delete
- None.

## Data / schema / migration
No database migration. `data/resources.json` becomes the MVP persistence format for resource metadata, download counts, and audit records; backward compatibility is not required because this is net-new functionality with seeded local data.

## Rollout
- Feature flag? no.
- Backfill? no; seed local sample data only.
- Ordering: land seed files and storage helpers before exercising the API routes; single-process deployment assumption must hold for the in-process mutex to protect counters.

## Assumptions and non-decisions
- Any authenticated user may download any resource in MVP; per-resource ACLs are deferred.
- `__session` is treated as a simple user-id carrier until real session validation replaces the stub.
- The collection route’s `?owner=` filter satisfies the immediate owner-metrics need; no admin UI is added here.
- Filename sanitization can live in the download route unless extraction becomes necessary during implementation.

## Not doing
- No new database, object storage, or background jobs.
- No admin dashboard or richer analytics visualizations.
- No upload workflow, file management UI, or support for non-PDF formats.
- No replacement of the broader authentication system beyond the minimal stub interface.
