import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import type { SandboxRunner } from "@/sandbox/types";
import { createSandboxQueue, startSandboxWorker } from "@/worker/sandbox";

const redisUrl = process.env.REDIS_URL;

describe("sandbox worker", () => {
  const closers: Array<() => Promise<unknown>> = [];

  afterAll(async () => {
    await Promise.all(closers.map((close) => close()));
  });

  it.skipIf(!redisUrl)("returns the runner result for a queued job", async () => {
    const name = `sandbox-run-test-${randomUUID()}`;
    const runner: SandboxRunner = {
      async run(language, code, stdin) {
        return {
          outcome: "ok",
          stdout: `${language}:${code}:${stdin}`,
          stderr: "",
          exitCode: 0,
          timedOut: false,
          durationMs: 1,
          message: "The program finished.",
        };
      },
    };
    const started = startSandboxWorker(redisUrl ?? "", runner, name);
    const queued = createSandboxQueue(redisUrl ?? "", name);
    closers.push(() => started.worker.close(), () => queued.queue.close(), () => started.connection.quit(), () => queued.connection.quit());

    const result = await new Promise<unknown>((resolve, reject) => {
      started.worker.on("completed", (_job, value) => resolve(value));
      started.worker.on("failed", (_job, error) => reject(error));
      void queued.queue.add("run", { language: "javascript", code: "print", stdin: "hi" });
    });

    expect(result).toMatchObject({ outcome: "ok", stdout: "javascript:print:hi" });
  });
});
