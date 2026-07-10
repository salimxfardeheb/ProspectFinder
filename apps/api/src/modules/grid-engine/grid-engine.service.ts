import { Injectable, Logger } from "@nestjs/common";

import { GooglePlacesService } from "../google-places/google-places.service";
import { GooglePlace } from "../google-places/interfaces/google-place.interface";
import { GoogleRequestExecutor } from "./google-request-executor";
import {
  GOOGLE_PLACES_RESULTS_LIMIT,
  MAX_CONCURRENT_GOOGLE_REQUESTS,
  MAX_GRID_DEPTH,
  MAX_REQUEST_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  RETRY_BASE_DELAY_MS,
} from "./grid-engine.constants";
import {
  GridCellProgress,
  GridCenter,
  GridSearchQuery,
  GridSearchResult,
  GridSearchStats,
} from "./interfaces/grid-engine.interface";

const EARTH_RADIUS_METERS = 6_371_000;

interface GridCell {
  center: GridCenter;
  radius: number;
}

@Injectable()
export class GridEngineService {
  private readonly logger = new Logger(GridEngineService.name);

  constructor(private readonly googlePlacesService: GooglePlacesService) {}

  async search(query: GridSearchQuery): Promise<GridSearchResult> {
    const stats: GridSearchStats = {
      cellsCreated: 0,
      totalGoogleRequests: 0,
      totalRawResults: 0,
      rawResultsCount: 0,
      duplicatesRemoved: 0,
      finalResultsCount: 0,
      performance: { totalTimeMs: 0, requestCount: 0, averageRequestTimeMs: 0, maxConcurrentRequests: 0 },
    };

    // Fresh executor per search: concurrency/retry state and stats never leak across searches.
    const executor = new GoogleRequestExecutor(
      MAX_CONCURRENT_GOOGLE_REQUESTS,
      MAX_REQUEST_ATTEMPTS,
      RETRY_BASE_DELAY_MS,
      REQUEST_TIMEOUT_MS,
      this.logger,
    );

    const startedAt = Date.now();
    const mergedPlaces = await this.searchCell(
      query.keyword,
      { center: query.center, radius: query.radius },
      stats,
      0,
      executor,
      query.onCellSearched,
    );
    const totalTimeMs = Date.now() - startedAt;

    const places = this.deduplicateById(mergedPlaces);

    stats.rawResultsCount = mergedPlaces.length;
    stats.duplicatesRemoved = mergedPlaces.length - places.length;
    stats.finalResultsCount = places.length;
    stats.performance = {
      totalTimeMs,
      requestCount: executor.stats.totalRequests,
      averageRequestTimeMs:
        executor.stats.totalRequests > 0 ? executor.stats.totalDurationMs / executor.stats.totalRequests : 0,
      maxConcurrentRequests: executor.stats.maxConcurrentRequests,
    };

    this.logger.log(
      `grid search "${query.keyword}" done: cells=${stats.cellsCreated} ` +
        `requests=${stats.totalGoogleRequests} rawResults=${stats.rawResultsCount} ` +
        `duplicatesRemoved=${stats.duplicatesRemoved} finalResults=${stats.finalResultsCount} | ` +
        `totalTimeMs=${stats.performance.totalTimeMs} googleRequests=${stats.performance.requestCount} ` +
        `avgRequestMs=${stats.performance.averageRequestTimeMs.toFixed(1)} ` +
        `maxConcurrentRequests=${stats.performance.maxConcurrentRequests}`,
    );

    return { places, stats };
  }

  /**
   * Deduplicates strictly on place.id: two entries are only ever collapsed
   * when they share the exact same id, never based on name/address/other
   * fields, so two genuinely different companies are never removed.
   */
  private deduplicateById(places: GooglePlace[]): GooglePlace[] {
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

  private async searchCell(
    keyword: string,
    cell: GridCell,
    stats: GridSearchStats,
    depth: number,
    executor: GoogleRequestExecutor,
    onCellSearched?: (progress: GridCellProgress) => void,
  ): Promise<GooglePlace[]> {
    stats.cellsCreated += 1;
    const cellNumber = stats.cellsCreated;

    const label =
      `searchText(keyword="${keyword}", lat=${cell.center.latitude.toFixed(4)}, ` +
      `lng=${cell.center.longitude.toFixed(4)}, radius=${cell.radius}m, depth=${depth})`;

    const response = await executor.run(label, () =>
      this.googlePlacesService.searchText({
        keyword,
        latitude: cell.center.latitude,
        longitude: cell.center.longitude,
        radius: cell.radius,
      }),
    );
    stats.totalGoogleRequests += 1;

    const places = response.places ?? [];
    stats.totalRawResults += places.length;

    const isSaturated = places.length === GOOGLE_PLACES_RESULTS_LIMIT;
    const willSubdivide = isSaturated && depth < MAX_GRID_DEPTH;
    onCellSearched?.({ cellNumber, resultsCount: places.length, willSubdivide });

    if (!willSubdivide) {
      return places;
    }

    const subCells = this.splitIntoQuadrants(cell);
    const subResults = await Promise.all(
      subCells.map((subCell) => this.searchCell(keyword, subCell, stats, depth + 1, executor, onCellSearched)),
    );

    return subResults.flat();
  }

  /**
   * Splits a cell into 4 diagonal quadrants, halving the radius.
   * A geometric approximation of a quadtree split, not an exact circle tiling.
   */
  private splitIntoQuadrants(cell: GridCell): GridCell[] {
    const subRadius = cell.radius / 2;
    const angularOffset = subRadius / EARTH_RADIUS_METERS;
    const latOffsetDegrees = (angularOffset * 180) / Math.PI;
    const lngOffsetDegrees =
      (angularOffset * 180) / (Math.PI * Math.cos((cell.center.latitude * Math.PI) / 180));

    const directions = [
      { lat: 1, lng: 1 },
      { lat: 1, lng: -1 },
      { lat: -1, lng: 1 },
      { lat: -1, lng: -1 },
    ];

    return directions.map(({ lat, lng }) => ({
      center: {
        latitude: cell.center.latitude + lat * latOffsetDegrees,
        longitude: cell.center.longitude + lng * lngOffsetDegrees,
      },
      radius: subRadius,
    }));
  }
}
