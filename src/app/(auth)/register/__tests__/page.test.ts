import { vi, beforeEach, describe, it, expect } from "vitest";
import { InMemoryUserRepository } from "@/lib/repositories/user-repository";
import { AUTH_ERRORS } from "@/lib/auth/errors";

let testRepo: InMemoryUserRepository;

vi.mock("@/auth", () => ({
  signIn: vi.fn().mockResolvedValue(undefined),
  get userRepository() {
    return testRepo;
  },
}));

import { registerAction } from "@/app/(auth)/register/actions";

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("Registration page — functional tests", () => {
  beforeEach(() => {
    testRepo = new InMemoryUserRepository();
    vi.clearAllMocks();
  });

  it("Registration success flow", async () => {
    const fd = makeFormData({
      name: "Alice Teacher",
      email: "alice@example.com",
      password: "password123",
    });
    const result = await registerAction({ ok: false }, fd);

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();

    const stored = await testRepo.findByEmail("alice@example.com");
    expect(stored).not.toBeNull();
    expect(stored!.name).toBe("Alice Teacher");
    expect(stored!.email).toBe("alice@example.com");
    expect(stored!.passwordHash).not.toBe("password123"); // AC3: never plaintext
    expect(stored!.passwordHash).toMatch(/^\$2[ab]\$/); // AC3: bcrypt hash
  });

  it("Registration duplicate-email error", async () => {
    // Pre-seed the repo the action will use
    await testRepo.create({
      name: "First",
      email: "alice@example.com",
      passwordHash: "somehash",
    });

    const fd = makeFormData({
      name: "Second",
      email: "alice@example.com",
      password: "password123",
    });
    const result = await registerAction({ ok: false }, fd);

    expect(result.ok).toBe(false);
    expect(result.error).toBe(AUTH_ERRORS.EMAIL_IN_USE);
    // Confirm no second user was added — repo still has the original entry
    const found = await testRepo.findByEmail("alice@example.com");
    expect(found!.name).toBe("First");
  });

  it("Registration validation-error display", async () => {
    const fd = makeFormData({
      name: "Alice Teacher",
      email: "",
      password: "password123",
    });
    const result = await registerAction({ ok: false }, fd);

    expect(result.ok).toBe(false);
    expect(result.field).toBe("email");
    expect(result.error).toBeDefined();
  });
});
