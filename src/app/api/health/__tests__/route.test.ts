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
