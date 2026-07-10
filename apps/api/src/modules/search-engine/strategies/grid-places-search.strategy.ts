import { Injectable } from "@nestjs/common";

import { GridEngineService } from "../../grid-engine/grid-engine.service";
import { SearchQuery, SearchStrategy, SearchStrategyResult } from "../interfaces/search-strategy.interface";

@Injectable()
export class GridPlacesSearchStrategy implements SearchStrategy {
  constructor(private readonly gridEngineService: GridEngineService) {}

  async search(query: SearchQuery): Promise<SearchStrategyResult> {
    const result = await this.gridEngineService.search({
      keyword: query.keyword,
      center: { latitude: query.latitude, longitude: query.longitude },
      radius: query.radius,
    });

    return {
      places: result.places,
      googleRequests: result.stats.performance.requestCount,
      duplicatesRemoved: result.stats.duplicatesRemoved,
    };
  }
}
