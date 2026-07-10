import { BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from "@nestjs/common";

/** Minimal logging surface required by GoogleRequestExecutor; a Nest Logger satisfies it. */
export interface RequestLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface GoogleRequestExecutorStats {
  totalRequests: number;
  totalDurationMs: number;
  maxConcurrentRequests: number;
}

/**
 * Runs Google API calls with controlled parallelism (a counting semaphore
 * capping in-flight requests), exponential-backoff retries on transient
 * failures, and a per-attempt timeout. One instance is meant to live for the
 * duration of a single grid search, so its stats never leak across searches.
 */
export class GoogleRequestExecutor {
  readonly stats: GoogleRequestExecutorStats = {
    totalRequests: 0,
    totalDurationMs: 0,
    maxConcurrentRequests: 0,
  };

  private activeRequests = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly maxConcurrency: number,
    private readonly maxAttempts: number,
    private readonly retryBaseDelayMs: number,
    private readonly timeoutMs: number,
    private readonly logger: RequestLogger,
  ) {}

  async run<T>(label: string, task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await this.executeWithRetry(label, task);
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.activeRequests < this.maxConcurrency) {
      this.activeRequests += 1;
      this.trackConcurrency();
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waiters.push(() => {
        this.activeRequests += 1;
        this.trackConcurrency();
        resolve();
      });
    });
  }

  private release(): void {
    this.activeRequests -= 1;
    const next = this.waiters.shift();
    next?.();
  }

  private trackConcurrency(): void {
    this.stats.maxConcurrentRequests = Math.max(this.stats.maxConcurrentRequests, this.activeRequests);
  }

  private async executeWithRetry<T>(label: string, task: () => Promise<T>): Promise<T> {
    let attempt = 0;

    for (;;) {
      attempt += 1;
      const startedAt = Date.now();

      try {
        const result = await this.withTimeout(task(), label);
        this.recordAttempt(Date.now() - startedAt);
        this.logger.log(
          `${label} succeeded in ${Date.now() - startedAt}ms (attempt ${attempt}/${this.maxAttempts})`,
        );
        return result;
      } catch (error) {
        this.recordAttempt(Date.now() - startedAt);
        const canRetry = attempt < this.maxAttempts && this.isRetryable(error);
        if (!canRetry) {
          this.logger.error(`${label} failed permanently after ${attempt} attempt(s): ${this.describe(error)}`);
          throw error;
        }

        const backoffMs = this.retryBaseDelayMs * 2 ** (attempt - 1);
        this.logger.warn(
          `${label} failed (attempt ${attempt}/${this.maxAttempts}): ${this.describe(error)}. Retrying in ${backoffMs}ms`,
        );
        await this.delay(backoffMs);
      }
    }
  }

  /** Only network/availability failures are retried; a permanent error (e.g. bad config) never is. */
  private isRetryable(error: unknown): boolean {
    return (
      error instanceof GatewayTimeoutException ||
      error instanceof ServiceUnavailableException ||
      error instanceof BadGatewayException
    );
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : "unknown error";
  }

  private recordAttempt(durationMs: number): void {
    this.stats.totalRequests += 1;
    this.stats.totalDurationMs += durationMs;
  }

  private withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
