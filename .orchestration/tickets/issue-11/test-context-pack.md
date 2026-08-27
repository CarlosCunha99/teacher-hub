# Test context pack — issue-11

Verbatim excerpts of existing tests most similar to what the tester needs to write.
Use these for style and convention reference.

---

## src/app/api/health/__tests__/route.test.ts

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

---

## vitest.config.ts (key settings)

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",   // ← global environment is 'node'
    globals: true,         // ← describe/it/expect are global
  },
});
```

**CRITICAL:** Global test environment is `node`. For component tests that need a DOM, add `// @vitest-environment jsdom` at the top of the file.

---

## Patterns observed

1. **API route tests**: Import the named export from the route file directly (e.g., `import { GET } from "@/app/api/health/route"`). Call it with `new Request("http://localhost/...", { method: "POST", body: JSON.stringify({}) })` for POST routes.
2. **Globals**: `describe`, `it`, `expect` are globals (no import needed).
3. **Path alias**: `@/` maps to `src/` via tsconfigPaths.
4. **Async**: All route handlers return `Promise<Response>` — use `await` and `response.json()`.
5. **Mocking**: The health test doesn't mock anything. For DB-dependent tests, use `vi.mock('@/lib/db')` and set up return values per test.
6. **Component tests**: Need `// @vitest-environment jsdom` pragma + `@testing-library/react`.
7. **No test doubles shared globally**: Each test file uses inline fixtures.

---

## Key difference for new tests vs health test

The download route and teacher profile page tests need Prisma client mocking.
Pattern to use:

```typescript
// At top of file (module-level)
vi.mock("@/lib/db", () => ({
  db: {
    resource: {
      findUnique: vi.fn(),
    },
    download: {
      create: vi.fn(),
      count: vi.fn(),
    },
    like: {
      count: vi.fn(),
    },
  },
}));

// In each test
import { db } from "@/lib/db";
vi.mocked(db.resource.findUnique).mockResolvedValue({ ... });
```

Also need to mock `next/cache`:

```typescript
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
```

For Next.js page components that use `notFound()`:

```typescript
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));
```
