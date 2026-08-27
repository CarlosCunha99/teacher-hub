export function toSlug(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new TypeError("Tag name must not be empty");
  }

  const normalized = trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug) {
    return slug;
  }

  const fallback = Array.from(trimmed)
    .map((char) => char.codePointAt(0)?.toString(36) ?? "")
    .filter(Boolean)
    .join("-");

  if (!fallback) {
    throw new TypeError("Tag name must not be empty");
  }

  return fallback;
}
