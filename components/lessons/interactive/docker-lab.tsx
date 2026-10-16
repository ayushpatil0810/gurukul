"use client";

import { useState } from "react";

type SelectedFile = "Dockerfile" | "package.json" | "src/server.js" | ".dockerignore";

const fileContents: Record<SelectedFile, string> = {
  Dockerfile: `# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Minimal Distroless Production Runtime
FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
EXPOSE 8080
USER nonroot
CMD ["src/server.js"]`,

  "package.json": `{
  "name": "learnloop-microservice",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/server.js"
  },
  "dependencies": {
    "fastify": "^4.26.0"
  }
}`,

  "src/server.js": `import fastify from "fastify";
const app = fastify({ logger: false });

app.get("/healthz", async () => ({ status: "ok", uptime: process.uptime() }));
app.get("/api/v1/summary", async () => ({ message: "Delivery pipeline operational" }));

app.listen({ port: 8080, host: "0.0.0.0" });`,

  ".dockerignore": `node_modules
npm-debug.log
.git
.env
dist`,
};

export function DockerLab() {
  const [selectedFile, setSelectedFile] = useState<SelectedFile>("Dockerfile");
  const [buildStatus, setBuildStatus] = useState<"unbuilt" | "building" | "built">("unbuilt");
  const [containerRunning, setContainerRunning] = useState(false);
  const [healthResponse, setHealthResponse] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "Docker Engine ready. Multi-stage build context initialized.",
  ]);

  function handleBuild() {
    setBuildStatus("building");
    setLogs((prev) => [
      ...prev,
      "$ docker build -t learnloop/api:1.0 .",
      "[1/5] FROM node:20-alpine AS builder",
      "[2/5] WORKDIR /app",
      "[3/5] COPY package*.json ./ && RUN npm ci --omit=dev",
      "[4/5] FROM gcr.io/distroless/nodejs20-debian12",
      "[5/5] COPY --from=builder /app/node_modules ./node_modules",
      "Successfully built image sha256:7f4a9b2c (Size: 48.2MB)",
    ]);
    setTimeout(() => {
      setBuildStatus("built");
    }, 600);
  }

  function handleRun() {
    setContainerRunning(true);
    setLogs((prev) => [
      ...prev,
      "$ docker run -d -p 8080:8080 --name web-api learnloop/api:1.0",
      "Container 9c4f1a8e started on 0.0.0.0:8080->8080/tcp",
    ]);
  }

  function handleHealthCheck() {
    setHealthResponse(`HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"status":"ok","uptime":42,"service":"learnloop-microservice"}`);
    setLogs((prev) => [
      ...prev,
      "$ curl -i http://localhost:8080/healthz",
      "HTTP/1.1 200 OK -> Healthy probe response verified.",
    ]);
  }

  function handleReset() {
    setBuildStatus("unbuilt");
    setContainerRunning(false);
    setHealthResponse(null);
    setLogs(["Lab reset. Ready for container image build."]);
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm tracking-tight">
              Interactive Docker & Container Lab
            </h3>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary">
              Simulated Runtime
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Explore multi-stage image packaging, layer caching, and isolated runtime lifecycles.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="rounded border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          Reset Lab
        </button>
      </div>

      {/* Main Lab Layout: File Browser + Viewer */}
      <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
        {/* File Tree */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-2 text-xs">
          <p className="px-2 py-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
            Files
          </p>
          <div className="mt-1 space-y-1">
            {(["Dockerfile", "package.json", "src/server.js", ".dockerignore"] as SelectedFile[]).map((file) => (
              <button
                key={file}
                type="button"
                onClick={() => setSelectedFile(file)}
                className={`w-full rounded px-2 py-1 text-left font-mono text-[11px] truncate transition-colors ${
                  selectedFile === file
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {file}
              </button>
            ))}
          </div>
        </div>

        {/* Code Content */}
        <div className="rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-200 dark:bg-black">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-[11px] text-zinc-400">
            <span>{selectedFile}</span>
            {selectedFile === "Dockerfile" ? (
              <span className="text-[10px] text-emerald-400">Multi-stage build enabled</span>
            ) : null}
          </div>
          <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre leading-relaxed text-zinc-300">
            {fileContents[selectedFile]}
          </pre>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={buildStatus !== "unbuilt"}
          onClick={handleBuild}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {buildStatus === "building" ? "Building Image…" : "1. Build Container Image"}
        </button>

        <button
          type="button"
          disabled={buildStatus !== "built" || containerRunning}
          onClick={handleRun}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
        >
          {containerRunning ? "Container Active" : "2. Run Container (:8080)"}
        </button>

        <button
          type="button"
          disabled={!containerRunning}
          onClick={handleHealthCheck}
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          3. Test Health Endpoint (/healthz)
        </button>
      </div>

      {/* Health Check Response Modal/Card if tested */}
      {healthResponse ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 font-mono text-xs text-emerald-800 dark:text-emerald-300">
          <div className="font-semibold pb-1">Verified HTTP Probe Response:</div>
          <pre className="whitespace-pre overflow-x-auto text-[11px]">{healthResponse}</pre>
        </div>
      ) : null}

      {/* Terminal Activity Log */}
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-foreground">Docker Engine Terminal Logs:</span>
        <div className="max-h-24 overflow-y-auto rounded bg-zinc-950 p-2 font-mono text-[10px] text-zinc-400 dark:bg-black">
          {logs.map((log, i) => (
            <div
              key={i}
              className={`py-0.5 ${
                log.startsWith("$")
                  ? "text-primary font-semibold"
                  : log.includes("Successfully") || log.includes("Healthy")
                    ? "text-emerald-400"
                    : "text-zinc-400"
              }`}
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
