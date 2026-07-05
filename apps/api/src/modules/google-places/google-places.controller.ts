import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { SearchPlacesDto } from "./dto/search-places.dto";
import { GooglePlacesService } from "./google-places.service";
import { GooglePlacesSearchResponse } from "./interfaces/google-place.interface";

@Controller("google-places")
export class GooglePlacesController {
  constructor(private readonly googlePlacesService: GooglePlacesService) {}

  @Post("search")
  @HttpCode(HttpStatus.OK)
  search(@Body() dto: SearchPlacesDto): Promise<GooglePlacesSearchResponse> {
    return this.googlePlacesService.searchText(dto);
  }
}
