# Test context pack

This pack captures existing Vitest conventions in this repo for the tester to reuse.

## Excerpt 1 — API route testing style

**File:** `src/app/api/health/__tests__/route.test.ts`

```ts
import { GET } from "@/app/api/health/route";
import { HEALTH_STATUS } from "@/lib/health";

describe("GET /api/health", () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const response = await GET(new Request("http://localhost/api/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body).toEqual({ status: HEALTH_STATUS });
  });
});
```

## Excerpt 2 — env/config file assertions

**File:** `src/__tests__/env-config.test.ts`

```ts
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const envExamplePath = path.join(repoRoot, ".env.example");

describe(".env.example", () => {
  it("exists and is non-empty", () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);
    const content = fs.readFileSync(envExamplePath, "utf-8");
    expect(content.trim().length).toBeGreaterThan(0);
  });
});
```

## Excerpt 3 — documentation assertions

**File:** `src/__tests__/readme.test.ts`

```ts
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const readmePath = path.join(repoRoot, "README.md");

describe("README.md", () => {
  it("exists", () => {
    expect(fs.existsSync(readmePath)).toBe(true);
  });
});
```

## Excerpt 4 — command execution style

**File:** `src/__tests__/scripts.test.ts`

```ts
import { spawnSync } from "child_process";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

describe("npm scripts", () => {
  it("npm run lint exits 0", () => {
    const result = spawnSync("npm", ["run", "lint"], {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 30_000,
    });
    expect(result.status).toBe(0);
  }, 30_000);
});
```

## Excerpt 5 — compile check style

**File:** `src/__tests__/typescript.test.ts`

```ts
import { spawnSync } from "child_process";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

describe("TypeScript compilation", () => {
  it("tsc --noEmit exits 0", () => {
    const result = spawnSync("npx", ["tsc", "--noEmit"], {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 60_000,
    });
    expect(result.status).toBe(0);
  });
});
```
