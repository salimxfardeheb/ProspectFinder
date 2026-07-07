import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { GooglePlacesModule } from "./modules/google-places/google-places.module";
import { SearchEngineModule } from "./modules/search-engine/search-engine.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), GooglePlacesModule, SearchEngineModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
