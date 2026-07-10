import { HttpService } from "@nestjs/axios";
import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isAxiosError } from "axios";
import { firstValueFrom } from "rxjs";

import { ApiCacheService } from "../../common/api-cache.service";
import { slugify } from "../../common/slug";
import { GeocodeAddressDto } from "./dto/geocode-address.dto";
import {
  GOOGLE_GEOCODING_API_KEY_ENV,
  GOOGLE_GEOCODING_API_URL,
  GOOGLE_GEOCODING_TIMEOUT_MS,
} from "./geocoding.constants";
import { GeocodeResult, GoogleGeocodingResponse } from "./interfaces/geocoding.interface";

const CACHE_NAMESPACE = "geocode";

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly apiCache: ApiCacheService,
  ) {}

  async geocode(dto: GeocodeAddressDto): Promise<GeocodeResult> {
    const address = this.toAddress(dto);
    const cacheKey = slugify(address);

    const cached = this.apiCache.read<GeocodeResult>(CACHE_NAMESPACE, cacheKey);
    if (cached) {
      this.logger.log(`geocode cache hit for "${address}"`);
      return cached;
    }

    const apiKey = this.configService.get<string>(GOOGLE_GEOCODING_API_KEY_ENV);
    if (!apiKey) {
      this.logger.error(`${GOOGLE_GEOCODING_API_KEY_ENV} is not set`);
      throw new InternalServerErrorException("Google Geocoding API key is not configured");
    }

    this.logger.log(`geocode address="${address}"`);

    const startedAt = Date.now();
    const data = await this.fetchGeocode(address, apiKey);
    this.logger.log(`geocode responded status=${data.status} in ${Date.now() - startedAt}ms`);

    const result = this.toResult(data, address);
    this.apiCache.write(CACHE_NAMESPACE, cacheKey, result);
    return result;
  }

  private toAddress(dto: GeocodeAddressDto): string {
    return [dto.city, dto.state, dto.country].filter((part): part is string => Boolean(part)).join(", ");
  }

  private async fetchGeocode(address: string, apiKey: string): Promise<GoogleGeocodingResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<GoogleGeocodingResponse>(GOOGLE_GEOCODING_API_URL, {
          params: { address, key: apiKey },
          timeout: GOOGLE_GEOCODING_TIMEOUT_MS,
        }),
      );
      return response.data;
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toResult(data: GoogleGeocodingResponse, address: string): GeocodeResult {
    if (data.status === "ZERO_RESULTS") {
      this.logger.warn(`geocode found no results for "${address}"`);
      throw new NotFoundException(`No coordinates found for "${address}"`);
    }

    if (data.status !== "OK") {
      const message = data.error_message ?? data.status;
      this.logger.warn(`geocode failed for "${address}": ${message}`);
      throw new BadGatewayException(`Google Geocoding API error: ${message}`);
    }

    const [result] = data.results;
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      viewport: result.geometry.viewport,
      formattedAddress: result.formatted_address,
    };
  }

  /**
   * Maps low-level HTTP failures to NestJS exceptions.
   * Never logs or rethrows the raw error: axios errors carry the
   * request query params, including the API key.
   */
  private toHttpException(error: unknown): Error {
    if (isAxiosError(error)) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        this.logger.warn(
          `Google Geocoding request timed out after ${GOOGLE_GEOCODING_TIMEOUT_MS}ms`,
        );
        return new GatewayTimeoutException("Google Geocoding API request timed out");
      }

      if (error.response) {
        this.logger.warn(`Google Geocoding responded ${error.response.status}`);
        return new BadGatewayException("Google Geocoding API error");
      }

      this.logger.warn(`Google Geocoding request failed: ${error.code ?? "network error"}`);
      return new ServiceUnavailableException("Google Geocoding API is unreachable");
    }

    this.logger.error("Unexpected error while calling Google Geocoding API");
    return new InternalServerErrorException("Unexpected error while calling Google Geocoding API");
  }
}
