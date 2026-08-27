# Impact analysis

## Direct changes

### New files to be created
- `src/lib/store/resource-store.ts` — JSON file-backed resource metadata store; exposes CRUD operations and a module-level async mutex for serialised counter writes
- `src/lib/store/download-audit-store.ts` — JSON file-backed audit log store; appended atomically alongside counter increment in the same store write
- `src/lib/auth/get-session-user.ts` — stub auth middleware; reads `TEST_USER_ID` env var or session cookie, returns authenticated user or `null`
- `src/lib/download/sanitise-filename.ts` — sanitises teacher-supplied resource names for safe use in `Content-Disposition` headers
- `src/app/api/resources/[id]/download/route.ts` — streaming download endpoint; enforces auth (401), validates resource existence (404), streams PDF bytes from local uploads dir, increments counter + writes audit record only after full body delivery (no increment on abort/error)
- `src/app/api/resources/[id]/route.ts` — resource metadata endpoint; returns resource metadata including current download count
- `src/app/api/resources/metrics/route.ts` — owner metrics endpoint; returns download counts for resources owned by the authenticated user
- `src/app/resources/[id]/page.tsx` — resource detail page; fetches metadata (including download count) from metadata API and renders a download button linking to the download route
- `src/components/ResourceCard.tsx` — reusable resource card component; displays resource name and download count
- `data/resources.json` — JSON file acting as resource metadata + counter store (runtime artefact, should be gitignored or seeded)
- `data/audit.json` — JSON file acting as download audit log (runtime artefact, should be gitignored or seeded)
- `uploads/` — local directory where PDF bytes are stored (runtime artefact, must be gitignored; path must not leak to client)

### Existing files to be modified
- `package.json` — no new runtime `dependencies` are strictly needed (Node `fs`/`stream` are built-in); however if a mutex helper library (e.g. `async-mutex`) is adopted, a new dependency entry is required
- `.env.example` — add `TEST_USER_ID=` entry (and optionally `UPLOADS_DIR=`, `DATA_DIR=`) so the env-config test (`src/__tests__/env-config.test.ts`) continues to pass and developers know what to set
- `README.md` — new API routes, env vars, local-dev setup for seeding `data/resources.json` and placing PDFs in `uploads/`

---

## Indirect: callers & consumers

- `src/app/api/health/route.ts:GET` calls `src/lib/health.ts` — impact: **none** (untouched)
- `src/app/page.tsx:HomePage` — impact: **none** (untouched; no shared state)
- `src/app/layout.tsx:RootLayout` — impact: **none** (untouched)
- `src/components/ResourceCard.tsx` — will be consumed by `src/app/resources/[id]/page.tsx` and any future list/grid page; callers not yet present, so no compile-break risk at this stage
- `src/lib/auth/get-session-user.ts` — consumed by both `download/route.ts` and `metrics/route.ts`; if the real auth module from #2/#14 later replaces this stub, only this one file changes — impact on its callers: **none** (interface is stable)
- `src/lib/store/resource-store.ts` — consumed by `download/route.ts`, `resources/[id]/route.ts`, and `metrics/route.ts`; change to store interface would be **compile-break** across those three routes

---

## Public API surface

- Exported: `GET` in `src/app/api/resources/[id]/download/route.ts` — new endpoint, `GET /api/resources/:id/download`
- Exported: `GET` in `src/app/api/resources/[id]/route.ts` — new endpoint, `GET /api/resources/:id`
- Exported: `GET` in `src/app/api/resources/metrics/route.ts` — new endpoint, `GET /api/resources/metrics`
- Exported: `ResourceCard` in `src/components/ResourceCard.tsx` — new component
- Exported: `getSessionUser` in `src/lib/auth/get-session-user.ts` — new auth abstraction
- Exported: resource store interface in `src/lib/store/resource-store.ts` — new module
- Exported: audit store interface in `src/lib/store/download-audit-store.ts` — new module

### Breaking
- None. All changes are net-new; no existing exports are modified or removed.

---

## Tests affected

- `src/__tests__/env-config.test.ts` — **must pass**: `TEST_USER_ID=` (and optionally `UPLOADS_DIR=`, `DATA_DIR=`) must be added to `.env.example` or the "contains at least one variable key" assertion remains green but the new vars are undocumented; strictly, the test will still pass as long as `.env.example` is non-empty — but omitting new vars is a documentation gap
- `src/app/api/health/__tests__/route.test.ts` — **unaffected** (no changes to health route)
- `src/__tests__/scripts.test.ts` — likely unaffected; verify no assumption about the full set of scripts
- `src/__tests__/readme.test.ts` — **may need update** if it asserts on specific README content and README is changed
- `src/__tests__/gitignore.test.ts` — **may need update** if it asserts specific gitignored paths and `data/` or `uploads/` directories are added to `.gitignore`
- `src/__tests__/typescript.test.ts` — will now compile all new `.ts`/`.tsx` files; will **fail** if any new file has type errors

### New test files to create
- `src/app/api/resources/[id]/download/__tests__/route.test.ts` — unit tests: 200 streams PDF + increments counter, 401 for unauth, 404 for missing resource, 5xx for missing file, no counter increment on 4xx/5xx, concurrent increments add correctly, audit record written on success
- `src/app/api/resources/[id]/__tests__/route.test.ts` — unit tests: 200 returns metadata with download count, 404 for missing resource
- `src/app/api/resources/metrics/__tests__/route.test.ts` — unit tests: 200 returns owner's resources with counts, 401 for unauth
- `src/lib/store/__tests__/resource-store.test.ts` — unit tests: mutex serialisation, counter increment, concurrent write correctness
- `src/lib/auth/__tests__/get-session-user.test.ts` — unit tests: returns user from `TEST_USER_ID`, returns null when absent
- `src/lib/download/__tests__/sanitise-filename.test.ts` — unit tests: strips header-injection chars, handles unicode, empty string edge case
- `src/components/__tests__/ResourceCard.test.tsx` — render test: name and download count are displayed

---

## Docs to update

- `README.md` — **Local development** section: add setup steps for creating `data/resources.json`, `data/audit.json`, placing PDFs in `uploads/`; add env var table (`TEST_USER_ID`, `UPLOADS_DIR`, `DATA_DIR`); add new API routes table
- `.env.example` — add `TEST_USER_ID=`, `UPLOADS_DIR=uploads`, `DATA_DIR=data`

---

## Migrations / config / infra

- `.gitignore` — add `data/*.json` (runtime store files) and `uploads/` (uploaded PDFs) so local runtime artefacts are not committed; optionally add `data/.gitkeep` and `uploads/.gitkeep` so empty directories are tracked
- `.env.example` — new keys: `TEST_USER_ID=`, `UPLOADS_DIR=uploads`, `DATA_DIR=data`
- `TEST_USER_ID` env var — read by stub auth middleware; required for local dev/testing without a real session; must **not** be set in production
- `UPLOADS_DIR` env var (optional / defaulted) — path to local PDF uploads directory; defaults to `uploads/` at repo root
- `DATA_DIR` env var (optional / defaulted) — path to JSON store directory; defaults to `data/` at repo root
- No database migrations — intentionally deferred (JSON file store is the MVP persistence layer)
- No cloud infra changes — local filesystem only

---

## External systems

- **Local filesystem** — new read/write dependency: `data/resources.json`, `data/audit.json`, `uploads/*.pdf`; process must have read+write access to these paths
- **No DB / queue / cache / external service** — solution is intentionally self-contained for MVP

---

## Estimated diff size

- Files touched: **~14** (7 new API/lib files + 2 new page/component files + 2 new data-layer files + `.env.example` + `.gitignore` + `README.md`)
- New test files: **~7**
- Total files created or modified: **~21**
- Rough lines changed: **~600–900** (implementation ~400, tests ~300, docs/config ~50)
- Confidence: **medium** — exact line counts depend on streaming boilerplate, mutex implementation choice, and test fixture depth; the file inventory is high-confidence

---

## Warnings

- **Mutex is in-process only**: the `async-mutex` (or equivalent) approach prevents lost updates only within a single Node process. If the app is ever deployed with multiple replicas or PM2 clusters, counter writes will race. This is acceptable for MVP but must be flagged before any horizontal-scale deployment.
- **JSON file store is not atomic across crashes**: a process kill between reading and writing `resources.json` can corrupt the file. A write-to-tmp-then-rename pattern mitigates this; the implementation must include it or document the risk.
- **`TEST_USER_ID` env var must never reach production**: if set in a production environment, any user is effectively authenticated as that ID. CI/CD pipeline and deployment config must ensure it is absent in production builds.
- **`uploads/` path must not leak to client**: the download endpoint must resolve PDF paths server-side from `UPLOADS_DIR`; the client must only ever see `/api/resources/:id/download`, never an absolute path or bucket key.
- **`data/` and `uploads/` must be gitignored**: committing real resource files or store JSON with user data would be a privacy and repo-size issue.
- **`src/__tests__/gitignore.test.ts` and `src/__tests__/readme.test.ts`**: these scaffold-level tests may assert on the current exact state of `.gitignore` or `README.md`; adding new entries could cause them to fail if they use exact-match assertions — check their content before making changes.
- **No `async-mutex` in `package.json` yet**: if a mutex library is chosen over a hand-rolled promise queue, `package.json` gains a new runtime dependency that must be reviewed for licence and bundle impact.
- **Streaming in Next.js App Router route handlers**: Node `fs.createReadStream` must be bridged to a Web `ReadableStream` for the `Response` constructor. This is non-trivial boilerplate; a helper utility should be extracted and tested separately.
- **`metrics` route segment collision**: `src/app/api/resources/metrics/route.ts` uses a static segment `metrics` alongside the dynamic segment `[id]`. Next.js App Router resolves static segments before dynamic ones, so `/api/resources/metrics` will correctly hit the metrics route — but this must be verified against Next.js 15 routing behaviour to ensure no unexpected catch-all conflict.
