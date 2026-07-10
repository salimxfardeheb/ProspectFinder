import { BadGatewayException, InternalServerErrorException, ServiceUnavailableException } from "@nestjs/common";

import { GoogleRequestExecutor, RequestLogger } from "./google-request-executor";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const silentLogger: RequestLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe("GoogleRequestExecutor", () => {
  it("never runs more tasks concurrently than the configured limit", async () => {
    const executor = new GoogleRequestExecutor(2, 1, 0, 1000, silentLogger);
    let active = 0;
    let peakObserved = 0;

    const tasks = Array.from({ length: 6 }, (_, index) =>
      executor.run(`task-${index}`, async () => {
        active += 1;
        peakObserved = Math.max(peakObserved, active);
        await delay(20);
        active -= 1;
        return index;
      }),
    );

    const results = await Promise.all(tasks);

    expect(peakObserved).toBeLessThanOrEqual(2);
    expect(executor.stats.maxConcurrentRequests).toBeLessThanOrEqual(2);
    // The limiter throttles rather than drops work: every task still completes, in order.
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("retries a transient failure with exponential backoff and eventually succeeds", async () => {
    const executor = new GoogleRequestExecutor(1, 3, 10, 1000, silentLogger);
    let attempts = 0;

    const result = await executor.run("flaky", async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new ServiceUnavailableException("temporary");
      }
      return "ok";
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
    expect(executor.stats.totalRequests).toBe(3);
    expect(executor.stats.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("does not retry a non-transient error", async () => {
    const executor = new GoogleRequestExecutor(1, 3, 10, 1000, silentLogger);
    let attempts = 0;

    await expect(
      executor.run("bad-config", async () => {
        attempts += 1;
        throw new InternalServerErrorException("API key missing");
      }),
    ).rejects.toThrow(InternalServerErrorException);

    expect(attempts).toBe(1);
    expect(executor.stats.totalRequests).toBe(1);
  });

  it("gives up after exhausting the retry attempts and surfaces the last error", async () => {
    const executor = new GoogleRequestExecutor(1, 2, 5, 1000, silentLogger);
    let attempts = 0;

    await expect(
      executor.run("always-down", async () => {
        attempts += 1;
        throw new BadGatewayException("still down");
      }),
    ).rejects.toThrow(BadGatewayException);

    expect(attempts).toBe(2);
    expect(executor.stats.totalRequests).toBe(2);
  });

  it("times out a task that runs longer than the configured timeout", async () => {
    const executor = new GoogleRequestExecutor(1, 1, 0, 30, silentLogger);

    await expect(executor.run("slow", () => delay(200).then(() => "too-late"))).rejects.toThrow(
      /timed out after 30ms/,
    );
  });
});
