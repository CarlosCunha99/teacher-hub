import { GET } from "@/app/api/taxonomy/route";

describe("GET /api/taxonomy", () => {
  it("returns 200 with application/json content-type and correct top-level shape", async () => {
    const response = await GET(new Request("http://localhost/api/taxonomy"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["subjects", "yearLevels"].sort());
    expect(Array.isArray(body.subjects)).toBe(true);
    expect(Array.isArray(body.yearLevels)).toBe(true);
  });

  it("response contains all six subjects with correct shape and approved labels", async () => {
    const response = await GET(new Request("http://localhost/api/taxonomy"));
    const body = await response.json();

    expect(body.subjects).toHaveLength(6);

    body.subjects.forEach((item: unknown) => {
      const entry = item as { id: string; label: string };
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
    });

    const labels: string[] = body.subjects.map((s: { label: string }) => s.label).sort();
    expect(labels).toEqual(
      ["Arts", "English", "Mathematics", "Physical Education", "Science", "Social Studies"].sort()
    );
  });

  it("response contains all three year levels with correct shape and approved labels", async () => {
    const response = await GET(new Request("http://localhost/api/taxonomy"));
    const body = await response.json();

    expect(body.yearLevels).toHaveLength(3);

    body.yearLevels.forEach((item: unknown) => {
      const entry = item as { id: string; label: string };
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
    });

    const labels: string[] = body.yearLevels.map((y: { label: string }) => y.label).sort();
    expect(labels).toEqual(["Elementary", "High School", "Middle School"].sort());
  });

  it("each subject and year-level item contains exactly the keys id and label (no extra fields)", async () => {
    const response = await GET(new Request("http://localhost/api/taxonomy"));
    const body = await response.json();

    // Fix 5: check all items, not just index 0
    body.subjects.forEach((item: unknown) => {
      expect(Object.keys(item as object).sort()).toEqual(["id", "label"]);
    });
    body.yearLevels.forEach((item: unknown) => {
      expect(Object.keys(item as object).sort()).toEqual(["id", "label"]);
    });
  });

  it("POST is not exported from the route module or returns 405", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routeModule = await import("@/app/api/taxonomy/route") as any;
    if (typeof routeModule.POST === "function") {
      const response = await routeModule.POST(
        new Request("http://localhost/api/taxonomy", { method: "POST" })
      );
      expect(response.status).toBe(405);
    } else {
      expect(routeModule.POST).toBeUndefined();
    }
  });
});
