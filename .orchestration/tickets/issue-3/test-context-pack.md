# Test context pack — issue-3

## Existing test examples (conventions)

### Example 1: env-config.test.ts — configuration file testing

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

  it("contains at least one variable key", () => {
    const content = fs.readFileSync(envExamplePath, "utf-8");

    expect(content).toMatch(/^[A-Z_]+=.*/m);
  });
});
```

**Conventions used:**
- File-based, text assertions (read + regex)
- Simple `describe` + `it` structure
- No setup/teardown
- Assertions via `expect()` matcher API

### Example 2: health route test — handler testing

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

**Conventions used:**
- Direct function import and call
- Async test support (`async () => {}`)
- Cleanup in finally block (env var restoration)
- Response object assertions
- JSON parsing and validation

## Test runner

- **Framework:** Vitest
- **Command (all):** `npm test`
- **Config file:** `vitest.config.ts` (or inherited from vite.config.ts via `vite-tsconfig-paths`)

## TypeScript + path aliases

Existing imports use `@/` alias for `src/` (see tsconfig paths: `"@/*": ["./src/*"]`).

## Import patterns

- Config: `import fs from "fs"` (Node built-ins)
- Routes: `import { GET } from "@/app/api/health/route"`
- Constants: `import { CONSTANT } from "@/lib/constant"`

