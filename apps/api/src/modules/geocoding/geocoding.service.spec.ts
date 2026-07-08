import { HttpService } from "@nestjs/axios";
import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { of } from "rxjs";

import { GeocodeAddressDto } from "./dto/geocode-address.dto";
import { GeocodingService } from "./geocoding.service";
import { GoogleGeocodingResponse } from "./interfaces/geocoding.interface";

describe("GeocodingService", () => {
  let service: GeocodingService;
  let httpService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeocodingService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue("test-api-key") } },
      ],
    }).compile();

    service = module.get(GeocodingService);
  });

  function mockResponse(data: GoogleGeocodingResponse) {
    httpService.get.mockReturnValueOnce(of({ data }));
  }

  it("resolves coordinates for Oran", async () => {
    mockResponse({
      status: "OK",
      results: [
        {
          formatted_address: "Oran, Algeria",
          geometry: {
            location: { lat: 35.6969, lng: -0.6331 },
            viewport: {
              northeast: { lat: 35.75, lng: -0.55 },
              southwest: { lat: 35.65, lng: -0.7 },
            },
          },
        },
      ],
    });

    const dto: GeocodeAddressDto = { keyword: "Restaurant", city: "Oran", country: "Algeria" };
    const result = await service.geocode(dto);

    expect(result.latitude).toBeCloseTo(35.6969);
    expect(result.longitude).toBeCloseTo(-0.6331);
    expect(result.viewport).toEqual({
      northeast: { lat: 35.75, lng: -0.55 },
      southwest: { lat: 35.65, lng: -0.7 },
    });
    expect(httpService.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { address: "Oran, Algeria", key: "test-api-key" } }),
    );
  });

  it("resolves coordinates for Paris", async () => {
    mockResponse({
      status: "OK",
      results: [
        {
          formatted_address: "Paris, France",
          geometry: {
            location: { lat: 48.8566, lng: 2.3522 },
            viewport: {
              northeast: { lat: 48.9, lng: 2.42 },
              southwest: { lat: 48.81, lng: 2.22 },
            },
          },
        },
      ],
    });

    const dto: GeocodeAddressDto = { keyword: "Restaurant", city: "Paris", country: "France" };
    const result = await service.geocode(dto);

    expect(result.latitude).toBeCloseTo(48.8566);
    expect(result.longitude).toBeCloseTo(2.3522);
  });

  it("resolves coordinates for London, including an optional state", async () => {
    mockResponse({
      status: "OK",
      results: [
        {
          formatted_address: "London, UK",
          geometry: {
            location: { lat: 51.5074, lng: -0.1278 },
            viewport: {
              northeast: { lat: 51.6, lng: 0.01 },
              southwest: { lat: 51.4, lng: -0.3 },
            },
          },
        },
      ],
    });

    const dto: GeocodeAddressDto = {
      keyword: "Restaurant",
      city: "London",
      state: "England",
      country: "United Kingdom",
    };
    const result = await service.geocode(dto);

    expect(result.latitude).toBeCloseTo(51.5074);
    expect(result.longitude).toBeCloseTo(-0.1278);
    expect(httpService.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: { address: "London, England, United Kingdom", key: "test-api-key" },
      }),
    );
  });

  it("throws NotFoundException for a nonexistent city", async () => {
    mockResponse({ status: "ZERO_RESULTS", results: [] });

    const dto: GeocodeAddressDto = {
      keyword: "Restaurant",
      city: "Nonexistentville",
      country: "Nowhere",
    };

    await expect(service.geocode(dto)).rejects.toThrow(NotFoundException);
  });
});
