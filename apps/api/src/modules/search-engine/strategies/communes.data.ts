/**
 * Known communes per city, used only by DevelopmentSearchStrategy to fan out
 * one lightweight text search per commune instead of running a full grid search.
 * Not meant to be exhaustive — add more cities here as your development needs grow.
 * Key: "<city>,<country>", both lowercased.
 */
const COMMUNES_BY_CITY: Record<string, string[]> = {
  "oran,algeria": [
    "Oran",
    "Bir El Djir",
    "Es Senia",
    "Sidi Chahmi",
    "Misserghin",
    "Boutlélis",
    "Aïn El Turk",
  ],
};

/** Falls back to the city itself (a single "commune") when it isn't in the table. */
export function getCommunes(city: string, country: string): string[] {
  const key = `${city.toLowerCase()},${country.toLowerCase()}`;
  return COMMUNES_BY_CITY[key] ?? [city];
}
