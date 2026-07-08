import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { GeocodeAddressDto } from "./dto/geocode-address.dto";
import { GeocodingService } from "./geocoding.service";
import { GeocodeResult } from "./interfaces/geocoding.interface";

@Controller("geocoding")
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  geocode(@Body() dto: GeocodeAddressDto): Promise<GeocodeResult> {
    return this.geocodingService.geocode(dto);
  }
}
