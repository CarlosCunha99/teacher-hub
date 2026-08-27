# Implementation context (shared A/B brief)

> This brief is for both the **coder** and the **tester**. Read it before touching any
> file. It captures codebase conventions, utilities to reuse, and commands that are
> verified to work.

---

## Files this touches

- `.gitignore` — exclude `node_modules/`, `.next/`, `.env*.local`, `coverage/` from git tracking
- `.nvmrc` — pin Node.js to major version `20`
- `package.json` — project metadata, runtime/dev dependencies, `engines`, and all npm scripts
- `package-lock.json` — auto-generated lockfile (do not edit by hand)
- `tsconfig.json` — TypeScript strict mode, `jsx: preserve`, `moduleResolution: bundler`, `@/*` path alias
- `next.config.ts` — minimal Next.js configuration (TypeScript module, empty config object)
- `eslint.config.mjs` — ESLint flat config extending Next.js `core-web-vitals` + Prettier compatibility
- `.prettierrc` — Prettier formatting rules (idempotent, deterministic)
- `.prettierignore` — exclude build artifacts and generated files from Prettier
- `.env.example` — documented environment variable template, no secrets, not gitignored
- `src/app/layout.tsx` — Next.js App Router root layout; required to render `<html>/<body>`
- `src/app/page.tsx` — minimal placeholder landing page (no features)
- `src/app/api/health/route.ts` — App Router route handler; exports `GET` returning 200 + `{ status: "ok" }`
- `src/lib/health.ts` — shared `HEALTH_STATUS` constant and `HealthPayload` type
- `vitest.config.ts` — Vitest test runner configuration with React plugin and path alias support
- `src/app/api/health/__tests__/route.test.ts` — unit tests for the health route handler (Tests 1, 2)
- `src/__tests__/typescript.test.ts` — asserts `tsc --noEmit` exits 0 (Test 3)
- `src/__tests__/env-config.test.ts` — asserts `.env.example` structure (Test 4)
- `src/__tests__/scripts.test.ts` — asserts lint, format:check, and build scripts exit 0 (Tests 5–7)
- `src/__tests__/gitignore.test.ts` — asserts required `.gitignore` patterns (Test 8)
- `src/__tests__/readme.test.ts` — asserts required README sections exist (Test 9)
- `README.md` — setup instructions, folder layout, tech stack, env config documentation

---

## Patterns to follow

- **Naming:** `camelCase` for functions and variables; `PascalCase` for React components,
  TypeScript interfaces, and type aliases; `SCREAMING_SNAKE_CASE` for module-level
  constants (e.g. `HEALTH_STATUS`); `kebab-case` for file and directory names.
- **Error handling:** Throw for unrecoverable setup/config errors (e.g. missing required
  env at startup). For App Router API handlers, return `NextResponse.json(...)` with an
  appropriate HTTP status rather than throwing. Never let a route handler propagate an
  unhandled rejection.
- **Async style:** `async/await` throughout. No callbacks, no bare `.then()` chains. All
  App Router handlers are `async function`. Node.js `child_process.spawnSync` is
  acceptable in tests (synchronous by design for script assertions).
- **Testing style:** Vitest with Jest-compatible API (`describe`, `it`, `expect`).
  Arrange / Act / Assert structure inside each `it` block. No shared mutable state across
  tests. `beforeEach`/`afterEach` for environment variable cleanup. Tests that spawn
  subprocesses must set an explicit timeout (`120_000` ms for build, `30_000` ms for
  lint/format).
- **Module imports:** Use the `@/` path alias for cross-directory imports (e.g.
  `import { HEALTH_STATUS } from "@/lib/health"`). Relative imports (`../../../`) are
  only acceptable within the same feature folder.
- **React imports:** Next.js App Router does not require `import React from "react"` at
  the top of every file (React 17+ JSX transform). Include only when `React.ReactNode`
  or other React types are used explicitly.

---

## Utilities to reuse

- `next/server::NextResponse` — Use `NextResponse.json(body, { status })` in all App
  Router route handlers. It sets `Content-Type: application/json` automatically. Do not
  use the raw `Response` constructor unless there is a specific reason.
- `src/lib/health.ts::HEALTH_STATUS` — Import in `route.ts` and in tests to avoid
  duplicating the string literal `"ok"`.
- `src/lib/health.ts::HealthPayload` — Use as the TypeScript return type annotation for
  the JSON body where needed.
- Node.js built-in `child_process::spawnSync` — Used in functional tests
  (`scripts.test.ts`, `typescript.test.ts`) to invoke CLI commands synchronously.
- Node.js built-in `fs::readFileSync` / `fs::existsSync` — Used in file-assertion tests
  (`.gitignore`, `.env.example`, `README.md`). Import as `import fs from "fs"` or
  `import { readFileSync, existsSync } from "fs"`.
- `path::resolve` — Use `path.resolve(__dirname, "../../../..")` (or equivalent) to
  compute `repoRoot` in test files. Adjust depth based on the test file's actual location
  relative to repo root.

---

## Anti-patterns in this codebase

- **Do not hard-depend on `DATABASE_URL` or any DB driver in the health route.** The
  route must return 200 even when no database is configured. DB integration arrives in
  issue #3.
- **Do not create `.gitignore` after `npm install`.** `.gitignore` must be created first
  or `node_modules/` risks being staged.
- **Do not use relative imports across feature boundaries in tests.** Always use the
  `@/` alias so refactors don't silently break import paths.
- **Do not add `"use client"` to route handlers** (`src/app/api/**`). Route handlers are
  always server-side; the directive is meaningless and causes a lint error.
- **Do not import `next/headers` or `next/navigation` in the health route.** These
  modules require the Next.js server context and would break unit tests that call `GET`
  directly without a running server.
- **Do not use `lodash` or other utility libraries.** This project has no such dependency
  and should not acquire one for trivial operations.
- **Do not add a GitHub Actions workflow YAML.** CI configuration is explicitly out of
  scope for this ticket. Only npm scripts are required.
- **Do not leave `src/lib/` empty or with only a `.gitkeep`.** It must contain the real
  `health.ts` utility file.
- **Do not commit secrets.** `.env.example` must contain only placeholder values.
  `.env*.local` must be gitignored.

---

## Repo commands (verified at contract-write time — greenfield, no source yet)

- **Test:** `npm test` (maps to `vitest run`)
- **Lint:** `npm run lint` (maps to `next lint`)
- **Format check:** `npm run format:check` (maps to `prettier --check .`)
- **Format write:** `npm run format` (maps to `prettier --write .`)
- **Type check:** `npx tsc --noEmit`
- **Build:** `npm run build` (maps to `next build`)
- **Dev server:** `npm run dev` (maps to `next dev`)

> Commands above will only work after `npm install` has been run. Run `nvm use` (or
> `fnm use`) first if your local Node version differs from `.nvmrc`.

---

## Creation order constraint

The following creation order is **mandatory** (per impact.md warning):

1. `.gitignore` — must exist before `npm install`
2. `package.json` — must exist before `npm install`
3. `npm install` — generates `node_modules/` and `package-lock.json`
4. All other files may be created in any order after step 3

Failure to create `.gitignore` before `npm install` risks `node_modules/` being staged
by git.
