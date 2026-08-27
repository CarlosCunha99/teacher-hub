import Link from "next/link";
import {
  RESOURCES_PER_PAGE,
  SORT_OPTIONS,
  buildDiscoveryUrl,
  getDiscoveryResult,
  getPublishedResourcesCount,
  parseDiscoveryQuery,
  type SearchParams,
} from "@/lib/resource-discovery";
import { SUBJECT_OPTIONS, YEAR_LEVEL_OPTIONS } from "@/lib/resources";

type HomePageProps = {
  searchParams?: SearchParams;
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function HomePage({ searchParams }: HomePageProps) {
  const query = parseDiscoveryQuery(searchParams);
  const publishedResourcesCount = getPublishedResourcesCount();

  if (publishedResourcesCount === 0) {
    return (
      <main>
        <h1>Discover teaching resources</h1>
        <p>No published resources are available yet.</p>
        <p>Check back shortly or publish the first classroom resource to start the feed.</p>
      </main>
    );
  }

  const result = getDiscoveryResult(query);
  const hasAppliedFilters =
    query.keyword.length > 0 || query.subject !== "all" || query.yearLevel !== "all" || query.sort !== "newest";
  const isNoResults = result.totalMatches === 0;

  return (
    <main>
      <h1>Discover teaching resources</h1>
      <p>Browse published classroom resources and quickly refine what you need.</p>

      <form action="/" method="get" aria-label="Discovery filters">
        <label htmlFor="keyword">Keyword</label>
        <input
          id="keyword"
          name="q"
          type="search"
          defaultValue={query.keyword}
          placeholder="Search title or description"
        />

        <label htmlFor="subject">Subject</label>
        <select id="subject" name="subject" defaultValue={query.subject}>
          <option value="all">All subjects</option>
          {SUBJECT_OPTIONS.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>

        <label htmlFor="yearLevel">Year level</label>
        <select id="yearLevel" name="yearLevel" defaultValue={query.yearLevel}>
          <option value="all">All year levels</option>
          {YEAR_LEVEL_OPTIONS.map((yearLevel) => (
            <option key={yearLevel} value={yearLevel}>
              {yearLevel}
            </option>
          ))}
        </select>

        <label htmlFor="sort">Sort</label>
        <select id="sort" name="sort" defaultValue={query.sort}>
          <option value={SORT_OPTIONS[0]}>Newest</option>
          <option value={SORT_OPTIONS[1]}>Most liked/saved</option>
        </select>

        <button type="submit">Apply filters</button>
      </form>

      {isNoResults ? (
        <section aria-live="polite">
          <h2>No resources found</h2>
          <p>Try a broader keyword or clear one of the selected filters.</p>
          <p>
            <Link href="/">Clear all filters</Link>
          </p>
        </section>
      ) : (
        <>
          <p>
            Showing {result.items.length} of {result.totalMatches} resource
            {result.totalMatches === 1 ? "" : "s"} (page {result.page} of {result.totalPages}, {RESOURCES_PER_PAGE}{" "}
            per page).
          </p>

          <section aria-label="Browse results">
            {result.items.map((resource) => (
              <article key={resource.id}>
                <h2>{resource.title}</h2>
                <p>{resource.description}</p>
                <p>
                  {resource.subject} · {resource.yearLevel} · Published {formatDate(resource.publishedAt)}
                </p>
                <p>
                  {resource.likes} likes · {resource.saves} saves
                </p>
              </article>
            ))}
          </section>

          <nav aria-label="Pagination">
            {result.hasPreviousPage ? (
              <Link href={buildDiscoveryUrl(query, { page: result.page - 1 })}>Previous</Link>
            ) : (
              <span>Previous</span>
            )}{" "}
            |{" "}
            {result.hasNextPage ? (
              <Link href={buildDiscoveryUrl(query, { page: result.page + 1 })}>Next</Link>
            ) : (
              <span>Next</span>
            )}
          </nav>
        </>
      )}

      {hasAppliedFilters ? (
        <p>
          Share this exact view by copying the URL in your browser, or <Link href="/">reset to default browse</Link>.
        </p>
      ) : null}
    </main>
  );
}
