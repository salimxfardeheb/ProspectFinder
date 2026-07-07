import { GooglePlacesSearchResponse } from "../../google-places/interfaces/google-place.interface";

export interface SearchQuery {
  keyword: string;
  latitude: number;
  longitude: number;
  radius: number;
}

/**
 * Implemented by every search provider/strategy (Google Places today,
 * Nearby Search / quadtree-based / multi-provider aggregation later).
 * SearchEngineService depends on this interface, never on a concrete strategy.
 */
export interface SearchStrategy {
  search(query: SearchQuery): Promise<GooglePlacesSearchResponse>;
}
