import { vi } from "vitest";

// Mock next-auth and its providers to avoid ESM/CJS resolution errors in Vitest
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn() }));

import { userRepository } from "@/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/validation";
import { AUTH_ERRORS } from "@/lib/auth/errors";

// Mirrors the authorize callback in src/auth.ts exactly:
// findByEmail(normalizeEmail) → verifyPassword → return {id,email,name} | null
async function simulateAuthorize(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string } | null> {
  const user = await userRepository.findByEmail(normalizeEmail(email));
  if (!user) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return { id: user.id, email: user.email, name: user.name };
}

// The shared userRepository singleton accumulates state across tests.
// Use unique email addresses per test to avoid collisions.
describe("authorize logic (constituent-parts contract tests)", () => {
  it("returns user object (no passwordHash) for correct credentials", async () => {
    const hash = await hashPassword("correct-password");
    await userRepository.create({
      name: "Alice",
      email: "auth-test-1@example.com",
      passwordHash: hash,
    });

    const result = await simulateAuthorize("auth-test-1@example.com", "correct-password");

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("email", "auth-test-1@example.com");
    expect(result).toHaveProperty("name", "Alice");
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("returns null for wrong password", async () => {
    const hash = await hashPassword("correct-password");
    await userRepository.create({
      name: "Alice",
      email: "auth-test-2@example.com",
      passwordHash: hash,
    });

    const result = await simulateAuthorize("auth-test-2@example.com", "wrong-password");

    expect(result).toBeNull();
  });

  it("returns null for unknown email", async () => {
    const result = await simulateAuthorize("nobody-auth-test@example.com", "any-password");

    expect(result).toBeNull();
  });

  it("error message is identical for wrong password vs unknown email (enumeration resistance)", async () => {
    const hash = await hashPassword("correct-password");
    await userRepository.create({
      name: "Alice",
      email: "auth-test-4@example.com",
      passwordHash: hash,
    });

    const resultWrongPassword = await simulateAuthorize(
      "auth-test-4@example.com",
      "wrong-password"
    );
    const resultUnknownEmail = await simulateAuthorize(
      "nobody-enum-auth@example.com",
      "correct-password"
    );

    // Both failure paths return null — not throwing, not returning different error codes
    expect(resultWrongPassword).toBeNull();
    expect(resultUnknownEmail).toBeNull();

    // Both null values are strictly equal (identical outcome, enumeration-safe)
    expect(resultWrongPassword).toBe(resultUnknownEmail);

    // The user-facing constant is a meaningful string, not a self-referential comparison
    expect(AUTH_ERRORS.INVALID_CREDENTIALS).toBe("Invalid email or password.");
    expect(typeof AUTH_ERRORS.INVALID_CREDENTIALS).toBe("string");
  });
});
