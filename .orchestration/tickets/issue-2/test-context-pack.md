# Test Context Pack — issue-2

Verbatim excerpts of existing tests in this repo that establish the testing conventions
for both tester slices. Do not copy these tests; reuse the style.

---

## Excerpt 1: `src/app/api/health/__tests__/route.test.ts`
(shows: async route handler testing, `describe`/`it`/`expect`, no import needed for Vitest globals)

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

## Excerpt 2: `src/__tests__/env-config.test.ts`
(shows: file system assertions, regex matching)

```typescript
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const envExamplePath = path.join(repoRoot, ".env.example");

describe(".env.example", () => {
  it("contains no real-looking secrets", () => {
    const content = fs.readFileSync(envExamplePath, "utf-8");
    expect(content).not.toMatch(/(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}/i);
  });
});
```

---

## Key patterns to reuse

1. **No `import` needed for Vitest globals** — `describe`, `it`, `expect`, `beforeAll`, `beforeEach`, `vi` are globally available (`globals: true` in `vitest.config.ts`).
2. **Path alias** — use `@/` for cross-directory imports (e.g. `import { hashPassword } from "@/lib/auth/password"`).
3. **Async/await** — all async operations use `async/await`. No `.then()` chains.
4. **Arrange / Act / Assert** — arrange setup at top, single act, then assertions.
5. **Fresh instance per test** — for `InMemoryUserRepository`, create a `new InMemoryUserRepository()` inside `beforeEach` or at the top of each `it` block.
6. **`vi.fn()` for stubs** — use `vi.fn().mockResolvedValue(...)` or `vi.fn().mockReturnValue(...)` for mocking async/sync dependencies.
7. **Test environment** — `vitest.config.ts` uses `environment: "node"` globally. Tests for React components (`page.test.tsx`) need `// @vitest-environment jsdom` as the FIRST LINE of the file (a file-level docblock comment for Vitest), and should import `@testing-library/react` only if it's available — otherwise test the server action directly without rendering.

---

## Important constraint: no `@testing-library/react`

The project does NOT have `@testing-library/react` or `@testing-library/user-event` installed. The `page.test.tsx` files MUST test the server actions directly (call the action functions, assert on return values) — do NOT attempt to render components with a test library that isn't installed. If the test plan references "render `<RegisterPage />`", interpret this as "call `registerAction(...)` directly and assert on the returned state".
