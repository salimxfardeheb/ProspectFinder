/** Google Places (New) text search caps results at 20 per request. */
export const GOOGLE_PLACES_RESULTS_LIMIT = 20;

/**
 * Hard safety cap on recursion depth: without it, an area that keeps
 * returning exactly the Google limit would subdivide forever.
 */
export const MAX_GRID_DEPTH = 6;

/** Caps how many Google requests can be in flight at once across a single grid search. */
export const MAX_CONCURRENT_GOOGLE_REQUESTS = 5;

/** 1 initial attempt + up to this many retries before a cell's request is given up on. */
export const MAX_REQUEST_ATTEMPTS = 3;

/** Base delay for the exponential backoff between retries; doubles each attempt. */
export const RETRY_BASE_DELAY_MS = 200;

/** Per-attempt timeout, enforced independently of GooglePlacesService's own HTTP timeout. */
export const REQUEST_TIMEOUT_MS = 10_000;
