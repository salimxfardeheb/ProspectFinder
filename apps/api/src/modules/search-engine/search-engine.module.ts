import { Module } from "@nestjs/common";

import { GooglePlacesModule } from "../google-places/google-places.module";
import { SearchEngineController } from "./search-engine.controller";
import { SEARCH_STRATEGY } from "./search-engine.constants";
import { SearchEngineService } from "./search-engine.service";
import { GooglePlacesSearchStrategy } from "./strategies/google-places-search.strategy";

@Module({
  imports: [GooglePlacesModule],
  controllers: [SearchEngineController],
  providers: [
    SearchEngineService,
    GooglePlacesSearchStrategy,
    {
      provide: SEARCH_STRATEGY,
      useExisting: GooglePlacesSearchStrategy,
    },
  ],
})
export class SearchEngineModule {}
