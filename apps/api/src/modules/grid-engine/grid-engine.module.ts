import { Module } from "@nestjs/common";

import { GooglePlacesModule } from "../google-places/google-places.module";
import { GridEngineService } from "./grid-engine.service";

@Module({
  imports: [GooglePlacesModule],
  providers: [GridEngineService],
  exports: [GridEngineService],
})
export class GridEngineModule {}
