# Code Review — issue-11

Reviewer: code-review (independent, adversarial)
Reviewed at: 2026-08-27T22:41:16+01:00
Base: `main`
Posture: "how does this ship broken?"

## Verdict: **request-changes**

One blocking finding: the download counter is decoupled from client delivery and the
file is fully buffered in memory, which violates both an explicit acceptance criterion
(aborted downloads must not increment) and the streaming non-functional requirement.
Two additional correctness findings (non-Latin1 filename → 500; broken `cancel()` /
fd cleanup on abort) are important but individually below the blocking bar.

---

## Summary

The store, auth stub, filename sanitiser, path-traversal guard, in-process write
mutex, metrics endpoint, detail route, and UI wiring are all solid and match the
contract. The traversal guard (`resolveUploadPath`) and the serial write-queue mutex
(`withWriteLock`) are correct and I could not break them.

The problems are concentrated in the streaming download route
(`src/app/api/resources/[id]/download/route.ts`). Its custom `ReadableStream`
does **all** reading inside `start()` with no backpressure and no cancellation
propagation. Empirically this (a) buffers the entire file in memory and (b) fires
`incrementDownload` when the *disk read* completes, not when the *client* has
received the bytes — so a client that requests the file and immediately disconnects
still bumps the counter. That contradicts AC "aborted before delivery do not
increment" and the streaming NFR.

---

## Blocking findings

### B1 — Counter increments on disk-read completion, not client delivery; whole file buffered in memory
**File:** `src/app/api/resources/[id]/download/route.ts:33-62`

The tracked stream reads the entire source and enqueues every chunk inside `start()`:

```ts
const trackedStream = new ReadableStream<Uint8Array>({
  async start(controller) {
    const reader = baseStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) { await incrementDownload(resource.id, user.id); controller.close(); return; }
      if (value) controller.enqueue(value);
    }
  },
  ...
});
```

There is no `pull()` and no `controller.desiredSize` check, so `start()` is never
throttled by the consumer. Two consequences, both demonstrated:

1. **Streaming NFR violated.** The whole file is drained from disk into the tracked
   stream's internal queue regardless of how fast (or whether) the client reads. The
   ticket explicitly requires multi-MB PDFs be streamed "rather than fully buffered in
   memory." This buffers them.

2. **AC violated: aborted downloads still increment.** Because `start()` races to
   completion, `incrementDownload` fires as soon as the bytes are read off disk — before
   the client consumes anything. A client that opens the download and disconnects
   without reading the body still increments the counter.

**Evidence (empirical, Node v25, same runtime primitives):**

```
incremented BEFORE any client consumption: true
final incremented (client never read body): true
```

i.e. the counter reached its incremented state with the consumer never having read a
single byte, then a client cancel changed nothing — it was already counted.

The ticket flags AC: "Failed downloads (4xx, 5xx, aborted before delivery) do not
increment the counter" and the contract step 5 says "After full stream *delivery*, call
`incrementDownload`." The implementation increments after full *read*, not delivery.
Note the existing tests cannot catch this — every download test `await`s
`response.arrayBuffer()`, so delivery and disk-read are indistinguishable in them.

**Suggested fix (do not implement):** Drive reads from `pull()` (one chunk per consumer
demand) so the source is throttled by real backpressure, and only call
`incrementDownload` from the terminal path that is actually reached when the consumer
has pulled through end-of-stream — or gate the increment on a successful `flush`/last
`pull` rather than an eager `start()` loop. This restores true streaming and ties the
increment to delivery.

---

## Important findings

### I1 — Non-Latin1 resource names make the download return 500 instead of the file
**File:** `src/app/api/resources/[id]/download/route.ts:64-72`, `src/lib/download/sanitise-filename.ts`

`sanitiseFilename` strips only `[";\r\n:]`. It does not ASCII-fold or RFC 5987-encode.
The result is interpolated raw into the header:

```ts
"Content-Disposition": `attachment; filename=\"${fileName}\"`
```

HTTP header values are ByteStrings (Latin-1). A resource name containing any code point
> U+00FF (CJK, emoji, many non-Latin scripts) makes `new Response(..., { headers })`
throw, which is caught by the outer `try/catch` and returned as `500 "File unavailable"`.
For an education platform with international teachers this is a realistic, hard failure —
the file is present but undownloadable, and the error is misleading.

**Evidence (empirical):**
```
CJK header THREW: TypeError Cannot convert argument to a ByteString ... value of 25968 which is greater than 255.
Latin1 header OK: attachment; filename="Álgebra.pdf"
```
(Accented Latin-1 names like "Álgebra" work; CJK/emoji do not.)

The contract explicitly permitted an "ASCII-only fallback acceptable for unicode" —
that fallback was not implemented.

**Suggested fix (do not implement):** Provide an ASCII fallback for the plain
`filename=` parameter and add an RFC 5987 `filename*=UTF-8''<pct-encoded>` parameter for
the real name.

### I2 — `cancel()` cancels an already-locked stream (unhandled rejection) and leaks the file descriptor on client abort
**File:** `src/app/api/resources/[id]/download/route.ts:55-57`

```ts
async cancel(reason) {
  await baseStream.cancel(reason);
}
```

`baseStream` is already locked by the reader acquired in `start()` (`getReader()`), so
`baseStream.cancel()` throws `ERR_INVALID_STATE: ReadableStream is locked`. On a genuine
mid-stream client abort this rejects (unhandled) and, because the underlying Node
`fs.ReadStream` is neither cancelled nor its reader released via this path, the open file
descriptor is not reliably closed until GC. Under repeated aborted large downloads this
is an fd/resource leak.

**Evidence (empirical):**
```
consumer cancel error: ERR_INVALID_STATE
UNHANDLED REJECTION in cancel(): ERR_INVALID_STATE   (when not swallowed)
```

**Suggested fix (do not implement):** Cancel via the held reader (or call
`reader.cancel(reason)` / release then cancel) rather than cancelling the locked
`baseStream`, and ensure the underlying fd is closed on the cancel path.

### I3 — Committed seed resources point at PDF files that do not exist in the repo
**Files:** `data/resources.json`, `data/uploads/` (only `.gitkeep`)

`resource-1` → `sample.pdf` and `resource-2` → `math-warmups.pdf`, but `data/uploads/`
ships only `.gitkeep`. A signed-in user downloading either seeded resource in a fresh
checkout hits `fileExists === false` → `500 "File unavailable"`. The end-to-end happy
path (a core success criterion) cannot be demonstrated with the shipped data. This may be
intentional for the foundation stage, but as shipped the demo path is broken.

**Suggested fix (do not implement):** Commit placeholder PDFs for the seed rows (or seed
rows whose `filePath` matches a committed file), or document that uploads must be
provided.

---

## Suggestions (non-blocking)

- **S1 — `TEST_USER_ID` is an unguarded auth bypass.** `getSessionUser` returns
  `{ id: TEST_USER_ID }` whenever the env var is non-empty, with no `NODE_ENV` guard
  (`src/lib/auth/get-session-user.ts:24-28`). This matches the contract (which locks the
  behavior as unconditional), so it is not a blocking deviation, but a single production
  misconfiguration silently authenticates every request as that user. A defensive
  `NODE_ENV !== "production"` guard would make the backdoor fail-safe. Flagged for the
  human, not required by the contract.

---

## Contract adherence

- `types.ts` shapes (`Resource`, `DownloadRecord`, `User`, `StoreData`): **match.**
- `resource-store` (`getStore`/`getResourceById`/`getResourcesByOwner`/`incrementDownload`):
  **match.** ENOENT → empty; increment + audit append in a single locked critical
  section; atomic tmp-then-rename writes. The `withWriteLock` promise queue correctly
  serializes concurrent increments (no lost updates) and does not leak.
- `file-storage.resolveUploadPath`: **match** — rejects absolute paths and `..` escapes
  correctly (I could not defeat it).
- `file-storage.fileExists`: **match** — returns `false` on error, never throws.
- `file-storage.createReadStream`: present (aliased from `createReadableStream`).
- `auth.getSessionUser`: **match** — three branches; never throws (malformed
  `decodeURIComponent` is swallowed).
- `download.sanitiseFilename`: partial — strips the contracted characters and provides a
  non-empty fallback, but omits the permitted ASCII/unicode fallback, causing I1.
- `GET /api/resources/[id]`: **match** — strips `filePath`, 404/500 JSON.
- `GET /api/resources/metrics`: **match** — 401 unauth, owner-filtered, `filePath` stripped.
- `GET /api/resources/[id]/download`: ordered steps 1-4 match; **step 5 deviates** — the
  increment is tied to disk-read completion rather than delivery (B1).

## Requirements coverage

- AC 200/401/404/5xx JSON bodies, `filePath` never leaked, counter persistence, in-process
  concurrency (+2), audit record, card + detail count display, owner metrics: **covered.**
- "Failed/aborted downloads do not increment": **not satisfied** for the aborted case (B1).
- Streaming (no full in-memory buffering): **not satisfied** (B1).
- Filename safety for non-Latin1 names: **not satisfied** (I1).
- Admin cross-owner metrics (AC12): contract-documented deferral; noted, non-blocking.

## Notes

- The `data/resources.json` / `data/audit.json` runtime-mutation-of-committed-seed concern
  from verify.md is real but acknowledged as a known limitation until #3; not counted
  against this change.
- The in-process mutex only serializes within one Node process; multi-process/multi-instance
  deploys would still race. Acceptable for MVP/single-process; worth remembering when a real
  DB lands (#3).
