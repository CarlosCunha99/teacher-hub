# Solution: JSON-backed streaming download with stub auth

## Direction
We are building a resource download feature on top of Next.js App Router with no database or cloud storage — the codebase is at foundation stage. Resource metadata and download counts will be persisted in a JSON file store on local disk; file bytes will live under a local uploads directory. Both layers are intentionally thin and swappable when the Postgres schema (#3) and upload workflow (#4) land.

The download endpoint streams file bytes to the client using the Node-to-Web stream bridge so large PDFs are never fully buffered in memory. The download counter is incremented only after the full body has been delivered without error — client aborts mid-stream do not count. To prevent lost updates under concurrent downloads, writes to the JSON store are serialised in-process via a module-level async mutex. Each successful download also writes an audit record (resource ID, user ID, timestamp) atomically in the same JSON store write.

Auth is introduced as a thin middleware abstraction that reads either a `TEST_USER_ID` env variable (for MVP testing) or a session cookie. The interface contract is fixed — authenticated user or null — so when real session auth from #2 ships, only this one function changes. The download endpoint enforces authentication: unauthenticated requests receive 401, missing resources 404, missing file bytes 5xx, and none of these increment the counter.

On the frontend, a resource detail page at a dynamic route fetches metadata (including download count) from a dedicated metadata API route, while the download is triggered by a separate button hitting the download route. A reusable resource card component displays name and download count. A metrics API route lets resource owners query download counts for their own resources, satisfying the owner-metrics AC and providing the data feed for the profile totals feature (#13).

## Key decisions
- Decided to use a local JSON file store (not Postgres) because #3 is still open and the MVP needs persistence without a DB dependency.
- Decided to use a module-level in-process mutex for counter writes because the app runs as a single Node process and this is sufficient for MVP concurrency without external locking.
- Decided to increment the counter only after full body delivery (no increment on abort) to match the "successful delivery only" AC.
- Decided to write the audit record atomically with the counter increment (same JSON write) to keep the two always in sync.
- Decided any authenticated user can download any resource for MVP, consistent with the public sharing model of #4.
- Decided metrics exposure is API-only (no admin UI) — owner query plus the card/detail surfaces.

## Explicitly rejected
- Postgres for the data layer: blocked by #3 being open; would couple this ticket to that one.
- Increment counter on request accept (before streaming): over-counts aborted transfers.
- Per-resource ACLs: not mentioned in #4 or the ticket; deferred to a future access-control ticket.
- Admin dashboard UI: out of scope per the ticket; a future admin ticket owns that surface.

## Open questions
- None. All ambiguities from the ticket were resolved during brainstorm.
