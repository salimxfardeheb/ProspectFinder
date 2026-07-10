import { HttpService } from "@nestjs/axios";
import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isAxiosError } from "axios";
import { firstValueFrom } from "rxjs";

import { ApiCacheService } from "../../common/api-cache.service";
import { formatCoord, slugify } from "../../common/slug";
import { SearchPlacesDto } from "./dto/search-places.dto";
import {
  GOOGLE_PLACES_API_KEY_ENV,
  GOOGLE_PLACES_FIELD_MASK,
  GOOGLE_PLACES_SEARCH_TEXT_URL,
  GOOGLE_PLACES_TIMEOUT_MS,
} from "./google-places.constants";
import {
  GoogleApiErrorBody,
  GooglePlacesSearchRequest,
  GooglePlacesSearchResponse,
} from "./interfaces/google-place.interface";

const CACHE_NAMESPACE = "places";

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly apiCache: ApiCacheService,
  ) {}

  async searchText(dto: SearchPlacesDto): Promise<GooglePlacesSearchResponse> {
    const cacheKey = this.toCacheKey(dto);
    const cached = this.apiCache.read<GooglePlacesSearchResponse>(CACHE_NAMESPACE, cacheKey);
    if (cached) {
      this.logger.log(`searchText cache hit for ${cacheKey}`);
      return cached;
    }

    const apiKey = this.configService.get<string>(GOOGLE_PLACES_API_KEY_ENV);
    if (!apiKey) {
      this.logger.error(`${GOOGLE_PLACES_API_KEY_ENV} is not set`);
      throw new InternalServerErrorException("Google Places API key is not configured");
    }

    const body = this.toGoogleRequest(dto);
    this.logger.log(
      `searchText query="${dto.keyword}" lat=${dto.latitude} lng=${dto.longitude} radius=${dto.radius}m`,
    );

    const startedAt = Date.now();
    try {
      const response = await firstValueFrom(
        this.httpService.post<GooglePlacesSearchResponse>(GOOGLE_PLACES_SEARCH_TEXT_URL, body, {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
          },
          timeout: GOOGLE_PLACES_TIMEOUT_MS,
        }),
      );

      const count = response.data.places?.length ?? 0;
      this.logger.log(`searchText returned ${count} place(s) in ${Date.now() - startedAt}ms`);
      this.apiCache.write(CACHE_NAMESPACE, cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toCacheKey(dto: SearchPlacesDto): string {
    return [
      slugify(dto.keyword),
      formatCoord(dto.latitude),
      formatCoord(dto.longitude),
      formatCoord(dto.radius),
    ].join("_");
  }

  private toGoogleRequest(dto: SearchPlacesDto): GooglePlacesSearchRequest {
    return {
      textQuery: dto.keyword,
      locationBias: {
        circle: {
          center: {
            latitude: dto.latitude,
            longitude: dto.longitude,
          },
          radius: dto.radius,
        },
      },
    };
  }

  /**
   * Maps low-level HTTP failures to NestJS exceptions.
   * Never logs or rethrows the raw error: axios errors carry the
   * request headers, including the API key.
   */
  private toHttpException(error: unknown): Error {
    if (isAxiosError(error)) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        this.logger.warn(`Google Places request timed out after ${GOOGLE_PLACES_TIMEOUT_MS}ms`);
        return new GatewayTimeoutException("Google Places API request timed out");
      }

      if (error.response) {
        const status = error.response.status;
        const googleError = (error.response.data as GoogleApiErrorBody | undefined)?.error;
        const message = googleError?.message ?? "Unknown Google Places API error";
        this.logger.warn(
          `Google Places responded ${status} (${googleError?.status ?? "UNKNOWN"}): ${message}`,
        );
        return new BadGatewayException(`Google Places API error: ${message}`);
      }

      this.logger.warn(`Google Places request failed: ${error.code ?? "network error"}`);
      return new ServiceUnavailableException("Google Places API is unreachable");
    }

    this.logger.error("Unexpected error while calling Google Places API");
    return new InternalServerErrorException("Unexpected error while calling Google Places API");
  }
}
