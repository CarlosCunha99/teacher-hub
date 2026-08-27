# Test Context Pack — issue-17

## Source: `src/app/api/health/__tests__/route.test.ts` (API route handler test pattern)

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

## Source: `src/__tests__/env-config.test.ts` (env/config assertion pattern)

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

  it("contains no real-looking secrets", () => {
    const content = fs.readFileSync(envExamplePath, "utf-8");
    expect(content).not.toMatch(/(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}/i);
  });
});
```

## Key conventions to follow:

1. **Test runner:** Vitest 3.x, `environment: "node"`, `globals: true` (describe/it/expect available globally)
2. **Path aliases:** `@/` maps to `src/` — use in imports
3. **API route handler tests:** call handler functions directly with `new Request("http://localhost/...")` — no HTTP server needed
4. **Async style:** async/await throughout
5. **Test file co-location:** tests live in `__tests__/` subdirectory next to the file being tested (e.g. `src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts`) or in `src/__tests__/` for standalone utilities
6. **Response inspection:** `await response.json()` for body, `response.status` for status code
7. **No test framework imports needed** for describe/it/expect (globals: true)
8. **Environment variable override pattern:** save, override, try/finally restore
