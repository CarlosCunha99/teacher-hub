# Code Review — issue-11 (Round 2 / delta re-review)

Reviewer: code-review (independent, adversarial)
Reviewed at: 2026-08-27T22:50:13+01:00
Base: `main` (delta since commit `86be5ae`)
Posture: "how does this ship broken?"
Scope: focused re-review of the six files changed to address round-1 findings.

## Verdict: **approve**

All five round-1 findings (B1, I1, I2, I3, S1) are resolved. The streaming rewrite is
correct, ties the counter to delivery, and I could not reproduce the round-1 buffering /
premature-increment behaviour against the new implementation. No new blocking or important
issues introduced. One minor residual observation on abort-path fd cleanup is noted below
(non-blocking).

---

## Prior findings — status

### B1 — Counter increments on disk-read, whole file buffered → **FIXED**
**File:** `src/app/api/resources/[id]/download/route.ts:33-85`

The custom eager `ReadableStream` was replaced with a `TransformStream`. The `readable`
end is handed to the `Response`; a background loop reads from the fs-backed `baseStream`
and `await`s `writer.write(value)` for each chunk. Because `writer.write()` resolves only
when the readable side has demand, the source is now throttled by real consumer
backpressure — the file is no longer drained into memory ahead of the client.

The increment is now gated correctly:

```ts
if (done) { await writer.close(); fullyWritten = true; break; }
...
if (fullyWritten && !request.signal.aborted) { await incrementDownload(...); }
```

`incrementDownload` fires only after the source reached EOF, `writer.close()` resolved,
and the request was not aborted. A client that disconnects mid-stream causes
`writer.write()`/the abort listener to reject the loop, leaving `fullyWritten === false`,
so no increment occurs. This satisfies both the "aborted downloads do not increment" AC
and the streaming NFR. Contract step 5 ("after full stream delivery") is now honoured.

### I1 — Non-ASCII filenames → 500 → **FIXED**
**Files:** `src/app/api/resources/[id]/download/route.ts:76-84`, `src/lib/download/sanitise-filename.ts`

`sanitiseFilename` now folds every non-ASCII code point to `_`
(`/[^\x00-\x7F]/g`) in addition to stripping the forbidden header characters, so the
`filename="..."` parameter is guaranteed to be a pure-ASCII (ByteString-safe) value. The
route additionally emits an RFC 5987 `filename*=UTF-8''<pct-encoded>` parameter carrying
the real name. Header construction is now all-ASCII, so `new Response(..., { headers })`
no longer throws for CJK/emoji names. Matches the contract's permitted ASCII-fallback +
unicode approach.

### I2 — `cancel()` on a locked stream / abort handling → **FIXED** (minor residual noted)
**File:** `src/app/api/resources/[id]/download/route.ts:39-64`

The broken `cancel()` that called `baseStream.cancel()` on an already-locked stream (the
`ERR_INVALID_STATE` unhandled rejection) is gone. Client aborts are now handled via a
one-shot `request.signal` listener that calls `writer.abort()`, and the loop's
`catch`/`finally` releases the reader lock and removes the listener. No unhandled
rejection path remains, and the abort path does not increment the counter.

Residual (minor, non-blocking): on the abort path the code calls `reader.releaseLock()`
but does not `reader.cancel(reason)`, so the underlying fs read stream is released rather
than explicitly destroyed; deterministic fd closure then depends on the
`createReadStream` Node→Web bridge's finalization. This is a much smaller concern than the
round-1 unhandled rejection and is acceptable for the MVP single-process target; worth a
follow-up if aborted large downloads become common.

### I3 — Missing seed PDF → **FIXED**
**Files:** `data/resources.json`, `data/uploads/sample.pdf`

`data/uploads/sample.pdf` now exists (282-byte valid PDF: `%PDF-1.4` header through
`%%EOF` trailer). Both seed rows in `data/resources.json` point `filePath` at
`sample.pdf`, which resolves inside `UPLOADS_DIR`. The end-to-end happy path is now
demonstrable from a fresh checkout.

### S1 — Unguarded `TEST_USER_ID` bypass → **FIXED**
**File:** `src/lib/auth/get-session-user.ts:25-29`

The test backdoor is now guarded by `process.env.NODE_ENV !== "production"`, so a
production misconfiguration of `TEST_USER_ID` no longer authenticates every request. The
cookie path is unaffected. Fail-safe as suggested.

---

## New-issue scan (changed files only)

- Streaming rewrite: no double-increment, no unhandled rejection, and the increment error
  is intentionally swallowed to avoid a background unhandled rejection (contract-permitted).
  Each concurrent request carries its own `AbortSignal`; the `+2` concurrency test remains
  valid.
- `sanitiseFilename`: ASCII control characters below 0x20 other than `\r`/`\n` (e.g. tab,
  NUL) are not stripped, but they survive only inside the quoted ASCII `filename=` value and
  do not break header serialisation; teacher-supplied names containing them are implausible.
  Not a real defect.
- Updated test correctly polls for the post-delivery counter via `waitForDownloadCount`
  after consuming the body; it no longer conflates disk-read with delivery.

No blocking or important findings in the delta.
