export class RateLimitError extends Error {
  readonly statusCode = 429;

  constructor(message = "Too many runs. Wait a moment and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

type Job<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

/**
 * Bounded in-process pool. The request path uses this so a run does not need
 * a second process. A BullMQ worker shares the same sandbox runner.
 */
export class RunQueue {
  private active = 0;
  private readonly waiting: Job<unknown>[] = [];
  private readonly recent = new Map<string, number[]>();

  constructor(
    private readonly options: {
      concurrency: number;
      perStudentPerMinute: number;
      now?: () => number;
    },
  ) {}

  submit<T>(studentId: string, run: () => Promise<T>): Promise<T> {
    this.consume(studentId);
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({
        run,
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.pump();
    });
  }

  private consume(studentId: string) {
    const now = this.options.now?.() ?? Date.now();
    const stamps = (this.recent.get(studentId) ?? []).filter((stamp) => now - stamp < 60_000);
    if (stamps.length >= this.options.perStudentPerMinute) {
      this.recent.set(studentId, stamps);
      throw new RateLimitError();
    }
    stamps.push(now);
    this.recent.set(studentId, stamps);
  }

  private pump() {
    while (this.active < this.options.concurrency && this.waiting.length > 0) {
      const job = this.waiting.shift();
      if (!job) return;
      this.active += 1;
      job
        .run()
        .then(job.resolve, job.reject)
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }
}
