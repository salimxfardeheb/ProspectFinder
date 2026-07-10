/**
 * Manual, human-readable trace of a real search, run against the actual Google
 * APIs (needs GOOGLE_GEOCODING_API_KEY / GOOGLE_PLACES_API_KEY in apps/api/.env).
 * Goes through SearchEngineService, so it honors SEARCH_STRATEGY_MODE exactly
 * like POST /search does ("grid" or "development" — see apps/api/.env).
 * Not part of the app or the test suite — run it yourself:
 *
 *   pnpm --filter api run search:manual -- "Restaurant" "Oran" "Algeria"
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../src/app.module";
import { ApiCacheService } from "../src/common/api-cache.service";
import { GeocodingService } from "../src/modules/geocoding/geocoding.service";
import { SearchEngineService } from "../src/modules/search-engine/search-engine.service";

async function main() {
  const [keyword = "Restaurant", city = "Oran", country = "Algeria", state] = process.argv.slice(2);

  console.log(`Recherche : ${keyword}`);
  console.log(`Ville : ${city}`);
  console.log(`Mode : ${process.env.SEARCH_STRATEGY_MODE ?? "grid"}\n`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const geocodingService = app.get(GeocodingService);
    const searchEngineService = app.get(SearchEngineService);
    const apiCache = app.get(ApiCacheService);

    const dto = { keyword, city, country, state };

    const hitsBeforeGeocode = apiCache.stats.hits;
    const geocoded = await geocodingService.geocode(dto);
    console.log(
      apiCache.stats.hits > hitsBeforeGeocode
        ? `Géocodage de "${city}" trouvé dans le dossier geocode — Google NON appelé\n`
        : `Géocodage de "${city}" absent du cache — appel Google réel effectué\n`,
    );
    console.log(`Coordonnées trouvées :\n${geocoded.latitude}, ${geocoded.longitude}\n`);

    const result = await searchEngineService.search(dto);

    console.log("Recherche terminée");
    console.log(`Temps total : ${(result.executionTimeMs / 1000).toFixed(1)} s`);
    console.log(`Recherches lancées par la stratégie : ${result.googleRequests}`);
    console.log(`Appels Google réels (facturés) : ${apiCache.stats.misses}`);
    console.log(`Réponses relues depuis le cache : ${apiCache.stats.hits}`);
    console.log(`Doublons supprimés : ${result.duplicatesRemoved}`);
    console.log(`Résultats finaux : ${result.places.length}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
