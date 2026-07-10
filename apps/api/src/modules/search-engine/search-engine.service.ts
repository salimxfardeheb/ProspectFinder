import { Inject, Injectable } from "@nestjs/common";

import { GeocodingService } from "../geocoding/geocoding.service";
import type { SearchCompaniesDto } from "./dto/search-companies.dto";
import type { SearchResult, SearchStrategy } from "./interfaces/search-strategy.interface";
import { DEFAULT_SEARCH_RADIUS_METERS, SEARCH_STRATEGY } from "./search-engine.constants";

@Injectable()
export class SearchEngineService {
  constructor(
    private readonly geocodingService: GeocodingService,
    @Inject(SEARCH_STRATEGY) private readonly searchStrategy: SearchStrategy,
  ) {}

  async search(dto: SearchCompaniesDto): Promise<SearchResult> {
    const startedAt = Date.now();

    const { latitude, longitude } = await this.geocodingService.geocode(dto);
    const result = await this.searchStrategy.search({
      keyword: dto.keyword,
      latitude,
      longitude,
      radius: DEFAULT_SEARCH_RADIUS_METERS,
    });

    return {
      places: result.places ?? [],
      executionTimeMs: Date.now() - startedAt,
      // A strategy that doesn't report its own stats (e.g. a single-call one) defaults to 1 request, 0 duplicates.
      googleRequests: result.googleRequests ?? 1,
      duplicatesRemoved: result.duplicatesRemoved ?? 0,
    };
  }
}
