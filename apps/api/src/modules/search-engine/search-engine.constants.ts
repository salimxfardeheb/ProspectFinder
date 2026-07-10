import { GOOGLE_PLACES_MAX_RADIUS_METERS } from "../google-places/google-places.constants";

export const SEARCH_STRATEGY = Symbol("SEARCH_STRATEGY");

/** City-wide default radius now that callers no longer provide one directly. */
export const DEFAULT_SEARCH_RADIUS_METERS = GOOGLE_PLACES_MAX_RADIUS_METERS;

/**
 * Selects which SearchStrategy is bound to SEARCH_STRATEGY: "grid" (default) for
 * the thorough, many-request GridPlacesSearchStrategy, or "development" for the
 * cheap, commune-based DevelopmentSearchStrategy used while iterating locally.
 */
export const SEARCH_STRATEGY_MODE_ENV = "SEARCH_STRATEGY_MODE";
