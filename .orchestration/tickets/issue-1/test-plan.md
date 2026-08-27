# Test plan

## Coverage summary

- Unit tests: **4** new, 0 updated
- Functional/integration tests: **5** new, 0 updated
- Existing regression tests preserved: **N/A** — no existing tests in repo (greenfield)

---

## Test runner

**Framework decision: Vitest**

Vitest is chosen over Jest for three reasons:
1. Native ESM support with zero-config, which avoids transform friction with Next.js App Router's module conventions.
2. Significantly faster cold starts (no Babel transform layer by default).
3. Compatible Jest-style API (`describe`, `it`, `expect`) so the pattern is familiar to Jest users.

> If the implementer chooses Jest (e.g. for organisational standardisation), the test structure below remains identical; only config files and import paths change.

- **Framework:** Vitest
- **Config file:** `vitest.config.ts`
- **Command (all tests):** `npm test` (mapped to `vitest run` in `package.json`)
- **Fast subset (only new tests):**
  `npx vitest run src/app/api/health/__tests__/ src/__tests__/`

---

## Behaviors to test

### Unit

---

**1. Health route returns 200 with `{ status: "ok" }`** — The `GET /api/health` handler, called directly (not over HTTP), returns a `Response` with status `200` and a JSON body equal to `{ status: "ok" }`.

- File: `src/app/api/health/__tests__/route.test.ts` (new)
- Key assertions:
  - `response.status === 200`
  - `await response.json()` deep-equals `{ status: "ok" }`
  - `response.headers.get("content-type")` includes `"application/json"`
- Setup: Import the named `GET` export from `src/app/api/health/route.ts` directly. Call it with a minimal `Request` object (`new Request("http://localhost/api/health")`). No server or DB needed.
- Maps to acceptance criterion: **AC-3** (health-check returns 2xx + machine-readable body)

---

**2. Health route does not depend on any external service** — The `GET` handler completes successfully when no database or network service is available (i.e., no env vars for DB are set).

- File: `src/app/api/health/__tests__/route.test.ts` (new, additional `it` block in same file)
- Key assertions:
  - Handler resolves (does not throw) when `DATABASE_URL` is undefined / absent from `process.env`
  - Response status is still `200`
- Setup: Within the test, delete `process.env.DATABASE_URL` before invoking `GET`; restore it after (use `beforeEach`/`afterEach` guards). No mock of a DB driver needed — the handler should never import one.
- Maps to acceptance criterion: **AC-3** + **Edge case: health-check works before DB provisioned**

---

**3. TypeScript compilation produces no type errors** — Running `tsc --noEmit` exits with code `0` on the scaffolded source tree.

- File: `src/__tests__/typescript.test.ts` (new)
- Key assertions:
  - `spawnSync("npx", ["tsc", "--noEmit"])` exits with code `0`
  - `stdout` and `stderr` contain no error lines
- Setup: Use Node's `child_process.spawnSync` inside the test body. Requires `tsconfig.json` to be present and valid. No mocks.
- Maps to acceptance criterion: **AC-1** (project is a valid TypeScript Next.js app) + **AC-6** (CI-ready build)

> _Note: this is technically a shell integration test wrapped in a test runner; it is placed here because it validates a single atomic behaviour (TS clean) rather than a user-visible flow._

---

**4. `.env.example` documents env vars and contains no secret values** — The file exists, is non-empty, and all values are placeholder strings (no credentials).

- File: `src/__tests__/env-config.test.ts` (new)
- Key assertions:
  - `fs.existsSync(".env.example")` is `true`
  - File content is a non-empty string
  - No line matches `/(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}/i` (heuristic: no real-looking secret value)
  - At least one variable key is present (`/^[A-Z_]+=.*/m` matches)
- Setup: Read file from repo root via `fs.readFileSync`. No mocks.
- Maps to acceptance criterion: **AC-2** (env-variable strategy documented; no secrets committed)

---

### Functional / integration

---

**5. `npm run lint` exits successfully on the clean scaffolded codebase** — ESLint finds no errors (exit code `0`) when run against the scaffolded source files.

- File: `src/__tests__/scripts.test.ts` (new)
- Preconditions: Dependencies installed (`node_modules/` present); scaffolded source files are lint-clean.
- Actions: `spawnSync("npm", ["run", "lint"], { cwd: repoRoot })` within the test.
- Assertions:
  - `result.status === 0`
  - `result.stderr` does not contain `"error"` at the start of a lint report line
- Cleanup: None; read-only operation.
- Maps to acceptance criterion: **AC-4** (lint script configured and exits 0) + **Edge case: scripts are deterministic/non-interactive**

---

**6. `npm run format -- --check` exits successfully on the clean scaffolded codebase** — Prettier finds no formatting violations (exit code `0`) against scaffolded files.

- File: `src/__tests__/scripts.test.ts` (new, additional `it` block)
- Preconditions: Dependencies installed; source files formatted.
- Actions: `spawnSync("npm", ["run", "format", "--", "--check"], { cwd: repoRoot })`
  _If the format script does not accept `--check`, invoke `npx prettier --check "src/**/*.{ts,tsx}"` directly._
- Assertions:
  - `result.status === 0`
- Cleanup: None.
- Maps to acceptance criterion: **AC-4** (formatting script exits 0) + **Edge case: deterministic/non-interactive**

---

**7. `npm run build` exits successfully and produces a `.next/` output directory** — The Next.js production build completes without errors.

- File: `src/__tests__/scripts.test.ts` (new, additional `it` block)
- Preconditions: Dependencies installed; valid `next.config.ts`/`tsconfig.json` present.
- Actions: `spawnSync("npm", ["run", "build"], { cwd: repoRoot, timeout: 120_000 })`
- Assertions:
  - `result.status === 0`
  - `fs.existsSync(path.join(repoRoot, ".next"))` is `true` after build
- Cleanup: The `.next/` directory is already gitignored; no special teardown needed.
- Maps to acceptance criterion: **AC-6** (CI-ready build script passes) + **AC-1** (valid Next.js app)

> _This test has a longer timeout (2 min) — mark with `{ timeout: 120_000 }` in Vitest or use Jest's `jest.setTimeout`._

---

**8. `.gitignore` excludes sensitive and generated paths** — The `.gitignore` file exists and lists all required ignore patterns.

- File: `src/__tests__/gitignore.test.ts` (new)
- Preconditions: `.gitignore` present at repo root.
- Actions: Parse `.gitignore` via `fs.readFileSync`; check for required patterns.
- Assertions (one assertion per axis, per the independent-axis testing rule):
  - Pattern for `node_modules` or `node_modules/` is present
  - Pattern for `.next` or `.next/` is present
  - Pattern for `.env*.local` or `.env.local` is present (covers the family of local env files)
  - Pattern for `coverage` or `coverage/` is present
- Cleanup: None; read-only.
- Maps to acceptance criterion: **AC-2** (local env files gitignored) + **Edge cases: `.env*.local` gitignored; no secrets committed**

---

**9. README contains required documentation sections** — The `README.md` exists and contains content for startup, architecture, and env config.

- File: `src/__tests__/readme.test.ts` (new)
- Preconditions: `README.md` present at repo root and non-empty.
- Actions: Read `README.md` via `fs.readFileSync`; assert against content (case-insensitive).
- Assertions (one per axis):
  - File exists: `fs.existsSync("README.md")` is `true`
  - Contains install instructions: content matches `/npm install/i`
  - Contains start/dev instructions: content matches `/npm run dev/i` or `/npm start/i`
  - Contains folder/architecture section: content matches `/src\/app|folder structure|architecture/i`
  - Contains env config section: content matches `/\.env|environment variable/i`
- Cleanup: None; read-only.
- Maps to acceptance criterion: **AC-5** (README documents startup, architecture, env config)

---

## Edge cases covered

| Edge case (from ticket) | Tested by |
|---|---|
| `.env*.local` and build artifacts gitignored | **Test 8** — gitignore assertions; **Test 4** — `.env.example` documented |
| Health-check works before PostgreSQL is provisioned (no DB dependency) | **Test 2** — handler called without `DATABASE_URL` in env |
| Lint/format/build scripts deterministic and non-interactive | **Tests 5, 6, 7** — scripts invoked via `spawnSync` (non-interactive by definition); exit code asserted |
| Node.js version pinned or documented | **Not tested with an automated assertion** — see "Not tested" below |

---

## Not tested (with reason)

| Item | Reason |
|---|---|
| Node.js version pinned (`.nvmrc` or `engines` field) | Presence can be checked by reading a file, but correctness (is it the right LTS?) is environment-dependent and subjective. Covered by README documentation requirement (Test 9 asserts an env/setup section exists); a human reviewer should confirm the actual version value. |
| `npm run start` (production server responding over HTTP) | Requires spawning a long-lived process and making HTTP calls, which introduces timing/port flakiness. The health-check behaviour is validated at the unit level (Test 1); E2E HTTP validation is out of scope for this foundation ticket. |
| GitHub Actions CI workflow YAML | Explicitly out of scope per ticket — only "CI-ready scripts" are required, not a wired pipeline. |
| Folder structure contains `src/lib/` | `src/lib/` may ship as an empty directory or `.gitkeep`; `git ls-files` won't list empty dirs. Covered by README documentation assertion (Test 9) and is straightforward to verify manually during review. |
| Accessibility, i18n, performance, security hardening | Explicitly out of scope per ticket. |
| Downstream issues (#2–#8) functionality | Out of scope; this ticket is foundation-only. |

---

## Fixtures & data

| Fixture / data | Location | Notes |
|---|---|---|
| Repo root path constant | Top of each test file: `const repoRoot = path.resolve(__dirname, "../../../..")` | Adjust depth based on actual file placement; all script tests share this pattern |
| Minimal `Request` object for unit tests | Inline in `route.test.ts`: `new Request("http://localhost/api/health")` | No shared fixture file needed; constructor is standard Web API |
| `.env.example` file | Repo root (created by implementation) | Read-only in tests; not modified |
| `.gitignore` file | Repo root (created by implementation) | Read-only in tests; not modified |
| `README.md` | Repo root (created by implementation) | Read-only in tests; not modified |

No shared fixture files, factories, or database seeds are required for this foundation ticket.

---

## Test file summary

| File | New / Modified | Tests inside |
|---|---|---|
| `src/app/api/health/__tests__/route.test.ts` | **New** | Tests 1, 2 |
| `src/__tests__/typescript.test.ts` | **New** | Test 3 |
| `src/__tests__/env-config.test.ts` | **New** | Test 4 |
| `src/__tests__/scripts.test.ts` | **New** | Tests 5, 6, 7 |
| `src/__tests__/gitignore.test.ts` | **New** | Test 8 |
| `src/__tests__/readme.test.ts` | **New** | Test 9 |

**Total: 6 new test files, 9 test cases (4 unit + 5 functional/integration)**
