import { Injectable } from "@nestjs/common";

import { GooglePlacesService } from "../../google-places/google-places.service";
import { GooglePlacesSearchResponse } from "../../google-places/interfaces/google-place.interface";
import { SearchQuery, SearchStrategy } from "../interfaces/search-strategy.interface";

@Injectable()
export class GooglePlacesSearchStrategy implements SearchStrategy {
  constructor(private readonly googlePlacesService: GooglePlacesService) {}

  search(query: SearchQuery): Promise<GooglePlacesSearchResponse> {
    return this.googlePlacesService.searchText(query);
  }
}
