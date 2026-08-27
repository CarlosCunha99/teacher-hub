# Test context pack — Issue 8

## Existing test examples (same framework, patterns, and fixtures)

### Example 1: API route test (Vitest, async)
From `src/app/api/health/__tests__/route.test.ts`:

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

**Patterns:** describe/it blocks, async/await, expect() assertions, setup/teardown via finally blocks.

### Example 2: Unit test with filesystem mocking
From `src/__tests__/env-config.test.ts`:

```typescript
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

**Patterns:** describe/it, single assertion per test, no async, direct module imports, regex matchers.

## Test runner commands
- Run all: `npm run test` or `npx vitest run`
- Watch: `npx vitest`
- Filter by pattern: `npx vitest --grep "pattern"`

## Framework: Vitest
- Uses Jest-compatible syntax (describe, it, expect)
- Assertion library: expect() from Vitest
- No need for explicit setup/teardown unless state persists
