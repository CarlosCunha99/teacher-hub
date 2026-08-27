# Brainstorm — issue-11

## 2026-08-27 22:10 — dev
Alright, let me think through this. The MVP project is at foundation stage — no database, no auth, no resource model. Issue #3 (Postgres schema) and #4 (upload workflow) are open, so I can't assume a DB or real file storage. The download endpoint needs to work as a self-contained MVP feature but also not block future work.

My instinct is to keep the data layer thin: a JSON file per resource or a simple JSON store for resource metadata and download counts. That way we get persistence across sessions without needing a full Postgres setup. For file storage, local disk under a `data/uploads/` directory makes sense for MVP. These can be swapped when #3/#4 land.

## 2026-08-27 22:11 — agent
What's the concurrency profile for the counter? If multiple teachers download the same popular resource simultaneously, a plain file read-modify-write will lose updates. Worth thinking about whether the JSON store approach handles that, or if a different primitive is needed.

## 2026-08-27 22:12 — dev
Good point. For MVP, I think atomic file writes with a lock file should be enough — this is Node.js, so I can use the `lockfile` pattern or just rely on the fact that Next.js route handlers run in-process with Node's event loop. A simple mutex in-process (a module-level Promise chain) would prevent concurrent writes to the same resource's count. Not bulletproof across multiple processes or restarts with in-flight requests, but good enough for MVP.

## 2026-08-27 22:13 — agent
Makes sense for single-process MVP. What's the auth story — issue #2 (social auth) is still open. How do you gate the download endpoint without a real session?

## 2026-08-27 22:14 — dev
I'll introduce a thin auth middleware layer. For now it just checks for a `x-user-id` header or a simple session cookie. The interface is `getAuthenticatedUser(req): User | null` — returns null if not authenticated, so the endpoint can 401. When #2 lands, only this function needs updating; the endpoint itself doesn't change.

## 2026-08-27 22:15 — agent
So the auth is a stub returning a mock user in dev, real session in prod once #2 ships?

## 2026-08-27 22:16 — dev
Exactly. For MVP testing I'll make it configurable — a `TEST_USER_ID` env var can inject a user, or it reads from a `__session` cookie. The important thing is the endpoint has the contract right: authenticated → serve file, unauthenticated → 401.

## 2026-08-27 22:17 — agent
On the streaming question — Next.js App Router uses Web Streams natively. You could read the PDF file and pass it straight to a `ReadableStream` response. That handles large files without buffering.

## 2026-08-27 22:18 — dev
Yes, `fs.createReadStream` piped into a Web ReadableStream via `Readable.toWeb()`. Then increment the counter only after the stream is fully written — catch stream errors to avoid incrementing on aborted writes. The audit log entry goes in the same transaction (same JSON file write, atomically with the counter update).

## 2026-08-27 22:19 — agent
Where does the download count surface on the frontend? There's only a placeholder page.tsx right now.

## 2026-08-27 22:20 — dev
I'll build a minimal resource detail page at `/resources/[id]` that fetches resource metadata (including download count) from an API route `/api/resources/[id]`, then a separate button/link triggers the download at `/api/resources/[id]/download`. The card component will be a reusable `ResourceCard` that displays name and download count. For MVP the "list" is just whatever resources are in the JSON store.

## 2026-08-27 22:21 — agent
Makes sense. The `GET /api/resources/[id]` endpoint for metadata is separate from `GET /api/resources/[id]/download` for the file — so the page can show the count without triggering a download.

## 2026-08-27 22:22 — dev
Correct. And the owner metrics endpoint will be `GET /api/resources?owner=<userId>` which returns an array of resources with download counts. That powers #13 (profile totals) and any future admin work.

Let's go with this: JSON file store for resource metadata + download counts, local disk for file bytes, stub auth middleware, streaming download endpoint, separate metadata endpoint, resource detail page, resource card component. Simple, swappable, satisfies all ACs.

## 2026-08-27 22:22 — agent
Written up and ready for distillation.
