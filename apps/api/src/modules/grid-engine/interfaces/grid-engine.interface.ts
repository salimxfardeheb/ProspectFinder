import { GooglePlace } from "../../google-places/interfaces/google-place.interface";

export interface GridCenter {
  latitude: number;
  longitude: number;
}

/** Progress notification emitted right after a cell has been searched. */
export interface GridCellProgress {
  /** 1-based, in the order cells complete (not a stable tree position). */
  cellNumber: number;
  resultsCount: number;
  /** True if this cell hit the Google results limit and is about to be split into 4. */
  willSubdivide: boolean;
}

export interface GridSearchQuery {
  keyword: string;
  center: GridCenter;
  /** Radius in meters of the initial (root) cell. */
  radius: number;
  /** Optional progress hook, e.g. for CLI narration. Never affects the search result. */
  onCellSearched?: (progress: GridCellProgress) => void;
}

/** Performance/resilience metrics for the Google requests made during a grid search. */
export interface GridSearchPerformanceStats {
  /** Wall-clock time for the whole search, from the first request dispatched to the last completed. */
  totalTimeMs: number;
  /** All Google requests actually made, including retries. */
  requestCount: number;
  /** Average duration of a single request attempt. */
  averageRequestTimeMs: number;
  /** Highest number of Google requests that were in flight at the same time. */
  maxConcurrentRequests: number;
}

export interface GridSearchStats {
  cellsCreated: number;
  totalGoogleRequests: number;
  totalRawResults: number;
  /** Merged leaf-cell results before deduplication (can contain the same place.id more than once). */
  rawResultsCount: number;
  /** Entries removed because their place.id had already been seen. */
  duplicatesRemoved: number;
  /** Merged results after deduplication; always <= rawResultsCount. */
  finalResultsCount: number;
  performance: GridSearchPerformanceStats;
}

/** Merged, deduplicated (by place.id only) results of a recursive grid search. */
export interface GridSearchResult {
  places: GooglePlace[];
  stats: GridSearchStats;
}
