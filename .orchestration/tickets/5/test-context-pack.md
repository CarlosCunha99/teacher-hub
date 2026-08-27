# Test Context Pack for ticket #5

This file contains example test patterns from the existing codebase that the tester should follow.

## Pattern 1: Route handler test (src/app/api/health/__tests__/route.test.ts)

Route handler tests call the handler directly with `new Request(...)` and check response shape.

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

**Key patterns:**
- Use `describe` + `it` (Vitest globals)
- Import handler and any constants from their exported modules
- Call handler directly: `await GET(new Request(...))`
- Parse JSON: `await response.json()`
- Use `expect(...)` assertions
- Setup/teardown: try/finally for env var cleanup

## Pattern 2: Constant/type test convention

Vitest tests import constants and types from the library modules.

For the taxonomy ticket, follow this pattern:
```typescript
import { SUBJECTS, YEAR_LEVELS, type SubjectId, type YearLevelId } from "@/lib/taxonomy";

describe("taxonomy constants", () => {
  it("SUBJECTS has 6 entries", () => {
    expect(SUBJECTS.length).toBe(6);
  });

  it("each subject has id and label", () => {
    SUBJECTS.forEach(subject => {
      expect(subject.id).toBeDefined();
      expect(subject.label).toBeDefined();
    });
  });
});
```

**Key patterns:**
- Import both values and types from the lib module
- Never hard-code literal ID strings in tests — derive from exported constants
- Use the types to ensure TypeScript narrowing works

## Pattern 3: Service function test convention

Service functions are sync, pure, and imported directly.

```typescript
import { validateSubjectIds } from "@/lib/taxonomy-service";
import { SUBJECTS } from "@/lib/taxonomy";

describe("validateSubjectIds", () => {
  it("accepts a valid subject ID", () => {
    const validId = SUBJECTS[0].id;
    expect(() => validateSubjectIds([validId])).not.toThrow();
  });

  it("rejects empty array", () => {
    expect(() => validateSubjectIds([])).toThrow();
  });
});
```

**Key patterns:**
- Call functions directly (no async needed unless the function is async)
- Expect/throw for error cases
- Use imported constants to derive test inputs, not hard-coded strings
- One behavior per test

## Pattern 4: Test file structure

- All tests live in `src/<path>/__tests__/<name>.test.ts`
- Import path is `@/...` (not relative)
- Use `.toBe()`, `.toEqual()`, `.toContain()`, `.toThrow()` from Jest API
- Globals: `describe`, `it`, `expect` (Vitest with globals enabled)
