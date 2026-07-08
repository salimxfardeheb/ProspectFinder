import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { GeocodingModule } from "./modules/geocoding/geocoding.module";
import { GooglePlacesModule } from "./modules/google-places/google-places.module";
import { SearchEngineModule } from "./modules/search-engine/search-engine.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GeocodingModule,
    GooglePlacesModule,
    SearchEngineModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
