# Implementation plan

## Goal
A working, conventions-driven Next.js (TypeScript, App Router) skeleton that a developer can clone, install, lint, test, build, and run — exposing `GET /api/health` returning `{ status: "ok" }` — with documentation for every downstream MVP issue to build on.

## Approach
This is pure greenfield scaffolding: the repo holds only `.orchestration/` metadata, so every change is an additive file creation with zero indirect impact. The direction from `solution.md` is a modern Next.js app: TypeScript for type safety, App Router for clean file-based routing and colocated API handlers, and a three-way source split — `src/app/` (UI/layout), `src/app/api/` (route handlers), `src/lib/` (shared utilities). We translate that "what" into concrete config files and a minimal but real feature surface.

The single proof-of-life feature is a DB-free health-check route handler at `src/app/api/health/route.ts` exporting an async `GET` that returns `NextResponse.json({ status: "ok" })` with HTTP 200. It has no external dependency so it stays green before issue #3 provisions PostgreSQL. This is the one piece of behavior a test can meaningfully assert.

Tooling is wired through `package.json` scripts so the same commands run locally and in CI: `dev`, `build`, `start`, `lint`, `format`, `test`. ESLint (extending Next's `core-web-vitals` + Prettier compatibility) and Prettier enforce style; a lightweight test runner (Vitest recommended — lighter with App Router, but Jest is acceptable) runs at least one real passing test. Node is pinned to an active LTS (20.x) via `.nvmrc` and `engines` so local and CI match.

Ordering matters in one specific way flagged by `impact.md`: `.gitignore` must exist **before** `npm install`, or `node_modules/` risks being staged. So config and ignore files come first, dependency install second, source and tests third, docs last.

## Steps
1. **Ignore + Node pin** — Create `.gitignore` (`node_modules/`, `.next/`, `.env*.local`, `coverage/`, build output) and `.nvmrc` (`20`). Depends on: none. *(Must precede install.)*
2. **Manifest + scripts** — Create `package.json` with metadata, `engines.node >=20`, deps (`next`, `react`, `react-dom`), devDeps (`typescript`, `@types/*`, `eslint`, `eslint-config-next`, `prettier`, `eslint-config-prettier`, test runner + types), and scripts: `dev`, `build`, `start`, `lint`, `format`, `format:check`, `test`. Depends on: none.
3. **Install dependencies** — Run `npm install` to generate `node_modules/` and `package-lock.json`. Depends on: steps 1, 2.
4. **TypeScript + Next config** — Create `tsconfig.json` (strict, `jsx: preserve`, path alias `@/* → src/*`, `moduleResolution: bundler`) and `next.config.ts`. Depends on: step 3.
5. **Lint + format config** — Create ESLint config (`eslint.config.mjs` flat config extending Next + disabling rules that conflict with Prettier), `.prettierrc`, `.prettierignore`. Depends on: step 3.
6. **Root UI shell** — Create `src/app/layout.tsx` (root layout with `<html>`/`<body>`, required by App Router) and `src/app/page.tsx` (minimal placeholder landing page). Depends on: step 4.
7. **Health-check route** — Create `src/app/api/health/route.ts` exporting `async function GET()` returning `NextResponse.json({ status: "ok" }, { status: 200 })`. Depends on: step 4.
8. **Shared utilities placeholder** — Create `src/lib/` with a real minimal utility (e.g. `src/lib/health.ts` exporting the status payload/constant) so the folder is meaningful and importable, not an empty `.gitkeep`. Depends on: step 4.
9. **Test runner config + test** — Create test runner config (`vitest.config.ts` or `jest.config.ts`) and one passing test asserting the health handler returns 200 and `{ status: "ok" }`. Depends on: steps 3, 7, 8.
10. **Environment template** — Create `.env.example` with documented placeholder vars (e.g. `# APP_ENV=development`) and a note that downstream #2/#3 add real vars; confirm `.env*.local` is gitignored. Depends on: step 1.
11. **Verify pipeline** — Run `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and confirm each exits 0; boot `npm run dev` and curl `/api/health` for a 200. Depends on: steps 4–10. *(Checkpoint: all green before docs.)*
12. **README** — Create `README.md`: tech stack, prerequisites (Node 20 / `.nvmrc`), setup (clone → copy `.env.example` to `.env.local` → `npm install` → `npm run dev`), folder-layout table (`src/app`, `src/app/api`, `src/lib`), env-config section, and the full CI-ready script list. Depends on: step 11.

## Files
### Create
- `.gitignore` — exclude deps, build artifacts, local env files, coverage.
- `.nvmrc` — pin Node LTS (`20`).
- `package.json` — metadata, deps, `engines`, CI-ready scripts.
- `package-lock.json` — generated lockfile (do not hand-edit).
- `tsconfig.json` — strict TS + `@/*` path alias.
- `next.config.ts` — Next.js configuration.
- `eslint.config.mjs` — ESLint flat config (Next + Prettier-compatible).
- `.prettierrc` / `.prettierignore` — formatting rules + ignores.
- `.env.example` — documented env-var template, no secrets.
- `src/app/layout.tsx` — root layout.
- `src/app/page.tsx` — placeholder landing page.
- `src/app/api/health/route.ts` — `GET /api/health` → `{ status: "ok" }` (200).
- `src/lib/health.ts` — shared status payload/util.
- `vitest.config.ts` (or `jest.config.ts`) — test runner config.
- `src/app/api/health/route.test.ts` (or `__tests__/`) — one passing test.
- `README.md` — setup, architecture, tech stack, env config.

### Modify
- None (greenfield).

### Delete
- None.

## Data / schema / migration
None. The health endpoint is deliberately DB-free; PostgreSQL and any schema arrive in issue #3.

## Rollout
- **Feature flag:** No — foundational scaffolding, nothing to gate.
- **Backfill:** No.
- **Ordering:** `.gitignore` must exist before `npm install` (step 1 before step 3). No deploy-ordering constraints; not deployed by this ticket. GitHub Actions workflow YAML is explicitly out of scope — only the scripts are CI-ready.

## Assumptions and non-decisions
- **Language/router/PM:** TypeScript + App Router + npm, per `solution.md`.
- **Node:** 20.x LTS pinned; coder may choose 22.x if preferred, but must pin consistently in `.nvmrc` and `engines`.
- **Test runner:** Vitest recommended (lighter with App Router); Jest acceptable — coder's judgment. Config filename follows the chosen runner.
- **ESLint format:** Flat config (`eslint.config.mjs`) assumed for current Next.js; legacy `.eslintrc.json` acceptable if the scaffolded Next version defaults to it.
- **Next version:** latest stable at implementation time; coder resolves exact versions.
- Exact `.env.example` variable names are illustrative placeholders; real vars land with #2/#3.

## Not doing
- No authentication, DB connection, schema, or migrations (issues #2, #3).
- No teacher-facing feature UI (issues #4–#8).
- No CI provider config / GitHub Actions workflow YAML.
- No git hooks (Husky/lint-staged), deployment, or hosting/infra setup.
- No component library, styling system, or state management beyond the minimal placeholder page.
