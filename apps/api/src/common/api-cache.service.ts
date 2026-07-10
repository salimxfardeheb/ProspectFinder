import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * File-based cache for Google API responses, keyed by request parameters.
 *
 * Google bills every geocoding/places call individually. Caching each distinct
 * request to a JSON file under fixtures/google-api/ lets the exact same request
 * be replayed for free on every later run, which is what makes it possible to
 * iterate on the grid-search algorithm without re-paying for the same searches.
 *
 * Disable with GOOGLE_API_CACHE=false — this must always be false in production,
 * where serving a stale cached result to a real user would be wrong.
 */
export interface ApiCacheStats {
  /** Responses replayed from a JSON file — no Google call, no cost. */
  hits: number;
  /** Cache lookups that found nothing — each one is followed by a real, billed Google call. */
  misses: number;
}

@Injectable()
export class ApiCacheService {
  private readonly logger = new Logger(ApiCacheService.name);
  private readonly enabled: boolean;
  private readonly baseDir = join(process.cwd(), "fixtures", "google-api");

  readonly stats: ApiCacheStats = { hits: 0, misses: 0 };

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>("GOOGLE_API_CACHE", "true") !== "false";
  }

  read<T>(namespace: string, fileName: string): T | null {
    if (!this.enabled) {
      return null;
    }

    const filePath = this.path(namespace, fileName);
    if (!existsSync(filePath)) {
      this.stats.misses += 1;
      return null;
    }

    try {
      const value = JSON.parse(readFileSync(filePath, "utf-8")) as T;
      this.stats.hits += 1;
      this.logger.log(`Cache hit: ${namespace}/${fileName}.json — Google NOT called`);
      return value;
    } catch {
      this.logger.warn(`Ignoring unreadable cache file: ${filePath}`);
      this.stats.misses += 1;
      return null;
    }
  }

  write(namespace: string, fileName: string, data: unknown): void {
    if (!this.enabled) {
      return;
    }

    mkdirSync(join(this.baseDir, namespace), { recursive: true });
    writeFileSync(this.path(namespace, fileName), JSON.stringify(data, null, 2), "utf-8");
    this.logger.log(`Wrote cache file: ${namespace}/${fileName}.json`);
  }

  private path(namespace: string, fileName: string): string {
    return join(this.baseDir, namespace, `${fileName}.json`);
  }
}
