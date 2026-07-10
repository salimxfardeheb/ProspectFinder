import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { GeocodingModule } from "../geocoding/geocoding.module";
import { GooglePlacesModule } from "../google-places/google-places.module";
import { GridEngineModule } from "../grid-engine/grid-engine.module";
import { SearchEngineController } from "./search-engine.controller";
import { SEARCH_STRATEGY, SEARCH_STRATEGY_MODE_ENV } from "./search-engine.constants";
import { SearchEngineService } from "./search-engine.service";
import { DevelopmentSearchStrategy } from "./strategies/development-search.strategy";
import { GooglePlacesSearchStrategy } from "./strategies/google-places-search.strategy";
import { GridPlacesSearchStrategy } from "./strategies/grid-places-search.strategy";
import { SearchStrategy } from "./interfaces/search-strategy.interface";

@Module({
  imports: [GeocodingModule, GooglePlacesModule, GridEngineModule],
  controllers: [SearchEngineController],
  providers: [
    SearchEngineService,
    GooglePlacesSearchStrategy,
    GridPlacesSearchStrategy,
    DevelopmentSearchStrategy,
    {
      provide: SEARCH_STRATEGY,
      useFactory: (
        configService: ConfigService,
        gridStrategy: GridPlacesSearchStrategy,
        developmentStrategy: DevelopmentSearchStrategy,
      ): SearchStrategy =>
        configService.get<string>(SEARCH_STRATEGY_MODE_ENV, "grid") === "development"
          ? developmentStrategy
          : gridStrategy,
      inject: [ConfigService, GridPlacesSearchStrategy, DevelopmentSearchStrategy],
    },
  ],
})
export class SearchEngineModule {}
