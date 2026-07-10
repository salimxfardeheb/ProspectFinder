/**
 * Manual, human-readable trace of a real geocode + grid search, run against
 * the actual Google APIs (needs GOOGLE_GEOCODING_API_KEY / GOOGLE_PLACES_API_KEY
 * in apps/api/.env). Not part of the app or the test suite — run it yourself:
 *
 *   pnpm --filter api run search:manual -- "Restaurant" "Oran" "Algeria"
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../src/app.module";
import { GeocodingService } from "../src/modules/geocoding/geocoding.service";
import { GridEngineService } from "../src/modules/grid-engine/grid-engine.service";
import { GridCellProgress } from "../src/modules/grid-engine/interfaces/grid-engine.interface";
import { DEFAULT_SEARCH_RADIUS_METERS } from "../src/modules/search-engine/search-engine.constants";

async function main() {
  const [keyword = "Restaurant", city = "Oran", country = "Algeria", state] = process.argv.slice(2);

  console.log(`Recherche : ${keyword}\n`);
  console.log(`Ville : ${city}\n`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const geocodingService = app.get(GeocodingService);
    const gridEngineService = app.get(GridEngineService);

    const geocoded = await geocodingService.geocode({ keyword, city, country, state });
    console.log(`Coordonnées trouvées :\n${geocoded.latitude}, ${geocoded.longitude}\n`);
    console.log("Création de la grille...\n");

    const onCellSearched = (progress: GridCellProgress) => {
      console.log(`Cellule ${progress.cellNumber}`);
      console.log(`→ ${progress.resultsCount} résultats\n`);
      if (progress.willSubdivide) {
        console.log("Subdivision...\n");
      }
    };

    const result = await gridEngineService.search({
      keyword,
      center: { latitude: geocoded.latitude, longitude: geocoded.longitude },
      radius: DEFAULT_SEARCH_RADIUS_METERS,
      onCellSearched,
    });

    console.log("Fusion des résultats...\n");
    console.log("Suppression des doublons...\n");
    console.log("Recherche terminée");
    console.log(`Temps total : ${(result.stats.performance.totalTimeMs / 1000).toFixed(1)} s`);
    console.log(`Appels Google : ${result.stats.performance.requestCount}`);
    console.log(`Résultats bruts : ${result.stats.rawResultsCount}`);
    console.log(`Doublons supprimés : ${result.stats.duplicatesRemoved}`);
    console.log(`Résultats finaux : ${result.stats.finalResultsCount}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
