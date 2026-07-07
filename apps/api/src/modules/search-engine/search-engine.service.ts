import { Inject, Injectable } from "@nestjs/common";

import type { GooglePlacesSearchResponse } from "../google-places/interfaces/google-place.interface";
import type { SearchCompaniesDto } from "./dto/search-companies.dto";
import type { SearchStrategy } from "./interfaces/search-strategy.interface";
import { SEARCH_STRATEGY } from "./search-engine.constants";

@Injectable()
export class SearchEngineService {
  constructor(@Inject(SEARCH_STRATEGY) private readonly searchStrategy: SearchStrategy) {}

  search(dto: SearchCompaniesDto): Promise<GooglePlacesSearchResponse> {
    return this.searchStrategy.search(dto);
  }
}
