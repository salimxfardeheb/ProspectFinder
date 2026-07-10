import { GooglePlace } from "../modules/google-places/interfaces/google-place.interface";

/**
 * Deduplicates strictly on place.id: two entries are only ever collapsed
 * when they share the exact same id, never based on name/address/other
 * fields, so two genuinely different companies are never removed.
 */
export function dedupePlacesById(places: GooglePlace[]): GooglePlace[] {
  const seenIds = new Set<string>();
  const deduplicated: GooglePlace[] = [];

  for (const place of places) {
    if (seenIds.has(place.id)) {
      continue;
    }
    seenIds.add(place.id);
    deduplicated.push(place);
  }

  return deduplicated;
}
