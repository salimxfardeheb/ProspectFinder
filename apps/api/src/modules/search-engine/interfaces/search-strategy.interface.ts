import { GooglePlace, GooglePlacesSearchResponse } from "../../google-places/interfaces/google-place.interface";

export interface SearchQuery {
  keyword: string;
  /** City/state/country as typed by the user — only used by text-query-based strategies (e.g. DevelopmentSearchStrategy). */
  city: string;
  state?: string;
  country: string;
  latitude: number;
  longitude: number;
  radius: number;
}

/**
 * Result returned by a SearchStrategy. `googleRequests`/`duplicatesRemoved` are
 * optional so a simple single-call strategy (GooglePlacesSearchStrategy) still
 * satisfies this contract unchanged; a multi-call strategy (grid-based) can report them.
 */
export interface SearchStrategyResult extends GooglePlacesSearchResponse {
  googleRequests?: number;
  duplicatesRemoved?: number;
}

/**
 * Implemented by every search provider/strategy (Google Places today,
 * Nearby Search / quadtree-based / multi-provider aggregation later).
 * SearchEngineService depends on this interface, never on a concrete strategy.
 */
export interface SearchStrategy {
  search(query: SearchQuery): Promise<SearchStrategyResult>;
}

/** Final shape returned by POST /search. */
export interface SearchResult {
  places: GooglePlace[];
  executionTimeMs: number;
  googleRequests: number;
  duplicatesRemoved: number;
}
