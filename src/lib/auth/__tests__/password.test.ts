import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("hashPassword", () => {
  it("produces a non-plaintext digest", async () => {
    const plain = "my-secret-password";
    const result = await hashPassword(plain);
    expect(result).not.toBe(plain);
    expect(result).toMatch(/^\$2[ab]\$/); // bcryptjs may emit $2a$ or $2b$ depending on version
  });

  it("is non-deterministic (salted)", async () => {
    const plain = "my-secret-password";
    const hashA = await hashPassword(plain);
    const hashB = await hashPassword(plain);
    expect(hashA).not.toBe(hashB);
  });
});

describe("verifyPassword", () => {
  let hash: string;

  beforeEach(async () => {
    hash = await hashPassword("correct-password");
  });

  it("returns true for matching password", async () => {
    const result = await verifyPassword("correct-password", hash);
    expect(result).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const result = await verifyPassword("wrong-password", hash);
    expect(result).toBe(false);
  });
});
