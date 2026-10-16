import { env } from "@/lib/env";
import { DockerSandboxRunner } from "@/sandbox/docker-runner";
import { SANDBOX_QUEUE, startSandboxWorker } from "@/worker/sandbox";

const redisUrl = env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is required to start the sandbox worker.");
}

const { worker } = startSandboxWorker(redisUrl, new DockerSandboxRunner(), SANDBOX_QUEUE);
console.log("Sandbox worker listening on", SANDBOX_QUEUE);

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
