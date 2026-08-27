import { InMemoryUserRepository } from "@/lib/repositories/user-repository";
import type { TeacherAccount } from "@/lib/repositories/user-repository";

describe("InMemoryUserRepository", () => {
  describe("create", () => {
    it("stores a new user and makes it retrievable", async () => {
      const repo = new InMemoryUserRepository();
      const input = {
        name: "Alice",
        email: "alice@example.com",
        passwordHash: "$2b$10$somehashvalue",
      };

      const user: TeacherAccount = await repo.create(input);

      expect(user.id).toBeTruthy();
      expect(user.email).toBe("alice@example.com");
      expect(user.name).toBe("Alice");
      expect(user.passwordHash).toBe(input.passwordHash);
      expect(user.createdAt).toBeInstanceOf(Date);

      const found = await repo.findByEmail("alice@example.com");
      expect(found).toEqual(user);
    });

    it("throws on duplicate email (exact case)", async () => {
      const repo = new InMemoryUserRepository();
      const input = {
        name: "Alice",
        email: "alice@example.com",
        passwordHash: "$2b$10$somehash",
      };

      await repo.create(input);

      await expect(repo.create(input)).rejects.toThrow(/email already in use/i);
    });

    it("throws on duplicate email (case-insensitive)", async () => {
      const repo = new InMemoryUserRepository();

      await repo.create({
        name: "Alice",
        email: "user@example.com",
        passwordHash: "$2b$10$somehash",
      });

      await expect(
        repo.create({
          name: "Bob",
          email: "USER@EXAMPLE.COM",
          passwordHash: "$2b$10$otherhash",
        })
      ).rejects.toThrow(/email already in use/i);
    });
  });

  describe("findByEmail", () => {
    it("returns null for unknown email", async () => {
      const repo = new InMemoryUserRepository();
      const result = await repo.findByEmail("unknown@example.com");
      expect(result).toBeNull();
    });

    it("is case-insensitive", async () => {
      const repo = new InMemoryUserRepository();
      const created = await repo.create({
        name: "Alice",
        email: "user@example.com",
        passwordHash: "$2b$10$somehash",
      });

      const found = await repo.findByEmail("USER@EXAMPLE.COM");
      expect(found).toEqual(created);
    });
  });
});
