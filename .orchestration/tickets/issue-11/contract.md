# Contract for issue-11

Written by: contract-writer
Locked at: 2026-08-27T22:11:56+01:00
Consumed by: coder, tester, spec-reviewer, diagnoser

## Interfaces

### types.Resource
- **Path:** `src/lib/types.ts`
- **Signature:**
  ```typescript
  export type Resource = {
    id: string;
    name: string;
    ownerId: string;
    filePath: string;       // server-side key relative to UPLOADS_DIR; NEVER sent to client
    downloadCount: number;
    createdAt: string;      // ISO 8601
  };
  ```
- **Semantics:** `id`, `ownerId`, `filePath`, and `createdAt` are immutable after creation. `downloadCount` is the only mutable field, incremented atomically by `incrementDownload`. `filePath` must be stripped from every HTTP response body.
- **Errors:** n/a (data shape only)
- **Side effects:** none
- **Not in contract:** optional display fields (description, tags, mimeType) — may be appended without breaking this contract

### types.DownloadRecord
- **Path:** `src/lib/types.ts`
- **Signature:**
  ```typescript
  export type DownloadRecord = {
    resourceId: string;
    userId: string;
    timestamp: string;    // ISO 8601, UTC
  };
  ```
- **Semantics:** Append-only audit entry. Written once per successful byte delivery, never updated or deleted. `timestamp` must be non-empty.
- **Errors:** n/a (data shape only)
- **Side effects:** none
- **Not in contract:** additional audit fields (ip, userAgent, bytesSent)

### types.User
- **Path:** `src/lib/types.ts`
- **Signature:**
  ```typescript
  export type User = {
    id: string;
  };
  ```
- **Semantics:** Minimal auth principal. `id` is the stable user identifier used in `DownloadRecord.userId` and owner filtering.
- **Errors:** n/a (data shape only)
- **Side effects:** none
- **Not in contract:** display name, email, roles — added when real auth lands

### types.StoreData
- **Path:** `src/lib/types.ts`
- **Signature:**
  ```typescript
  export type StoreData = {
    resources: Resource[];
  };
  ```
- **Semantics:** Top-level shape of `data/resources.json`. Audit records are stored separately in `data/audit.json` (a bare `DownloadRecord[]`), not inside `StoreData`.
- **Errors:** n/a (data shape only)
- **Side effects:** none
- **Not in contract:** schema version field

---

### resource-store.getStore
- **Path:** `src/lib/store/resource-store.ts`
- **Signature:**
  ```typescript
  export async function getStore(): Promise<StoreData>
  ```
- **Semantics:** Reads and JSON-parses `<DATA_DIR>/resources.json`. Returns `{ resources: [] }` if the file does not exist (ENOENT). Must NOT be called concurrently with a write without mutex protection.
- **Errors:** Throws on malformed JSON.
- **Side effects:** Read-only filesystem access.
- **Not in contract:** caching, file-path construction detail

### resource-store.getResourceById
- **Path:** `src/lib/store/resource-store.ts`
- **Signature:**
  ```typescript
  export async function getResourceById(id: string): Promise<Resource | null>
  ```
- **Semantics:** Returns the first resource where `resource.id === id`, or `null` if absent.
- **Errors:** Throws on I/O or parse error.
- **Side effects:** Read-only.
- **Not in contract:** internal call to `getStore` vs direct read

### resource-store.getResourcesByOwner
- **Path:** `src/lib/store/resource-store.ts`
- **Signature:**
  ```typescript
  export async function getResourcesByOwner(ownerId: string): Promise<Resource[]>
  ```
- **Semantics:** Returns all resources where `resource.ownerId === ownerId`. Returns `[]` if none found.
- **Errors:** Throws on I/O or parse error.
- **Side effects:** Read-only.
- **Not in contract:** sorting, pagination

### resource-store.incrementDownload
- **Path:** `src/lib/store/resource-store.ts`
- **Signature:**
  ```typescript
  export async function incrementDownload(resourceId: string, userId: string): Promise<void>
  ```
- **Semantics:**
  - Pre-condition: resource with `resourceId` exists in store.
  - Post-condition: `resource.downloadCount` increases by exactly 1; a `DownloadRecord` `{ resourceId, userId, timestamp: new Date().toISOString() }` is appended to `<DATA_DIR>/audit.json`.
  - Invariant: concurrent calls on the same resource MUST NOT lose updates — protected by an in-process async mutex.
  - Both the counter write and the audit append happen in a single locked critical section.
- **Errors:** Throws if `resourceId` not found. Throws on write failure (partial writes must not corrupt the store).
- **Side effects:** Writes `<DATA_DIR>/resources.json` and `<DATA_DIR>/audit.json`.
- **Not in contract:** mutex library choice (async-mutex vs hand-rolled promise queue); write-to-tmp-then-rename is recommended but not mandated

---

### file-storage.resolveUploadPath
- **Path:** `src/lib/file-storage.ts` (or inlined in download route)
- **Signature:**
  ```typescript
  export function resolveUploadPath(filePath: string): string
  ```
- **Semantics:** Returns the absolute path `path.join(UPLOADS_DIR, filePath)`. Must reject traversal: if the resolved path is not inside `UPLOADS_DIR`, throws `Error("invalid file path")`.
- **Errors:** Throws `Error("invalid file path")` on `..`-escape or absolute `filePath`.
- **Side effects:** None (pure, no I/O).
- **Not in contract:** exact traversal-check implementation

### file-storage.fileExists
- **Path:** `src/lib/file-storage.ts` (or inlined)
- **Signature:**
  ```typescript
  export async function fileExists(absolutePath: string): Promise<boolean>
  ```
- **Semantics:** Returns `true` if a regular file exists at `absolutePath`, `false` otherwise. MUST NOT throw on ENOENT.
- **Errors:** Returns `false` on permission errors; does not throw.
- **Side effects:** Read-only stat/access call.
- **Not in contract:** `fs.stat` vs `fs.access` implementation

### file-storage.createReadStream
- **Path:** `src/lib/file-storage.ts` (or inlined)
- **Signature:**
  ```typescript
  export function createReadStream(absolutePath: string): ReadableStream<Uint8Array>
  ```
- **Semantics:** Returns a Web API `ReadableStream<Uint8Array>` backed by a Node.js `fs.ReadStream`. Caller must have verified existence via `fileExists` before calling. The stream is consumed once; it cannot be replayed.
- **Errors:** Throws if the file cannot be opened (race condition after existence check, permission denied).
- **Side effects:** Opens a file descriptor; the descriptor closes when the stream is consumed or cancelled.
- **Not in contract:** buffer size, highWaterMark, Node→Web stream bridge implementation

---

### auth.getSessionUser
- **Path:** `src/lib/auth/get-session-user.ts`
- **Signature:**
  ```typescript
  export async function getSessionUser(request: Request): Promise<User | null>
  ```
- **Semantics:**
  1. If `process.env.TEST_USER_ID` is non-empty, return `{ id: process.env.TEST_USER_ID }`.
  2. Else read the `__session` cookie from `request`; if present and non-empty, return `{ id: <cookieValue> }`.
  3. Else return `null`.
- **Errors:** Never throws; returns `null` on any auth failure.
- **Side effects:** None (read-only env + request headers).
- **Not in contract:** cookie signature verification, JWT validation — deferred to real auth replacement

---

### download.sanitiseFilename
- **Path:** `src/lib/download/sanitise-filename.ts`
- **Signature:**
  ```typescript
  export function sanitiseFilename(name: string): string
  ```
- **Semantics:** Strips characters that could break `Content-Disposition` header parsing: `"`, `;`, `\r`, `\n`, `:`. Returns a non-empty string even for empty input (fallback: `"resource"`). Preserves normal ASCII alphanumeric names and unicode characters (ASCII-only fallback acceptable for unicode).
- **Errors:** Never throws.
- **Side effects:** None (pure function).
- **Not in contract:** exact fallback string for empty input beyond being non-empty

---

### HTTP GET /api/resources/[id]
- **Path:** `src/app/api/resources/[id]/route.ts`
- **Signature:**
  ```typescript
  export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response>
  ```
- **Semantics:**
  - Resolves `params` (Next.js 15 App Router params are a Promise).
  - 200: resource found → `NextResponse.json(resourceWithoutFilePath, { status: 200 })` where the body is `Omit<Resource, 'filePath'>`.
  - 404: not found → `NextResponse.json({ error: "Not found" }, { status: 404 })`.
  - Response body MUST NOT contain `filePath`.
- **Errors:** 404 for unknown id; 500 on unexpected store errors.
- **Side effects:** Read-only.
- **Not in contract:** authentication requirement (public read, no auth for MVP)

### HTTP GET /api/resources/metrics
- **Path:** `src/app/api/resources/metrics/route.ts`
- **Signature:**
  ```typescript
  export async function GET(request: Request): Promise<Response>
  ```
- **Semantics:**
  - Authenticates caller via `getSessionUser(request)`.
  - 401: unauthenticated → `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`.
  - 200: authenticated → `NextResponse.json(resources, { status: 200 })` where `resources` is `Omit<Resource, 'filePath'>[]` filtered to `ownerId === user.id`.
  - Response bodies MUST NOT contain `filePath`.
- **Errors:** 401 unauthenticated; 500 on store errors.
- **Side effects:** Read-only.
- **Not in contract:** admin cross-owner view (deferred)

### HTTP GET /api/resources/[id]/download
- **Path:** `src/app/api/resources/[id]/download/route.ts`
- **Signature:**
  ```typescript
  export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<Response>
  ```
- **Semantics (ordered steps):**
  1. `getSessionUser(request)` → if `null`, return `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`.
  2. `getResourceById(id)` → if `null`, return `NextResponse.json({ error: "Not found" }, { status: 404 })`.
  3. `resolveUploadPath(resource.filePath)` + `fileExists(absolutePath)` → if `false`, return `NextResponse.json({ error: "File unavailable" }, { status: 500 })`; counter NOT incremented.
  4. Build response: `new Response(createReadStream(absolutePath), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="<sanitisedName>.pdf"' } })`.
  5. After full stream delivery, call `incrementDownload(resource.id, user.id)`.
  - Counter MUST NOT be incremented on 401, 404, or 5xx.
- **Errors:**
  - 401 JSON body with `error` field
  - 404 JSON body with `error` field
  - 500 JSON body with `error` field (file unavailable)
- **Side effects:** On success only — writes counter and audit record via `incrementDownload`.
- **Not in contract:** exact mechanism for post-stream increment (`.finally`, stream events, or middleware); exact 5xx status code (500, 502, 503 all acceptable)

---

## Data shapes

### ResourceResponse (client-safe projection)
```typescript
type ResourceResponse = Omit<Resource, 'filePath'>;
// { id: string; name: string; ownerId: string; downloadCount: number; createdAt: string }
```
Used in all HTTP response bodies; `filePath` is always stripped before serialisation.

### data/resources.json (on-disk format)
```json
{
  "resources": [
    {
      "id": "string",
      "name": "string",
      "ownerId": "string",
      "filePath": "string",
      "downloadCount": 0,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### data/audit.json (on-disk format)
```json
[
  { "resourceId": "string", "userId": "string", "timestamp": "2024-01-01T00:00:00.000Z" }
]
```
Bare array; missing file treated as `[]`.

---

## Constants / config keys
- `DATA_DIR` = `"data"` (default; override via `process.env.DATA_DIR` — used by all tests for isolation)
- `UPLOADS_DIR` = `"uploads"` (default; override via `process.env.UPLOADS_DIR` — used by all tests for isolation)
- `TEST_USER_ID` = unset in production; when set, `getSessionUser` returns `{ id: <value> }` unconditionally

---

## Resolved ambiguities

| Discrepancy | Source A | Source B | Resolution |
|---|---|---|---|
| File layout (single vs subdirectory modules) | plan.md: `src/lib/store.ts`, `src/lib/auth.ts` | impact.md: `src/lib/store/resource-store.ts`, `src/lib/auth/get-session-user.ts` | **Use impact.md layout** — more granular, consistent with test file paths in test-plan.md |
| Auth function name | plan.md: `getAuthenticatedUser` | test-plan.md + impact.md: `getSessionUser` | **Use `getSessionUser`** — corroborated by two documents and the test file path `get-session-user.test.ts` |
| Owner metrics endpoint shape | plan.md: `GET /api/resources?owner=<id>` | test-plan.md + impact.md: `GET /api/resources/metrics` (authenticated, uses caller identity) | **Use `/api/resources/metrics`** — avoids `[id]` dynamic-segment routing collision; test-plan.md and impact.md agree |
| `src/lib/file-storage.ts` presence | plan.md: listed as new file | impact.md: omitted from new-file list | **Implementer may inline helpers or extract to module** — the three functions are contracted here regardless of location |
| `src/lib/types.ts` presence | plan.md: listed as new file | impact.md: not listed explicitly | **Create `src/lib/types.ts`** as per plan.md; it is required for TypeScript contracts shared across all modules |
