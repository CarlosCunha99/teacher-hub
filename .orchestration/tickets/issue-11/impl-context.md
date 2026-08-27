# Implementation context (shared A/B brief)

## Files this touches

### Create
| File | Purpose |
|---|---|
| `src/lib/types.ts` | Shared TypeScript types: `Resource`, `DownloadRecord`, `User`, `StoreData` |
| `src/lib/store/resource-store.ts` | JSON-backed resource store with mutex-protected `incrementDownload` |
| `src/lib/store/download-audit-store.ts` | Audit log helpers (may be co-located in resource-store or extracted) |
| `src/lib/auth/get-session-user.ts` | Auth stub: `TEST_USER_ID` env → `__session` cookie → `null` |
| `src/lib/download/sanitise-filename.ts` | Pure function: strips header-injection chars from resource names |
| `src/lib/file-storage.ts` | `resolveUploadPath`, `fileExists`, `createReadStream` (or inline in download route) |
| `src/app/api/resources/[id]/route.ts` | `GET /api/resources/:id` — metadata, no auth |
| `src/app/api/resources/metrics/route.ts` | `GET /api/resources/metrics` — owner download counts, auth required |
| `src/app/api/resources/[id]/download/route.ts` | `GET /api/resources/:id/download` — auth, stream, post-delivery increment |
| `src/app/resources/[id]/page.tsx` | Resource detail page with download link |
| `src/components/ResourceCard.tsx` | Reusable card: name + download count |
| `data/resources.json` | Seed data (runtime artefact) |
| `data/audit.json` | Seed empty audit log (runtime artefact) |
| `data/uploads/.gitkeep` | Tracked placeholder for upload dir |

### Modify
| File | Change |
|---|---|
| `.gitignore` | Add `data/*.json` and `uploads/` ignores while keeping `.gitkeep` files tracked |
| `.env.example` | Add `TEST_USER_ID=`, `UPLOADS_DIR=uploads`, `DATA_DIR=data` |
| `README.md` | Local dev setup, new env vars, new API routes table |

### Must NOT touch
| File | Reason |
|---|---|
| `src/app/api/health/route.ts` | Unrelated, passing tests depend on it |
| `src/lib/health.ts` | Unrelated |
| `src/app/page.tsx` | Unrelated home page |
| `src/__tests__/env-config.test.ts` | Will pass as long as `.env.example` gains the new keys |
| `src/__tests__/gitignore.test.ts` | Check for exact-match assertions before modifying `.gitignore` |
| `src/__tests__/readme.test.ts` | Check for exact-match assertions before modifying `README.md` |

---

## Patterns to follow

### Route handler shape (from `src/app/api/health/route.ts`)
```typescript
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }   // Next.js 15: params is a Promise
): Promise<Response> {
  return NextResponse.json(payload, { status: 200 });
}
```
- Always return `NextResponse.json(...)` for JSON responses — never `new Response(JSON.stringify(...))` for JSON.
- For streaming download, use `new Response(readableStream, { headers })` (not `NextResponse`).
- Next.js 15 App Router: `params` is a `Promise` — always `await params` before destructuring.

### Error response shape
```typescript
NextResponse.json({ error: "Human-readable message" }, { status: 4xx | 5xx })
```
- All error bodies must have an `error` field (string).
- No stack traces or internal paths in error bodies.

### TypeScript strictness
- `strict: true` in `tsconfig.json` — no implicit `any`, no non-null assertions without justification.
- `@/` path alias maps to `src/` — use for all internal imports.
- `resolveJsonModule: true` — `import storeData from "@/../data/resources.json"` works but prefer `fs.readFile` for mutable data files.

### Test file conventions (from `src/app/api/health/__tests__/route.test.ts`)
```typescript
import { GET } from "@/app/api/resources/[id]/route";
describe("GET /api/resources/:id", () => {
  it("returns 200 with resource", async () => {
    const response = await GET(new Request("http://localhost/api/resources/r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(response.status).toBe(200);
  });
});
```
- Test runner: `vitest run` (Vitest 3, `globals: true`, `node` environment).
- No test framework other than Vitest — no Jest, no Mocha.
- Use `process.env.DATA_DIR` and `process.env.UPLOADS_DIR` overrides in `beforeEach`/`afterEach` for store isolation.
- For jsdom (ResourceCard): add `// @vitest-environment jsdom` at top of test file.

---

## Utilities to reuse

- **Node built-ins only** — `fs/promises` (`readFile`, `writeFile`, `stat`, `access`), `path` (`join`, `resolve`), `stream` (`Readable`).
- **No new runtime dependencies required** unless a mutex library is adopted (`async-mutex` is the canonical choice — check licence before adding).
- **Web Streams API** — `ReadableStream`, `WritableStream` are available in Node 20+ and Next.js route handlers; bridge via `Readable.toWeb(fs.createReadStream(path))`.
- **`NextResponse` from `"next/server"`** — already in `package.json` via `next ^15.1.6`.

---

## Anti-patterns in this codebase

- **Do NOT expose `filePath` in HTTP responses** — strip it from every object before `NextResponse.json()`.
- **Do NOT read/write the store outside the mutex** — concurrent writes without the mutex will cause lost updates (see warnings in impact.md).
- **Do NOT increment the download counter before the stream completes** — the counter must be written only after full delivery (or not at all on error/abort).
- **Do NOT use `process.cwd()` hard-coded paths in tests** — use `DATA_DIR`/`UPLOADS_DIR` env overrides so tests are isolated and portable.
- **Do NOT import `data/resources.json` statically** — it is a mutable runtime file; always read it with `fs.readFile` at request time.
- **Do NOT set `TEST_USER_ID` in production** — it bypasses all authentication.
- **Do NOT use `res.write` / Express patterns** — this is Next.js App Router, handlers return a `Response` object.

---

## Repo commands (verified)

```bash
# Run all tests
npx vitest run

# Run targeted test subset (resources + store + auth + download + components)
npx vitest run src/app/api/resources src/lib/store src/lib/auth src/lib/download src/components

# Type-check (will catch new files)
npx tsc --noEmit

# Lint
npx next lint

# Format check
npx prettier --check .
```

**Framework versions:**
- Next.js 15.1.6 (App Router, `params` is a `Promise` in route handlers)
- React 19
- TypeScript 5.7.3 (`strict: true`, `moduleResolution: "bundler"`)
- Vitest 3.0.4 (`globals: true`, default environment: `node`)
- Node ≥ 20 (required by `engines` in `package.json`)
