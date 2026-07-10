import { ConfigService } from "@nestjs/config";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { ApiCacheService } from "./api-cache.service";

describe("ApiCacheService", () => {
  const namespace = "__test__";
  const testDir = join(process.cwd(), "fixtures", "google-api", namespace);

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function makeService(enabledValue: string): ApiCacheService {
    const configService = {
      get: jest.fn().mockReturnValue(enabledValue),
    } as unknown as ConfigService;
    return new ApiCacheService(configService);
  }

  it("returns null when nothing has been cached yet", () => {
    const service = makeService("true");
    expect(service.read(namespace, "missing")).toBeNull();
  });

  it("replays a previously written value instead of a fresh call", () => {
    const service = makeService("true");
    const data = { places: [{ id: "abc" }] };

    service.write(namespace, "restaurant_oran", data);

    expect(service.read(namespace, "restaurant_oran")).toEqual(data);
  });

  it("never reads or writes when disabled", () => {
    const service = makeService("false");

    service.write(namespace, "restaurant_oran", { places: [] });

    expect(service.read(namespace, "restaurant_oran")).toBeNull();
  });

  it("counts misses (real Google calls) and hits (replayed responses) separately", () => {
    const service = makeService("true");

    service.read(namespace, "restaurant_oran");
    service.write(namespace, "restaurant_oran", { places: [] });
    service.read(namespace, "restaurant_oran");
    service.read(namespace, "restaurant_oran");

    expect(service.stats).toEqual({ hits: 2, misses: 1 });
  });
});
