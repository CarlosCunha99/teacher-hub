import { getCurrentUser } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const DEV_FALLBACK_ID = "00000000-0000-0000-0000-000000000001";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const makeRequest = (headers?: Record<string, string>) =>
  new Request("http://localhost/test", { headers });

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("getCurrentUser", () => {
  // ----------------------------------------------------------------
  // Without x-test-user header
  // ----------------------------------------------------------------
  describe("without x-test-user header", () => {
    it("returns the dev user when DEV_USER_ID env var is set", async () => {
      const customId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
      const original = process.env.DEV_USER_ID;
      process.env.DEV_USER_ID = customId;
      try {
        const user = await getCurrentUser(makeRequest());
        expect(user).not.toBeNull();
        expect(user!.id).toBe(customId);
      } finally {
        if (original !== undefined) {
          process.env.DEV_USER_ID = original;
        } else {
          delete process.env.DEV_USER_ID;
        }
      }
    });

    it("falls back to the fixed UUID when DEV_USER_ID is unset", async () => {
      const original = process.env.DEV_USER_ID;
      delete process.env.DEV_USER_ID;
      try {
        const user = await getCurrentUser(makeRequest());
        expect(user).not.toBeNull();
        expect(user!.id).toBe(DEV_FALLBACK_ID);
      } finally {
        if (original !== undefined) {
          process.env.DEV_USER_ID = original;
        }
      }
    });

    it("never rejects — resolves to a non-null value", async () => {
      await expect(getCurrentUser(makeRequest())).resolves.not.toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // With x-test-user header
  // ----------------------------------------------------------------
  describe("with x-test-user header", () => {
    it("returns the user encoded in a valid JSON CurrentUser header", async () => {
      const testUser: CurrentUser = {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        name: "Alice",
        role: "user",
      };
      const req = makeRequest({ "x-test-user": JSON.stringify(testUser) });
      const user = await getCurrentUser(req);
      expect(user).toEqual(testUser);
    });

    it("returns null when x-test-user is the string 'null'", async () => {
      const req = makeRequest({ "x-test-user": "null" });
      const user = await getCurrentUser(req);
      expect(user).toBeNull();
    });

    it("returns null when x-test-user is invalid JSON", async () => {
      const req = makeRequest({ "x-test-user": "{not-valid-json" });
      const user = await getCurrentUser(req);
      expect(user).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // Returned shape invariants
  // ----------------------------------------------------------------
  describe("returned user shape invariants (default dev user)", () => {
    let user: CurrentUser | null;

    beforeEach(async () => {
      user = await getCurrentUser(makeRequest());
    });

    it("id is a non-empty UUID string", () => {
      expect(user).not.toBeNull();
      expect(user!.id).toMatch(UUID_REGEX);
    });

    it("name is a string", () => {
      expect(user).not.toBeNull();
      expect(typeof user!.name).toBe("string");
    });

    it("role is one of user / moderator / admin", () => {
      expect(user).not.toBeNull();
      expect(["user", "moderator", "admin"]).toContain(user!.role);
    });
  });
});
