# Test Context Pack — resource-tagging

Extracted from existing tests for tester to reuse conventions.

## Test runner: Vitest

```
npm test   # vitest run
```

## Pattern 1: Route handler unit test (src/app/api/health/__tests__/route.test.ts)

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
    } finally {
      if (original !== undefined) process.env.DATABASE_URL = original;
    }
  });
});
```

Key conventions:
- Import named HTTP-method exports directly from route file
- Construct `new Request(url)` with full URL
- Call handler directly (no HTTP server needed)
- Check `response.status` and `response.json()`
- Use `process.env` manipulation inside try/finally for env tests

## Pattern 2: Filesystem/config tests (src/__tests__/env-config.test.ts)

```typescript
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
describe(".env.example", () => {
  it("exists and is non-empty", () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);
    const content = fs.readFileSync(envExamplePath, "utf-8");
    expect(content.trim().length).toBeGreaterThan(0);
  });
});
```

## Mocking pattern for Prisma (from impl-context.md)

```typescript
vi.mock("@/lib/prisma", () => ({
  default: {
    tag: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    resource: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    resourceTag: {
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
```

## Request construction for authenticated routes

```typescript
// Authenticated request with teacher identity stub
new Request("http://localhost/api/tags", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Teacher-Id": "teacher-1",
  },
  body: JSON.stringify({ name: "STEM Challenge" }),
})

// Unauthenticated request (no X-Teacher-Id header)
new Request("http://localhost/api/tags", { method: "POST" })
```

## Auth extraction pattern (from contract.md)

```typescript
const teacherId = request.headers.get("X-Teacher-Id");
if (!teacherId) {
  return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
}
```

## Error response shape (from contract.md)

```typescript
type ErrorResponse = {
  error: string;
  code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "BAD_REQUEST";
};
```
