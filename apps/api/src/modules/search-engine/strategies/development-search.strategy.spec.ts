import { Test, TestingModule } from "@nestjs/testing";

import { GooglePlacesService } from "../../google-places/google-places.service";
import { GooglePlacesSearchResponse } from "../../google-places/interfaces/google-place.interface";
import { SearchQuery } from "../interfaces/search-strategy.interface";
import { DevelopmentSearchStrategy } from "./development-search.strategy";

describe("DevelopmentSearchStrategy", () => {
  let strategy: DevelopmentSearchStrategy;
  let googlePlacesService: { searchText: jest.Mock };

  const ORAN_QUERY: SearchQuery = {
    keyword: "Restaurant",
    city: "Oran",
    country: "Algeria",
    latitude: 35.6969,
    longitude: -0.6331,
    radius: 50_000,
  };

  beforeEach(async () => {
    googlePlacesService = { searchText: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevelopmentSearchStrategy,
        { provide: GooglePlacesService, useValue: googlePlacesService },
      ],
    }).compile();

    strategy = module.get(DevelopmentSearchStrategy);
  });

  function responseWith(...ids: string[]): GooglePlacesSearchResponse {
    return { places: ids.map((id) => ({ id })) };
  }

  it("runs one text search per known commune of the city, biased on the city's coordinates", async () => {
    googlePlacesService.searchText.mockResolvedValue(responseWith());

    await strategy.search(ORAN_QUERY);

    // Oran has 7 known communes in communes.data.ts.
    expect(googlePlacesService.searchText).toHaveBeenCalledTimes(7);
    expect(googlePlacesService.searchText).toHaveBeenCalledWith({
      keyword: "Restaurant Oran Algeria",
      latitude: ORAN_QUERY.latitude,
      longitude: ORAN_QUERY.longitude,
      radius: ORAN_QUERY.radius,
    });
    expect(googlePlacesService.searchText).toHaveBeenCalledWith({
      keyword: "Restaurant Bir El Djir Algeria",
      latitude: ORAN_QUERY.latitude,
      longitude: ORAN_QUERY.longitude,
      radius: ORAN_QUERY.radius,
    });
  });

  it("merges results and deduplicates by place id across communes", async () => {
    googlePlacesService.searchText
      .mockResolvedValueOnce(responseWith("a", "b"))
      .mockResolvedValueOnce(responseWith("b", "c"))
      .mockResolvedValue(responseWith());

    const result = await strategy.search(ORAN_QUERY);

    expect((result.places ?? []).map((place) => place.id).sort()).toEqual(["a", "b", "c"]);
    expect(result.googleRequests).toBe(7);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it("falls back to searching the city alone when it has no known communes", async () => {
    googlePlacesService.searchText.mockResolvedValue(responseWith());

    const result = await strategy.search({ ...ORAN_QUERY, city: "Nowhereville", country: "Nowhere" });

    expect(googlePlacesService.searchText).toHaveBeenCalledTimes(1);
    expect(googlePlacesService.searchText).toHaveBeenCalledWith({
      keyword: "Restaurant Nowhereville Nowhere",
      latitude: ORAN_QUERY.latitude,
      longitude: ORAN_QUERY.longitude,
      radius: ORAN_QUERY.radius,
    });
    expect(result.googleRequests).toBe(1);
  });
});
