import { ServiceUnavailableException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { GooglePlacesService } from "../google-places/google-places.service";
import { GooglePlace, GooglePlacesSearchResponse } from "../google-places/interfaces/google-place.interface";
import { GridEngineService } from "./grid-engine.service";

function buildPlaces(count: number, prefix: string): GooglePlace[] {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}` }));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("GridEngineService", () => {
  let service: GridEngineService;
  let googlePlacesService: { searchText: jest.Mock };

  const ORAN_CENTER = { latitude: 35.6969, longitude: -0.6331 };
  const ROOT_RADIUS = 50_000;

  beforeEach(async () => {
    googlePlacesService = { searchText: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GridEngineService, { provide: GooglePlacesService, useValue: googlePlacesService }],
    }).compile();

    service = module.get(GridEngineService);
  });

  it("subdivides a saturated cell into 4 and merges leaf results without deduplicating (Oran / Restaurant)", async () => {
    let callIndex = 0;
    googlePlacesService.searchText.mockImplementation(
      (): Promise<GooglePlacesSearchResponse> => {
        callIndex += 1;
        // The root cell is saturated (hits the Google limit), forcing a split into 4.
        // Each of the 4 children comes back under the limit, so they become leaves.
        const places =
          callIndex === 1 ? buildPlaces(20, "root") : buildPlaces(5, `leaf-${callIndex}`);
        return Promise.resolve({ places });
      },
    );

    const result = await service.search({
      keyword: "Restaurant",
      center: ORAN_CENTER,
      radius: ROOT_RADIUS,
    });

    console.log(
      `Oran / Restaurant grid search — cellules créées: ${result.stats.cellsCreated}, ` +
        `requêtes Google: ${result.stats.totalGoogleRequests}, ` +
        `résultats bruts: ${result.stats.totalRawResults}`,
    );

    // 1 root cell + 4 children it was split into.
    expect(result.stats.cellsCreated).toBe(5);
    expect(result.stats.totalGoogleRequests).toBe(5);
    // 20 (discarded root results) + 4 * 5 (kept leaf results).
    expect(result.stats.totalRawResults).toBe(40);
    // Only the 4 leaf cells (5 each) contribute to the merged output; no dedup applied.
    expect(result.places).toHaveLength(20);
  });

  it("does not subdivide when the root cell is already below the Google limit", async () => {
    googlePlacesService.searchText.mockResolvedValue({ places: buildPlaces(3, "single") });

    const result = await service.search({
      keyword: "Hotel",
      center: ORAN_CENTER,
      radius: ROOT_RADIUS,
    });

    expect(result.stats.cellsCreated).toBe(1);
    expect(result.stats.totalGoogleRequests).toBe(1);
    expect(result.stats.totalRawResults).toBe(3);
    expect(result.places).toHaveLength(3);
  });

  it("deduplicates a repeated place.id within the merged results", async () => {
    const duplicatedPlace: GooglePlace = { id: "same-place" };
    googlePlacesService.searchText.mockResolvedValue({ places: [duplicatedPlace, duplicatedPlace] });

    const result = await service.search({
      keyword: "Dentiste",
      center: ORAN_CENTER,
      radius: ROOT_RADIUS,
    });

    expect(result.places).toEqual([duplicatedPlace]);
    expect(result.stats.rawResultsCount).toBe(2);
    expect(result.stats.duplicatesRemoved).toBe(1);
    expect(result.stats.finalResultsCount).toBe(1);
  });

  describe("fusion et déduplication du quadrillage (Phase 8)", () => {
    it("Restaurant — merges the 4 quadrant responses and removes only the id-based duplicates", async () => {
      let callIndex = 0;
      googlePlacesService.searchText.mockImplementation(
        (): Promise<GooglePlacesSearchResponse> => {
          callIndex += 1;
          // Root cell saturated -> split into 4 leaves. Consecutive leaves share one
          // id each, mimicking the same place being found by two overlapping cells.
          const leafPlaceIds: Record<number, string[]> = {
            2: ["A", "B", "C", "D", "E"],
            3: ["E", "F", "G", "H", "I"],
            4: ["I", "J", "K", "L", "M"],
            5: ["M", "N", "O", "P", "Q"],
          };
          const places =
            callIndex === 1
              ? buildPlaces(20, "root")
              : leafPlaceIds[callIndex].map((id) => ({ id }));
          return Promise.resolve({ places });
        },
      );

      const result = await service.search({
        keyword: "Restaurant",
        center: ORAN_CENTER,
        radius: ROOT_RADIUS,
      });

      console.log(
        `Restaurant / Oran — résultats bruts: ${result.stats.rawResultsCount}, ` +
          `doublons supprimés: ${result.stats.duplicatesRemoved}, ` +
          `résultats finaux: ${result.stats.finalResultsCount}`,
      );

      // 4 leaves x 5 results each (the saturated root's 20 are superseded, not merged).
      expect(result.stats.rawResultsCount).toBe(20);
      // "E", "I" and "M" are each counted twice across neighboring leaves.
      expect(result.stats.duplicatesRemoved).toBe(3);
      expect(result.stats.finalResultsCount).toBe(17);
      expect(result.places).toHaveLength(17);
      expect(result.stats.finalResultsCount).toBeLessThanOrEqual(result.stats.rawResultsCount);

      const uniqueIds = new Set(result.places.map((place) => place.id));
      expect(uniqueIds.size).toBe(17);
    });

    it("Hotel — never removes two different companies, even with identical names", async () => {
      const sameNameDifferentPlaces: GooglePlace[] = [
        { id: "hotel-1", displayName: { text: "Ibis" } },
        { id: "hotel-2", displayName: { text: "Ibis" } },
      ];
      googlePlacesService.searchText.mockResolvedValue({ places: sameNameDifferentPlaces });

      const result = await service.search({
        keyword: "Hotel",
        center: ORAN_CENTER,
        radius: ROOT_RADIUS,
      });

      console.log(
        `Hotel / Oran — résultats bruts: ${result.stats.rawResultsCount}, ` +
          `doublons supprimés: ${result.stats.duplicatesRemoved}, ` +
          `résultats finaux: ${result.stats.finalResultsCount}`,
      );

      expect(result.stats.rawResultsCount).toBe(2);
      expect(result.stats.duplicatesRemoved).toBe(0);
      expect(result.stats.finalResultsCount).toBe(2);
      expect(result.places).toHaveLength(2);
      expect(result.stats.finalResultsCount).toBeLessThanOrEqual(result.stats.rawResultsCount);
    });

    it("Dentiste — deduplicates purely on place.id, ignoring other differing fields", async () => {
      const sameIdDifferentDetails: GooglePlace[] = [
        { id: "dentist-1", displayName: { text: "Cabinet Dentaire Oran" } },
        { id: "dentist-1", displayName: { text: "Dr. Fardeheb — Dentiste" } },
      ];
      googlePlacesService.searchText.mockResolvedValue({ places: sameIdDifferentDetails });

      const result = await service.search({
        keyword: "Dentiste",
        center: ORAN_CENTER,
        radius: ROOT_RADIUS,
      });

      console.log(
        `Dentiste / Oran — résultats bruts: ${result.stats.rawResultsCount}, ` +
          `doublons supprimés: ${result.stats.duplicatesRemoved}, ` +
          `résultats finaux: ${result.stats.finalResultsCount}`,
      );

      expect(result.stats.rawResultsCount).toBe(2);
      expect(result.stats.duplicatesRemoved).toBe(1);
      expect(result.stats.finalResultsCount).toBe(1);
      expect(result.places).toHaveLength(1);
      expect(result.stats.finalResultsCount).toBeLessThanOrEqual(result.stats.rawResultsCount);
    });
  });

  describe("optimisation des appels Google (Phase 9)", () => {
    it("Restaurant — throttles concurrency across a wide quadrillage while keeping every cell searched", async () => {
      googlePlacesService.searchText.mockImplementation(
        async (dto: { radius: number; latitude: number; longitude: number }): Promise<GooglePlacesSearchResponse> => {
          // A small artificial delay so overlapping branches genuinely run concurrently,
          // making the concurrency cap observable instead of a purely synchronous no-op.
          await delay(10);
          // Root (50 000m) and its 4 children (25 000m) stay saturated -> keep splitting.
          // The 16 grandchildren (12 500m) come back under the limit -> leaves.
          const isLeaf = dto.radius <= ROOT_RADIUS / 4;
          const cellKey = `${dto.latitude.toFixed(6)}-${dto.longitude.toFixed(6)}`;
          const places = isLeaf ? buildPlaces(2, `leaf-${cellKey}`) : buildPlaces(20, `sat-${cellKey}`);
          return { places };
        },
      );

      const result = await service.search({
        keyword: "Restaurant",
        center: ORAN_CENTER,
        radius: ROOT_RADIUS,
      });

      console.log(
        `Restaurant / Oran — temps total: ${result.stats.performance.totalTimeMs}ms, ` +
          `nombre de requêtes: ${result.stats.performance.requestCount}, ` +
          `temps moyen: ${result.stats.performance.averageRequestTimeMs.toFixed(1)}ms, ` +
          `requêtes simultanées: ${result.stats.performance.maxConcurrentRequests}`,
      );

      // 1 root + 4 children + 16 grandchildren, every one of them searched exactly once.
      expect(result.stats.cellsCreated).toBe(21);
      expect(result.stats.performance.requestCount).toBe(21);
      // 16 leaf cells fire far more demand than the limiter allows through at once.
      expect(result.stats.performance.maxConcurrentRequests).toBe(5);
      expect(result.stats.performance.totalTimeMs).toBeGreaterThan(0);
      expect(result.stats.performance.averageRequestTimeMs).toBeGreaterThan(0);
      // 16 leaves x 2 unique results each; functional merge/dedup logic is unchanged.
      expect(result.places).toHaveLength(32);
    });

    it("Hotel — reports total time, request count, average time and peak concurrency for a single cell", async () => {
      googlePlacesService.searchText.mockResolvedValue({ places: buildPlaces(4, "hotel") });

      const result = await service.search({
        keyword: "Hotel",
        center: ORAN_CENTER,
        radius: ROOT_RADIUS,
      });

      console.log(
        `Hotel / Oran — temps total: ${result.stats.performance.totalTimeMs}ms, ` +
          `nombre de requêtes: ${result.stats.performance.requestCount}, ` +
          `temps moyen: ${result.stats.performance.averageRequestTimeMs.toFixed(1)}ms, ` +
          `requêtes simultanées: ${result.stats.performance.maxConcurrentRequests}`,
      );

      expect(result.stats.performance.requestCount).toBe(result.stats.totalGoogleRequests);
      expect(result.stats.performance.requestCount).toBe(1);
      expect(result.stats.performance.maxConcurrentRequests).toBe(1);
      expect(result.stats.performance.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.performance.averageRequestTimeMs).toBeGreaterThanOrEqual(0);
      // Same functional result as before Phase 9: instrumentation doesn't change the output.
      expect(result.places).toHaveLength(4);
    });

    it("Dentiste — recovers from a transient Google failure via retry and still returns the identical result", async () => {
      let attempts = 0;
      googlePlacesService.searchText.mockImplementation(
        async (): Promise<GooglePlacesSearchResponse> => {
          attempts += 1;
          if (attempts === 1) {
            throw new ServiceUnavailableException("temporary Google outage");
          }
          return { places: buildPlaces(3, "recovered") };
        },
      );

      const result = await service.search({
        keyword: "Dentiste",
        center: ORAN_CENTER,
        radius: ROOT_RADIUS,
      });

      console.log(
        `Dentiste / Oran — temps total: ${result.stats.performance.totalTimeMs}ms, ` +
          `nombre de requêtes: ${result.stats.performance.requestCount}, ` +
          `temps moyen: ${result.stats.performance.averageRequestTimeMs.toFixed(1)}ms, ` +
          `requêtes simultanées: ${result.stats.performance.maxConcurrentRequests}`,
      );

      expect(attempts).toBe(2);
      // Exactly one logical cell, even though it took two HTTP attempts.
      expect(result.stats.cellsCreated).toBe(1);
      expect(result.stats.performance.requestCount).toBe(2);
      // The transient failure is invisible to the final, functional result.
      expect(result.places).toHaveLength(3);
    });
  });
});
