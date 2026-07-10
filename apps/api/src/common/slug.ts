/** Converts arbitrary text (city names, keywords) into a lowercase, filesystem-safe slug. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Formats a coordinate or radius as a safe filename fragment.
 * `-`/`.` can't be told apart from separators once slugified, so they're
 * replaced explicitly (m = minus, p = point) to keep cache keys unambiguous.
 */
export function formatCoord(value: number): string {
  return value.toFixed(5).replace("-", "m").replace(".", "p");
}
