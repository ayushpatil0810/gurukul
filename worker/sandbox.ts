import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

import type { RunLimits, RunResult, SandboxRunner, SubmissionLanguage } from "@/sandbox/types";

export const SANDBOX_QUEUE = "sandbox-run";

export type SandboxJob = {
  language: SubmissionLanguage;
  code: string;
  stdin: string;
  limits?: Partial<RunLimits>;
};

export function createRedis(url: string) {
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export function createSandboxQueue(url: string, name = SANDBOX_QUEUE) {
  const connection = createRedis(url);
  return { queue: new Queue<SandboxJob, RunResult>(name, { connection }), connection };
}

export function startSandboxWorker(url: string, runner: SandboxRunner, name = SANDBOX_QUEUE) {
  const connection = createRedis(url);
  const worker = new Worker<SandboxJob, RunResult>(
    name,
    async (job) => runner.run(job.data.language, job.data.code, job.data.stdin, job.data.limits),
    { connection, concurrency: 2 },
  );
  return { worker, connection };
}
