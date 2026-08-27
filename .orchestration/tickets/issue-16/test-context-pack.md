# Test context pack — issue-16

Verbatim excerpts from existing tests in this repo. Reuse these conventions.

## 1. API route test — `src/app/api/health/__tests__/route.test.ts`

```typescript
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

  it("works without DATABASE_URL", async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const response = await GET(new Request("http://localhost/api/health"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: "ok" });
    } finally {
      if (original !== undefined) {
        process.env.DATABASE_URL = original;
      }
    }
  });
});
```

**Conventions:**
- Direct import of route handler (`GET`, `POST`) from `@/app/api/.../route`
- Route handler called with `new Request("http://localhost/...")` 
- Assert `response.status`, `response.headers.get(...)`, and `await response.json()`
- Use `try/finally` for env var cleanup
- Test file location: colocated at `src/app/api/<path>/__tests__/route.test.ts`

## 2. Lib utility test pattern — `src/__tests__/env-config.test.ts`

```typescript
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const envExamplePath = path.join(repoRoot, ".env.example");

describe(".env.example", () => {
  it("exists and is non-empty", () => { ... });
  it("contains no real-looking secrets", () => { ... });
  it("contains at least one variable key", () => { ... });
});
```

**Conventions:**
- `describe` / `it` globals (Vitest globals: true)
- No `beforeEach`/`afterEach` unless needed for cleanup
- Direct assertions with `expect(...).toBe(...)`, `.toEqual(...)`, `.toMatch(...)`

## 3. Lib module — `src/lib/health.ts`

```typescript
export const HEALTH_STATUS = "ok" as const;
export type HealthStatus = typeof HEALTH_STATUS;
export type HealthPayload = { status: HealthStatus };
```

**Conventions:**
- Named exports (no default exports)
- `as const` for literal types
- Type exports alongside constants/functions

## 4. Test runner — Vitest config

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,  // describe, it, expect are global — no imports needed
  },
});
```

- **Test command:** `npm test` (runs `vitest run`)
- **Scoped:** `npx vitest run src/lib/__tests__/download-quota.test.ts`
- **Path alias:** `@/*` maps to `src/*`
- **No Jest** — this is Vitest; `vi.fn()`, `vi.mock()`, `vi.spyOn()` for mocking
- **No React Testing Library** installed yet — use `@testing-library/react` if needed for component tests (may need install)
