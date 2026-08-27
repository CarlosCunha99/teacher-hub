import { vi } from "vitest";

vi.mock("@/auth", () => ({
  signIn: vi.fn().mockResolvedValue(undefined),
  userRepository: {
    findByEmail: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
  },
}));

import { registerAction } from "@/app/(auth)/register/actions";

describe("registerAction validation", () => {
  it("returns validation error for missing name", async () => {
    const fd = new FormData();
    fd.append("name", "");
    fd.append("email", "a@example.com");
    fd.append("password", "12345678");

    const result = await registerAction({ ok: false }, fd);

    expect(result.ok).toBe(false);
    expect(result.field).toBe("name");
    expect(result.error).toBeTruthy();
  });

  it("returns validation error for invalid email format", async () => {
    const fd = new FormData();
    fd.append("name", "Alice");
    fd.append("email", "not-an-email");
    fd.append("password", "12345678");

    const result = await registerAction({ ok: false }, fd);

    expect(result.ok).toBe(false);
    expect(result.field).toBe("email");
    expect(result.error).toBeTruthy();
  });

  it("returns validation error for password shorter than 8 characters", async () => {
    const fd = new FormData();
    fd.append("name", "Alice");
    fd.append("email", "a@example.com");
    fd.append("password", "1234567"); // 7 chars — one short

    const result = await registerAction({ ok: false }, fd);

    expect(result.ok).toBe(false);
    expect(result.field).toBe("password");
    expect(result.error).toBeTruthy();
  });
});
