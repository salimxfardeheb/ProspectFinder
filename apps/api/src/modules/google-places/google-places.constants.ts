export const GOOGLE_PLACES_SEARCH_TEXT_URL =
  "https://places.googleapis.com/v1/places:searchText";

export const GOOGLE_PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.location",
  "places.googleMapsUri",
].join(",");

export const GOOGLE_PLACES_TIMEOUT_MS = 10_000;

/** Google Places (New) rejects radii above 50 000 meters. */
export const GOOGLE_PLACES_MAX_RADIUS_METERS = 50_000;

export const GOOGLE_PLACES_API_KEY_ENV = "GOOGLE_PLACES_API_KEY";
