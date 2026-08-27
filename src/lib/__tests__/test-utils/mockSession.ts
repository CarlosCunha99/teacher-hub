import { vi } from "vitest";

// Shared fixture used across route/page tests until real auth (issue #2) lands.
export const MOCK_TEACHER_ID = "teacher-1";

// Factory for a `@/lib/auth` module mock. Test files must call
// `vi.mock("@/lib/auth", () => createAuthModuleMock())` directly at their own
// top level — vi.mock hoisting only lifts calls lexically present in the test
// file itself, so importing and invoking this factory from within a
// `vi.mock(...)` call in the test file is required (not wrapping vi.mock here).
export function createAuthModuleMock() {
  return {
    getCurrentTeacherId: vi.fn(async (): Promise<string | null> => MOCK_TEACHER_ID),
  };
}
