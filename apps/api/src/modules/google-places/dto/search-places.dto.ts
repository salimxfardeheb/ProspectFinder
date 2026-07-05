import { IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";

import { GOOGLE_PLACES_MAX_RADIUS_METERS } from "../google-places.constants";

export class SearchPlacesDto {
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  /** Search radius in meters. */
  @IsNumber()
  @Min(1)
  @Max(GOOGLE_PLACES_MAX_RADIUS_METERS)
  radius!: number;
}
