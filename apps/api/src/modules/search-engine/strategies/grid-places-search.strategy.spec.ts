import { Test, TestingModule } from "@nestjs/testing";

import { GridEngineService } from "../../grid-engine/grid-engine.service";
import { GridPlacesSearchStrategy } from "./grid-places-search.strategy";

describe("GridPlacesSearchStrategy", () => {
  let strategy: GridPlacesSearchStrategy;
  let gridEngineService: { search: jest.Mock };

  beforeEach(async () => {
    gridEngineService = { search: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GridPlacesSearchStrategy, { provide: GridEngineService, useValue: gridEngineService }],
    }).compile();

    strategy = module.get(GridPlacesSearchStrategy);
  });

  it("delegates to GridEngineService and maps its stats onto the SearchStrategy contract", async () => {
    const places = [{ id: "a" }, { id: "b" }];
    gridEngineService.search.mockResolvedValue({
      places,
      stats: {
        cellsCreated: 5,
        totalGoogleRequests: 5,
        totalRawResults: 40,
        rawResultsCount: 20,
        duplicatesRemoved: 3,
        finalResultsCount: 17,
        performance: { totalTimeMs: 120, requestCount: 5, averageRequestTimeMs: 24, maxConcurrentRequests: 5 },
      },
    });

    const result = await strategy.search({
      keyword: "Restaurant",
      latitude: 35.6969,
      longitude: -0.6331,
      radius: 50_000,
    });

    expect(gridEngineService.search).toHaveBeenCalledWith({
      keyword: "Restaurant",
      center: { latitude: 35.6969, longitude: -0.6331 },
      radius: 50_000,
    });
    expect(result.places).toBe(places);
    // googleRequests is sourced from stats.performance.requestCount (includes retries), not cellsCreated.
    expect(result.googleRequests).toBe(5);
    expect(result.duplicatesRemoved).toBe(3);
  });
});
