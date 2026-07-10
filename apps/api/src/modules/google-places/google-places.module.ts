import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { GooglePlacesController } from "./google-places.controller";
import { GooglePlacesService } from "./google-places.service";

@Module({
  imports: [HttpModule, CommonModule],
  controllers: [GooglePlacesController],
  providers: [GooglePlacesService],
  exports: [GooglePlacesService],
})
export class GooglePlacesModule {}
