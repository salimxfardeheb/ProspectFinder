import { GOOGLE_PLACES_MAX_RADIUS_METERS } from "../google-places/google-places.constants";

export const SEARCH_STRATEGY = Symbol("SEARCH_STRATEGY");

/** City-wide default radius now that callers no longer provide one directly. */
export const DEFAULT_SEARCH_RADIUS_METERS = GOOGLE_PLACES_MAX_RADIUS_METERS;
