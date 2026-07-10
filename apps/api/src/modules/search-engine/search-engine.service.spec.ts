import { Test, TestingModule } from "@nestjs/testing";

import { GeocodingService } from "../geocoding/geocoding.service";
import { GooglePlacesSearchResponse } from "../google-places/interfaces/google-place.interface";
import { SearchCompaniesDto } from "./dto/search-companies.dto";
import { SEARCH_STRATEGY } from "./search-engine.constants";
import { SearchEngineService } from "./search-engine.service";

describe("SearchEngineService", () => {
  let service: SearchEngineService;
  let geocodingService: { geocode: jest.Mock };
  let searchStrategy: { search: jest.Mock };

  const oranCoordinates = { latitude: 35.6969, longitude: -0.6331 };
  const twentyResults: GooglePlacesSearchResponse = {
    places: Array.from({ length: 20 }, (_, index) => ({ id: `place-${index}` })),
  };

  beforeEach(async () => {
    geocodingService = { geocode: jest.fn().mockResolvedValue(oranCoordinates) };
    searchStrategy = { search: jest.fn().mockResolvedValue(twentyResults) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchEngineService,
        { provide: GeocodingService, useValue: geocodingService },
        { provide: SEARCH_STRATEGY, useValue: searchStrategy },
      ],
    }).compile();

    service = module.get(SearchEngineService);
  });

  it.each(["Restaurant", "Hotel", "Dentiste"])(
    "geocodes Oran then delegates to the injected SEARCH_STRATEGY for %s",
    async (keyword) => {
      const dto: SearchCompaniesDto = { keyword, city: "Oran", country: "Algeria" };

      const result = await service.search(dto);

      expect(geocodingService.geocode).toHaveBeenCalledWith(dto);
      expect(searchStrategy.search).toHaveBeenCalledWith({
        keyword,
        latitude: oranCoordinates.latitude,
        longitude: oranCoordinates.longitude,
        radius: expect.any(Number),
      });
      expect(result.places).toEqual(twentyResults.places);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      // The mocked strategy doesn't report its own stats, so the service falls back to sane defaults.
      expect(result.googleRequests).toBe(1);
      expect(result.duplicatesRemoved).toBe(0);
    },
  );

  it("passes through a strategy's own googleRequests/duplicatesRemoved when it reports them", async () => {
    searchStrategy.search.mockResolvedValue({
      places: twentyResults.places,
      googleRequests: 16,
      duplicatesRemoved: 24,
    });

    const dto: SearchCompaniesDto = { keyword: "Restaurant", city: "Oran", country: "Algeria" };
    const result = await service.search(dto);

    expect(result.googleRequests).toBe(16);
    expect(result.duplicatesRemoved).toBe(24);
    expect(result.places).toEqual(twentyResults.places);
  });
});
