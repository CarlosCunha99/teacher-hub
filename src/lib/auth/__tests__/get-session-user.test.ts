import { getSessionUser } from "@/lib/auth/get-session-user";

describe("getSessionUser", () => {
  const originalTestUserId = process.env.TEST_USER_ID;

  afterEach(() => {
    if (originalTestUserId !== undefined) {
      process.env.TEST_USER_ID = originalTestUserId;
    } else {
      delete process.env.TEST_USER_ID;
    }
  });

  it("returns user object with TEST_USER_ID when env var is set", async () => {
    process.env.TEST_USER_ID = "user-123";
    const request = new Request("http://localhost/");
    const user = await getSessionUser(request);
    expect(user).toEqual({ id: "user-123" });
  });

  it("returns null when TEST_USER_ID is absent and no session cookie", async () => {
    delete process.env.TEST_USER_ID;
    const request = new Request("http://localhost/");
    const user = await getSessionUser(request);
    expect(user).toBeNull();
  });

  it("returns user object from __session cookie when TEST_USER_ID is absent", async () => {
    delete process.env.TEST_USER_ID;
    const request = new Request("http://localhost/", {
      headers: { cookie: "__session=cookie-user-456" },
    });
    const user = await getSessionUser(request);
    expect(user).toEqual({ id: "cookie-user-456" });
  });
});
