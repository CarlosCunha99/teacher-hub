# Test context pack — issue-11

## Existing test pattern example

File: `src/app/api/health/__tests__/route.test.ts`
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

## Key conventions observed
- Uses Vitest with `describe` / `it` pattern (no explicit vitest imports — Vitest globals enabled)
- Route handlers invoked directly as `GET(new Request(url))`
- Assertions use `expect().toBe()`, `expect().toContain()`, `expect().toEqual()`
- Environment variable cleanup uses try/finally pattern
- Test files co-located under `__tests__/` sub-directory next to the route

## vitest.config.ts
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
  },
});
```

## Test run command
- `npm test` or `npx vitest run`
- Path alias `@/` maps to `src/`
