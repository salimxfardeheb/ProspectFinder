import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { SearchCompaniesDto } from "./dto/search-companies.dto";
import type { SearchResult } from "./interfaces/search-strategy.interface";
import { SearchEngineService } from "./search-engine.service";

@Controller()
export class SearchEngineController {
  constructor(private readonly searchEngineService: SearchEngineService) {}

  @Post("search")
  @HttpCode(HttpStatus.OK)
  search(@Body() dto: SearchCompaniesDto): Promise<SearchResult> {
    return this.searchEngineService.search(dto);
  }
}
