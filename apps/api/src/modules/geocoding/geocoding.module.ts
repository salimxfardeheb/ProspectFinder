import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { GeocodingController } from "./geocoding.controller";
import { GeocodingService } from "./geocoding.service";

@Module({
  imports: [HttpModule, CommonModule],
  controllers: [GeocodingController],
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
