import { describe, expect, it } from "vitest";

import { RateLimitError, RunQueue } from "@/sandbox/queue";

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("RunQueue", () => {
  it("runs a benign job while a slower job is still in the pool", async () => {
    const queue = new RunQueue({ concurrency: 2, perStudentPerMinute: 10 });
    const release = deferred();
    let benignFinished = false;

    const slow = queue.submit("ada", () => release.promise.then(() => "slow"));
    const benign = queue.submit("ben", async () => {
      benignFinished = true;
      return "ok";
    });

    await expect(benign).resolves.toBe("ok");
    expect(benignFinished).toBe(true);
    let slowDone = false;
    void slow.then(() => {
      slowDone = true;
    });
    await Promise.resolve();
    expect(slowDone).toBe(false);
    release.resolve();
    await expect(slow).resolves.toBe("slow");
  });

  it("does not overlap jobs past the concurrency limit", async () => {
    const queue = new RunQueue({ concurrency: 1, perStudentPerMinute: 10 });
    const order: string[] = [];
    const release = deferred();

    const first = queue.submit("ada", () => release.promise.then(() => order.push("first")));
    const second = queue.submit("ada", async () => {
      order.push("second");
    });

    await Promise.resolve();
    expect(order).toEqual([]);
    release.resolve();
    await first;
    await second;
    expect(order).toEqual(["first", "second"]);
  });

  it("rejects the next run after the per-student limit", async () => {
    let now = 1_000_000;
    const queue = new RunQueue({
      concurrency: 4,
      perStudentPerMinute: 2,
      now: () => now,
    });

    await queue.submit("ada", async () => "one");
    await queue.submit("ada", async () => "two");
    expect(() => queue.submit("ada", async () => "three")).toThrow(RateLimitError);
    await queue.submit("ben", async () => "other");

    now += 60_001;
    await expect(queue.submit("ada", async () => "later")).resolves.toBe("later");
  });
});
