import { Injectable, Logger } from "@nestjs/common";

import { dedupePlacesById } from "../../../common/dedupe-places";
import { GooglePlacesService } from "../../google-places/google-places.service";
import { SearchQuery, SearchStrategy, SearchStrategyResult } from "../interfaces/search-strategy.interface";
import { getCommunes } from "./communes.data";

/**
 * Dev-only alternative to GridPlacesSearchStrategy: one plain text search per
 * known commune of the city (e.g. "Restaurant Bir El Djir Algeria") instead of
 * a recursive grid, to keep iterating on the search engine cheap. Not meant to
 * be exhaustive — see communes.data.ts. Each commune's search is a normal
 * GooglePlacesService.searchText() call, so it's cached exactly like every
 * other Google call.
 */
@Injectable()
export class DevelopmentSearchStrategy implements SearchStrategy {
  private readonly logger = new Logger(DevelopmentSearchStrategy.name);

  constructor(private readonly googlePlacesService: GooglePlacesService) {}

  async search(query: SearchQuery): Promise<SearchStrategyResult> {
    const communes = getCommunes(query.city, query.country);
    this.logger.log(
      `development search "${query.keyword}" in ${query.city}: ${communes.length} commune(s)`,
    );

    const responses = await Promise.all(
      communes.map((commune) =>
        this.googlePlacesService.searchText({
          keyword: this.toKeyword(query, commune),
          latitude: query.latitude,
          longitude: query.longitude,
          radius: query.radius,
        }),
      ),
    );

    const merged = responses.flatMap((response) => response.places ?? []);
    const places = dedupePlacesById(merged);

    return {
      places,
      googleRequests: communes.length,
      duplicatesRemoved: merged.length - places.length,
    };
  }

  private toKeyword(query: SearchQuery, commune: string): string {
    return [query.keyword, commune, query.state, query.country]
      .filter((part): part is string => Boolean(part))
      .join(" ");
  }
}
