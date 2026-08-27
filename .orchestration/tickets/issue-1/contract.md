# Contract — issue-1: MVP Initialize Next.js Project Foundation

> **This file is the interface lock.** Coder and tester must treat every signature,
> shape, and invariant here as ground truth. Do not deviate without updating this file
> first and informing both workers.

---

## Disambiguation log

| Ambiguity | Resolution | Source |
|---|---|---|
| Test runner: Vitest vs Jest | **Vitest** — locked. `vitest.config.ts` is the config file; `npm test` maps to `vitest run`. Jest remains acceptable if an organisational constraint arises, but the tester's assertions are written against Vitest. | test-plan.md is explicit; plan.md says "recommended". |
| ESLint config format: flat vs legacy | **Flat config** (`eslint.config.mjs`) — locked. Next.js ≥14 supports and recommends flat config. | plan.md assumption, impact.md lists both; flat config wins. |
| Node.js version: 20.x vs 22.x | **20.x LTS** — locked. `.nvmrc` contains exactly `20`. `engines` field in `package.json` is `">=20"`. | plan.md says 20.x; impact.md mentions both; 20 is the lower-bound LTS the contract pins. |
| `format:check` vs `format -- --check` | **`format:check` script** is a first-class script in `package.json`. Tests may also invoke `npx prettier --check "src/**/*.{ts,tsx}"` as fallback. Coder must ensure `npm run format:check` exits 0. | test-plan.md mentions both variants; coder provides the named script. |
| `src/lib/` empty vs `.gitkeep` vs real file | **Real file** (`src/lib/health.ts`) — locked. The directory must not ship empty. | plan.md step 8 is explicit. |

---

## Interface 1 — `src/app/api/health/route.ts`

### Path
`src/app/api/health/route.ts`

### Exports
```typescript
export async function GET(request: Request): Promise<Response>
```

### Semantics
- **Pre-conditions:** None. The handler must not require `DATABASE_URL` or any external
  service to be present. `process.env.DATABASE_URL` may be `undefined`.
- **Post-conditions:**
  - Returns an HTTP `Response` with `status === 200`.
  - Response body, when parsed as JSON, deep-equals `{ status: "ok" }`.
  - Response `Content-Type` header includes `"application/json"`.
- **Invariants:**
  - The response payload is always the literal object `{ status: "ok" }` — no dynamic
    fields, no conditional branching based on environment.
  - The handler never throws; all errors (if any arise from `NextResponse.json`) must be
    caught and result in a 500, not an unhandled rejection. (In practice, the handler body
    is trivial and should never error.)

### Signature details
```typescript
import { NextResponse } from "next/server";

export async function GET(_request: Request): Promise<Response> {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
```
> **Import rule:** Use `NextResponse` from `"next/server"` — not from `"next"` or any
> other path. Do not use the global `Response` constructor directly (acceptable but not
> preferred — `NextResponse.json` sets `Content-Type` automatically).

### Errors
- No declared thrown errors. Handler is expected to always return 200.

### Side effects
- None. No DB writes, no logging beyond Next.js framework defaults, no network calls.

### NOT in contract
- Query-parameter handling.
- Authentication or rate-limiting.
- Any future `{ db: "ok" }` field (arrives in issue #3).

---

## Interface 2 — `src/lib/health.ts`

### Path
`src/lib/health.ts`

### Exports
```typescript
export const HEALTH_STATUS = "ok" as const;
export type HealthStatus = typeof HEALTH_STATUS;
export type HealthPayload = { status: HealthStatus };
```

### Semantics
- `HEALTH_STATUS` is the canonical string literal `"ok"` used by the route handler and
  tests. The route handler may import and use it instead of an inline string.
- `HealthPayload` is the shape of the JSON response body (`{ status: "ok" }`).
- These exports exist so downstream issues can extend or reuse the type without touching
  the route handler.

### Errors
- None; purely declarative.

### Side effects
- None.

### NOT in contract
- No runtime logic; no functions. This is a constants/types module only.
- Database status fields.

---

## Interface 3 — `.gitignore` (locked patterns)

### Path
`.gitignore`

### Required patterns (all must be present)
```
node_modules/
.next/
.env*.local
coverage/
```

> Additional patterns are permitted (build output, OS files, editor dirs, etc.) but the
> four above are the **minimum locked set** that tests assert.

### Semantics
- Must exist at repo root before `npm install` runs (per impact.md warning).
- The `.env*.local` pattern (glob) must match `.env.local`, `.env.development.local`,
  `.env.production.local`, etc.

### NOT in contract
- Exact ordering of lines.
- Additional IDE / OS patterns beyond the required four.

---

## Interface 4 — `package.json` (scripts + engines)

### Path
`package.json`

### Required script keys
```json
{
  "scripts": {
    "dev":          "next dev",
    "build":        "next build",
    "start":        "next start",
    "lint":         "next lint",
    "format":       "prettier --write .",
    "format:check": "prettier --check .",
    "test":         "vitest run"
  },
  "engines": {
    "node": ">=20"
  }
}
```

### Semantics
- Every script listed above must exist with the exact key name.
- `npm run lint` must exit 0 on the scaffolded, unchanged source.
- `npm run format:check` must exit 0 on the scaffolded, unchanged source.
- `npm run build` must exit 0 and produce a `.next/` directory.
- `npm test` must invoke Vitest and all tests must pass.
- `engines.node` is `">=20"` so CI enforces minimum Node 20.

### NOT in contract
- Exact version strings for dependencies (coder resolves at install time).
- Optional scripts beyond the seven listed.
- `private`, `name`, `version`, `description` field values (metadata, not behavioral).

---

## Interface 5 — `.nvmrc`

### Path
`.nvmrc`

### Content
```
20
```

### Semantics
- Contains exactly the string `20` (optionally followed by a newline).
- Must be present at repo root.
- Consistent with `engines.node >=20` in `package.json`.

### NOT in contract
- Whether the patch version (e.g. `20.15.0`) is pinned — major version is sufficient.

---

## Interface 6 — `tsconfig.json` (required compiler options)

### Path
`tsconfig.json`

### Required options (minimum locked set)
```json
{
  "compilerOptions": {
    "strict": true,
    "jsx": "preserve",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    },
    "noEmit": false
  }
}
```

### Semantics
- `tsc --noEmit` run from repo root must exit with code 0 on the scaffolded source.
- Path alias `@/*` maps to `./src/*` so `import { HEALTH_STATUS } from "@/lib/health"`
  resolves correctly.
- `strict: true` is non-negotiable — no loosening.

### NOT in contract
- `target`, `lib`, `outDir`, `baseUrl` exact values (coder follows Next.js defaults).
- Whether `isolatedModules`, `esModuleInterop`, or other common Next.js options are
  present (acceptable, not required by tests).

---

## Interface 7 — `next.config.ts`

### Path
`next.config.ts`

### Minimum shape
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

### Semantics
- Must be a valid TypeScript module that exports a `NextConfig` object as default.
- `npm run build` must succeed with this config in place.
- No experimental flags are required for this ticket.

### NOT in contract
- Any specific `nextConfig` property values (none required at this stage).

---

## Interface 8 — ESLint config (`eslint.config.mjs`)

### Path
`eslint.config.mjs`

### Required behavior
- Extends Next.js `core-web-vitals` rules.
- Includes Prettier compatibility (via `eslint-config-prettier` or equivalent) so ESLint
  does not report formatting violations that Prettier owns.
- `npm run lint` exits 0 on the unmodified scaffolded source.

### Minimum shape (illustrative, not prescriptive line-for-line)
```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "prettier"),
];

export default eslintConfig;
```

### NOT in contract
- Rule overrides beyond disabling Prettier conflicts.
- Specific plugin versions.

---

## Interface 9 — Prettier config (`.prettierrc`)

### Path
`.prettierrc`

### Required behavior
- Must be a valid Prettier config (JSON or YAML object).
- `npm run format:check` exits 0 on the unmodified scaffolded source.
- Config must be deterministic (no random or time-dependent options).

### Minimum shape
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "printWidth": 100
}
```

> Exact values are at coder discretion; the shape above is illustrative. The invariant is
> that formatting is idempotent: running `format` then `format:check` always exits 0.

### NOT in contract
- Exact values for style options.
- `.prettierignore` content beyond it existing (build artifacts, `node_modules`, `.next`
  should be excluded to avoid formatting generated code).

---

## Interface 10 — `.env.example`

### Path
`.env.example`

### Required behavior
- File exists at repo root.
- Content is non-empty.
- At least one variable key is present (matches `/^[A-Z_]+=.*/m`).
- No line contains a real-looking secret: no line matches
  `/(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}/i`.
- File is **not** gitignored (it is documentation, not a live config).
- `.env*.local` **is** gitignored (by Interface 3).

### Minimum content (illustrative)
```
# Application environment
# Copy this file to .env.local and fill in real values before running locally.
# Real variables for database, auth, etc. arrive in issues #2 and #3.

APP_ENV=development
# DATABASE_URL=postgresql://user:password@localhost:5432/teacher_hub
```

### NOT in contract
- Exact variable names (placeholders only; real vars in issues #2/#3).

---

## Interface 11 — `src/app/layout.tsx`

### Path
`src/app/layout.tsx`

### Required shape
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teacher Hub",
  description: "...",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### Semantics
- Must be a valid Next.js App Router root layout: exports `metadata` and a default
  function that renders `<html>` and `<body>`.
- `npm run build` must succeed with this layout in place.

### NOT in contract
- Fonts, global CSS imports, providers (none required at this stage).

---

## Interface 12 — `src/app/page.tsx`

### Path
`src/app/page.tsx`

### Required shape
```tsx
export default function HomePage() {
  return <main>Teacher Hub</main>;
}
```

### Semantics
- Must be a valid App Router page: default export is a React component.
- No state, no effects, no data fetching required for this ticket.

### NOT in contract
- Styling, navigation, or any feature UI.

---

## Interface 13 — `vitest.config.ts`

### Path
`vitest.config.ts`

### Required shape
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
  },
});
```

### Semantics
- `npm test` (`vitest run`) must discover and execute all `*.test.ts` / `*.test.tsx`
  files under `src/`.
- Path aliases (`@/*`) must resolve correctly in tests (via `tsconfigPaths` or
  equivalent).
- Test environment is `"node"` for route handler tests (no browser globals needed).

### NOT in contract
- Exact plugin configuration beyond what is necessary for path alias resolution.
- Coverage provider configuration (optional; not asserted by tests).

---

## Interface 14 — Test files (structure lock)

### Files and their required `describe`/`it` structure

#### `src/app/api/health/__tests__/route.test.ts`
```typescript
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns 200 with { status: 'ok' }", async () => { /* ... */ });
  it("works without DATABASE_URL", async () => { /* ... */ });
});
```

#### `src/__tests__/typescript.test.ts`
```typescript
import { spawnSync } from "child_process";

describe("TypeScript compilation", () => {
  it("tsc --noEmit exits 0", () => { /* ... */ });
});
```

#### `src/__tests__/env-config.test.ts`
```typescript
import fs from "fs";

describe(".env.example", () => {
  it("exists and is non-empty", () => { /* ... */ });
  it("contains no real-looking secrets", () => { /* ... */ });
  it("contains at least one variable key", () => { /* ... */ });
});
```

#### `src/__tests__/scripts.test.ts`
```typescript
import { spawnSync } from "child_process";

describe("npm scripts", () => {
  it("npm run lint exits 0", () => { /* ... */ });
  it("npm run format:check exits 0", () => { /* ... */ });
  it("npm run build exits 0 and produces .next/", () => { /* ... */ }, 120_000);
});
```

#### `src/__tests__/gitignore.test.ts`
```typescript
import fs from "fs";

describe(".gitignore", () => {
  it("ignores node_modules", () => { /* ... */ });
  it("ignores .next", () => { /* ... */ });
  it("ignores .env*.local", () => { /* ... */ });
  it("ignores coverage", () => { /* ... */ });
});
```

#### `src/__tests__/readme.test.ts`
```typescript
import fs from "fs";

describe("README.md", () => {
  it("exists", () => { /* ... */ });
  it("documents npm install", () => { /* ... */ });
  it("documents npm run dev or npm start", () => { /* ... */ });
  it("documents folder/architecture", () => { /* ... */ });
  it("documents env config", () => { /* ... */ });
});
```

### Import rule for route handler tests
```typescript
import { GET } from "@/app/api/health/route";
// NOT: import { GET } from "../../app/api/health/route"
// NOT: import { GET } from "../../../src/app/api/health/route"
```
The `@/` alias must be used; relative imports are forbidden for cross-directory imports in
tests.

---

## Interface 15 — `README.md` (required sections)

### Path
`README.md`

### Required content (assertions in test 9)
| Section | Minimum content | Regex tested |
|---|---|---|
| Install | `npm install` | `/npm install/i` |
| Start/dev | `npm run dev` or `npm start` | `/npm run dev\|npm start/i` |
| Folder / architecture | References `src/app`, `folder structure`, or `architecture` | `/src\/app\|folder structure\|architecture/i` |
| Env config | References `.env` or `environment variable` | `/\.env\|environment variable/i` |

### NOT in contract
- Exact wording, heading names, or ordering of sections.
- Badges, screenshots, contributing guides.

---

## Acceptance criterion traceability

| Criterion | Interfaces |
|---|---|
| **AC-1** — Valid TypeScript Next.js app | 1, 5, 6, 7, 11, 12 |
| **AC-2** — Env-variable strategy documented; no secrets committed | 3, 10 |
| **AC-3** — `GET /api/health` returns 2xx + `{ status: "ok" }` | 1, 2 |
| **AC-4** — Lint + format scripts exit 0 | 4, 8, 9 |
| **AC-5** — README documents startup, architecture, env config | 15 |
| **AC-6** — CI-ready build script passes | 4, 6, 7 |
