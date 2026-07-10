/**
 * Merges every cached Places response (fixtures/google-api/places/*.json) into
 * one deduplicated dataset at fixtures/datasets/places-merged.json. Read-only
 * on the cache: the per-request files are the cache keys and must stay as-is.
 *
 *   pnpm --filter api run fixtures:merge
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dedupePlacesById } from "../src/common/dedupe-places";
import { GooglePlace, GooglePlacesSearchResponse } from "../src/modules/google-places/interfaces/google-place.interface";

const placesDir = join(process.cwd(), "fixtures", "google-api", "places");
const outputDir = join(process.cwd(), "fixtures", "datasets");
const outputFile = join(outputDir, "places-merged.json");

const files = readdirSync(placesDir).filter((file) => file.endsWith(".json"));

const merged: GooglePlace[] = [];
for (const file of files) {
  const response = JSON.parse(
    readFileSync(join(placesDir, file), "utf-8"),
  ) as GooglePlacesSearchResponse;
  merged.push(...(response.places ?? []));
}

const places = dedupePlacesById(merged);

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  outputFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceFiles: files.length,
      rawResults: merged.length,
      duplicatesRemoved: merged.length - places.length,
      finalResults: places.length,
      places,
    },
    null,
    2,
  ),
  "utf-8",
);

console.log(`Fichiers sources : ${files.length}`);
console.log(`Résultats bruts : ${merged.length}`);
console.log(`Doublons supprimés : ${merged.length - places.length}`);
console.log(`Entreprises uniques : ${places.length}`);
console.log(`Écrit dans : ${outputFile}`);
