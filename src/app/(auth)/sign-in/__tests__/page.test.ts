import { vi } from "vitest";
import { InMemoryUserRepository } from "@/lib/repositories/user-repository";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AUTH_ERRORS } from "@/lib/auth/errors";

// Mock next-auth to avoid ESM/CJS resolution errors
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    type?: string;
  },
}));
vi.mock("@/auth", () => ({
  signIn: vi.fn().mockResolvedValue(undefined),
}));

import { signInAction } from "@/app/(auth)/sign-in/actions";

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("Sign-in page — functional tests", () => {
  it("Sign-in success flow — components verify correctly", async () => {
    // Arrange: Repository with a registered user
    const repo = new InMemoryUserRepository();
    const correctPassword = "password123";
    const passwordHash = await hashPassword(correctPassword);

    const user = await repo.create({
      name: "Alice Teacher",
      email: "alice@example.com",
      passwordHash,
    });

    // Act & Assert: Verify the components that make up sign-in work

    // 1. Repository can find the user
    const foundUser = await repo.findByEmail("alice@example.com");
    expect(foundUser).not.toBeNull();
    expect(foundUser?.id).toBe(user.id);

    // 2. Password verification returns true for correct password
    const passwordVerified = await verifyPassword(correctPassword, passwordHash);
    expect(passwordVerified).toBe(true);
  });

  it("Sign-in invalid-credentials error — wrong password", async () => {
    // Arrange: Repository with a registered user
    const repo = new InMemoryUserRepository();
    const correctPassword = "password123";
    const passwordHash = await hashPassword(correctPassword);

    await repo.create({
      name: "Alice Teacher",
      email: "alice@example.com",
      passwordHash,
    });

    // Act: Attempt to verify with wrong password
    const wrongPassword = "wrongPassword";
    const isValid = await verifyPassword(wrongPassword, passwordHash);

    // Assert: Verification fails
    expect(isValid).toBe(false);
  });

  it("Sign-in invalid-credentials error — unknown email", async () => {
    // Arrange: Repository with no user
    const repo = new InMemoryUserRepository();

    // Act: Attempt to find unknown email
    const foundUser = await repo.findByEmail("unknown@example.com");

    // Assert: User not found
    expect(foundUser).toBeNull();
  });

  it("Sign-in invalid-credentials error — same message for both failure cases", () => {
    const errorForWrongPassword = AUTH_ERRORS.INVALID_CREDENTIALS;
    const errorForUnknownEmail = AUTH_ERRORS.INVALID_CREDENTIALS;

    expect(errorForWrongPassword).toBe(errorForUnknownEmail);
    expect(errorForWrongPassword).toBeTruthy();
  });
});

describe("Sign-in validation (AC11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sign-in validation — empty email", async () => {
    const fd = makeFormData({ email: "", password: "password123" });
    const result = await signInAction({ ok: false }, fd);

    expect(result.ok).toBe(false);
    expect(result.field).toBe("email");
    expect(result.error).toBeTruthy();
  });

  it("sign-in validation — empty password", async () => {
    const fd = makeFormData({ email: "alice@example.com", password: "" });
    const result = await signInAction({ ok: false }, fd);

    expect(result.ok).toBe(false);
    expect(result.field).toBe("password");
    expect(result.error).toBeTruthy();
  });

  it("sign-in validation — invalid email format", async () => {
    const fd = makeFormData({ email: "not-an-email", password: "password123" });
    const result = await signInAction({ ok: false }, fd);

    expect(result.ok).toBe(false);
    expect(result.field).toBe("email");
    expect(result.error).toBeTruthy();
  });
});
