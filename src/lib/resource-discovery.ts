import {
  RESOURCE_CATALOG,
  SUBJECT_OPTIONS,
  YEAR_LEVEL_OPTIONS,
  type Resource,
} from "@/lib/resources";
import { getUploadedResources } from "@/lib/uploaded-resources";

export const SORT_OPTIONS = ["newest", "most-liked-saved"] as const;

type SearchParamValue = string | string[] | undefined;

export type SearchParams = Record<string, SearchParamValue>;

export type SortOption = (typeof SORT_OPTIONS)[number];

export type DiscoveryQuery = {
  keyword: string;
  subject: string;
  yearLevel: string;
  sort: SortOption;
  page: number;
};

export type DiscoveryResult = {
  items: Resource[];
  totalMatches: number;
  totalPages: number;
  page: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export const RESOURCES_PER_PAGE = 6;
const ALL_OPTION = "all";

const validSubjects = new Set<string>(SUBJECT_OPTIONS);
const validYearLevels = new Set<string>(YEAR_LEVEL_OPTIONS);
const validSorts = new Set<SortOption>(SORT_OPTIONS);

function getAllResources(): Resource[] {
  const uploaded = getUploadedResources();
  return [...RESOURCE_CATALOG, ...uploaded];
}

function readSingleValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parsePositiveInteger(value: string | undefined): number {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export function parseDiscoveryQuery(searchParams: SearchParams | undefined): DiscoveryQuery {
  const keyword = readSingleValue(searchParams?.q)?.trim() ?? "";
  const requestedSubject = readSingleValue(searchParams?.subject);
  const requestedYearLevel = readSingleValue(searchParams?.yearLevel);
  const requestedSort = readSingleValue(searchParams?.sort) as SortOption | undefined;
  const page = parsePositiveInteger(readSingleValue(searchParams?.page));

  return {
    keyword,
    subject:
      requestedSubject && validSubjects.has(requestedSubject) ? requestedSubject : ALL_OPTION,
    yearLevel:
      requestedYearLevel && validYearLevels.has(requestedYearLevel)
        ? requestedYearLevel
        : ALL_OPTION,
    sort: requestedSort && validSorts.has(requestedSort) ? requestedSort : "newest",
    page,
  };
}

function sortResources(resources: Resource[], sort: SortOption): Resource[] {
  const copied = [...resources];

  if (sort === "most-liked-saved") {
    copied.sort((a, b) => {
      const scoreA = a.likes + a.saves;
      const scoreB = b.likes + b.saves;

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    });
    return copied;
  }

  copied.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return copied;
}

export function getDiscoveryResult(query: DiscoveryQuery): DiscoveryResult {
  const keyword = query.keyword.toLowerCase();
  const allResources = getAllResources();

  const filtered = allResources.filter((resource) => {
    if (!resource.isPublished) {
      return false;
    }

    if (query.subject !== ALL_OPTION && resource.subject !== query.subject) {
      return false;
    }

    if (query.yearLevel !== ALL_OPTION && resource.yearLevel !== query.yearLevel) {
      return false;
    }

    if (keyword.length === 0) {
      return true;
    }

    const title = resource.title.toLowerCase();
    const description = resource.description.toLowerCase();
    return title.includes(keyword) || description.includes(keyword);
  });

  const sorted = sortResources(filtered, query.sort);
  const totalMatches = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / RESOURCES_PER_PAGE));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * RESOURCES_PER_PAGE;
  const items = sorted.slice(start, start + RESOURCES_PER_PAGE);

  return {
    items,
    totalMatches,
    totalPages,
    page,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function getPublishedResourcesCount(): number {
  const allResources = getAllResources();
  return allResources.filter((resource) => resource.isPublished).length;
}

export function buildDiscoveryUrl(
  query: DiscoveryQuery,
  overrides: Partial<DiscoveryQuery> = {}
): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (merged.keyword.length > 0) {
    params.set("q", merged.keyword);
  }

  if (merged.subject !== ALL_OPTION) {
    params.set("subject", merged.subject);
  }

  if (merged.yearLevel !== ALL_OPTION) {
    params.set("yearLevel", merged.yearLevel);
  }

  if (merged.sort !== "newest") {
    params.set("sort", merged.sort);
  }

  if (merged.page > 1) {
    params.set("page", String(merged.page));
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `/?${serialized}` : "/";
}
