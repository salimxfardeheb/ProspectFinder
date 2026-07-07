import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { GooglePlacesSearchResponse } from "../google-places/interfaces/google-place.interface";
import { SearchCompaniesDto } from "./dto/search-companies.dto";
import { SearchEngineService } from "./search-engine.service";

@Controller()
export class SearchEngineController {
  constructor(private readonly searchEngineService: SearchEngineService) {}

  @Post("search")
  @HttpCode(HttpStatus.OK)
  search(@Body() dto: SearchCompaniesDto): Promise<GooglePlacesSearchResponse> {
    return this.searchEngineService.search(dto);
  }
}
