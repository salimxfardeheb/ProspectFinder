import { Module } from "@nestjs/common";

import { GeocodingModule } from "../geocoding/geocoding.module";
import { GooglePlacesModule } from "../google-places/google-places.module";
import { GridEngineModule } from "../grid-engine/grid-engine.module";
import { SearchEngineController } from "./search-engine.controller";
import { SEARCH_STRATEGY } from "./search-engine.constants";
import { SearchEngineService } from "./search-engine.service";
import { GooglePlacesSearchStrategy } from "./strategies/google-places-search.strategy";
import { GridPlacesSearchStrategy } from "./strategies/grid-places-search.strategy";

@Module({
  imports: [GeocodingModule, GooglePlacesModule, GridEngineModule],
  controllers: [SearchEngineController],
  providers: [
    SearchEngineService,
    GooglePlacesSearchStrategy,
    GridPlacesSearchStrategy,
    {
      provide: SEARCH_STRATEGY,
      useExisting: GridPlacesSearchStrategy,
    },
  ],
})
export class SearchEngineModule {}
