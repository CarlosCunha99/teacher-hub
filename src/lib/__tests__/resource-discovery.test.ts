import {
  buildDiscoveryUrl,
  getDiscoveryResult,
  parseDiscoveryQuery,
  RESOURCES_PER_PAGE,
} from "@/lib/resource-discovery";

describe("resource discovery", () => {
  it("searches by keyword across title and description", () => {
    const titleMatch = getDiscoveryResult(
      parseDiscoveryQuery({
        q: "Shakespeare",
      }),
    );
    const descriptionMatch = getDiscoveryResult(
      parseDiscoveryQuery({
        q: "biodiversity",
      }),
    );

    expect(titleMatch.totalMatches).toBeGreaterThan(0);
    expect(titleMatch.items.some((resource) => resource.title.includes("Shakespeare"))).toBe(true);
    expect(descriptionMatch.totalMatches).toBeGreaterThan(0);
    expect(descriptionMatch.items.some((resource) => resource.description.toLowerCase().includes("biodiversity"))).toBe(
      true,
    );
  });

  it("filters by subject and year level", () => {
    const result = getDiscoveryResult(
      parseDiscoveryQuery({
        subject: "Science",
        yearLevel: "Year 7",
      }),
    );

    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.items.every((resource) => resource.subject === "Science" && resource.yearLevel === "Year 7")).toBe(
      true,
    );
  });

  it("sorts by newest or most liked/saved", () => {
    const newest = getDiscoveryResult(parseDiscoveryQuery({ sort: "newest" }));
    const mostLikedSaved = getDiscoveryResult(parseDiscoveryQuery({ sort: "most-liked-saved" }));

    expect(new Date(newest.items[0].publishedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(newest.items[1].publishedAt).getTime(),
    );
    expect(mostLikedSaved.items[0].likes + mostLikedSaved.items[0].saves).toBeGreaterThanOrEqual(
      mostLikedSaved.items[1].likes + mostLikedSaved.items[1].saves,
    );
  });

  it("paginates results", () => {
    const firstPage = getDiscoveryResult(parseDiscoveryQuery({ page: "1" }));
    const secondPage = getDiscoveryResult(parseDiscoveryQuery({ page: "2" }));

    expect(firstPage.items.length).toBe(RESOURCES_PER_PAGE);
    expect(secondPage.items.length).toBeGreaterThan(0);
    expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
  });

  it("normalizes invalid query values", () => {
    const query = parseDiscoveryQuery({
      q: "  motion  ",
      subject: "Unknown Subject",
      yearLevel: "Unknown Year",
      sort: "invalid-sort",
      page: "-5",
    });

    expect(query.keyword).toBe("motion");
    expect(query.subject).toBe("all");
    expect(query.yearLevel).toBe("all");
    expect(query.sort).toBe("newest");
    expect(query.page).toBe(1);
  });

  it("builds shareable URLs from query state", () => {
    const baseQuery = parseDiscoveryQuery({
      q: "algebra",
      subject: "Mathematics",
      yearLevel: "Year 8",
      sort: "most-liked-saved",
      page: "2",
    });
    const url = buildDiscoveryUrl(baseQuery);
    const resetPageUrl = buildDiscoveryUrl(baseQuery, { page: 1 });

    expect(url).toContain("q=algebra");
    expect(url).toContain("subject=Mathematics");
    expect(url).toContain("yearLevel=Year+8");
    expect(url).toContain("sort=most-liked-saved");
    expect(url).toContain("page=2");
    expect(resetPageUrl).not.toContain("page=");
  });
});
