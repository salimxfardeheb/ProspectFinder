import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { GooglePlacesModule } from "./modules/google-places/google-places.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), GooglePlacesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
