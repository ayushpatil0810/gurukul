import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { containerCreateArgs } from "@/sandbox/args";
import { classifyRun } from "@/sandbox/classify";
import {
  resolveLimits,
  type RunLimits,
  type RunResult,
  type SandboxRunner,
  type SubmissionLanguage,
} from "@/sandbox/types";

const SECCOMP_PATH = path.join(process.cwd(), "sandbox", "seccomp.json").replaceAll("\\", "/");

type Collected = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputCapped: boolean;
};

let runtimeDetection: Promise<string | undefined> | undefined;

export class DockerSandboxRunner implements SandboxRunner {
  async run(
    language: SubmissionLanguage,
    code: string,
    stdin: string,
    limits?: Partial<RunLimits>,
  ): Promise<RunResult> {
    const resolved = resolveLimits(limits);
    const runtime = await detectRuntime();
    const name = `portal-sbx-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const started = Date.now();
    const source = Buffer.from(code, "utf8");
    const payload = Buffer.concat([
      Buffer.from(`${source.length}\n`, "utf8"),
      source,
      Buffer.from(stdin, "utf8"),
    ]);

    try {
      const created = await docker(
        containerCreateArgs({
          name,
          language,
          limits: resolved,
          seccompPath: SECCOMP_PATH,
          runtime,
        }),
      );
      if (created.code !== 0) {
        throw new Error(created.stderr.trim() || "The sandbox could not be created.");
      }

      const ranAt = Date.now();
      const collected = await startAndCollect(name, payload, resolved);
      const inspected = await inspectContainer(name);
      const durationMs = Date.now() - started;
      const runMs = Date.now() - ranAt;
      const classified = classifyRun({
        stdout: collected.stdout,
        stderr: collected.stderr,
        exitCode: inspected.exitCode ?? collected.exitCode,
        timedOut: collected.timedOut,
        oomKilled: inspected.oomKilled,
        outputCapped: collected.outputCapped,
        cpuLimitLikely:
          !collected.timedOut &&
          !inspected.oomKilled &&
          (inspected.exitCode ?? collected.exitCode) === 137 &&
          runMs >= resolved.cpuSeconds * 1000 - 400,
      });

      return {
        outcome: classified.outcome,
        stdout: collected.stdout,
        stderr: collected.stderr.slice(0, resolved.outputBytes),
        exitCode: inspected.exitCode ?? collected.exitCode,
        timedOut: collected.timedOut,
        durationMs,
        message: classified.message,
      };
    } finally {
      await docker(["rm", "-f", name]).catch(() => undefined);
    }
  }
}

export function detectRuntime(): Promise<string | undefined> {
  runtimeDetection ??= docker(["info", "-f", "{{json .Runtimes}}"])
    .then((result) => (result.stdout.includes("runsc") ? "runsc" : undefined))
    .catch(() => undefined);
  return runtimeDetection;
}

function startAndCollect(name: string, stdin: Buffer, limits: RunLimits): Promise<Collected> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["start", "-a", "-i", name], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let captured = 0;
    let timedOut = false;
    let outputCapped = false;
    let settled = false;

    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(wall);
      resolve({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        timedOut,
        outputCapped,
      });
    };

    const stop = () => {
      const killer = spawn("docker", ["kill", name], { windowsHide: true });
      killer.on("error", () => undefined);
    };

    const wall = setTimeout(() => {
      timedOut = true;
      stop();
    }, limits.wallSeconds * 1000);

    const take = (chunk: Buffer, chunks: Buffer[]) => {
      if (outputCapped || captured >= limits.outputBytes) {
        outputCapped = true;
        stop();
        return;
      }
      if (captured + chunk.length > limits.outputBytes) {
        chunks.push(chunk.subarray(0, limits.outputBytes - captured));
        captured = limits.outputBytes;
        outputCapped = true;
        stop();
        return;
      }
      chunks.push(chunk);
      captured += chunk.length;
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      take(chunk, stdoutChunks);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      take(chunk, stderrChunks);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(wall);
      reject(error);
    });
    child.on("close", (code) => finish(code));
    child.stdin?.on("error", () => undefined);
    child.stdin?.end(stdin);
  });
}

async function inspectContainer(name: string): Promise<{ oomKilled: boolean; exitCode: number | null }> {
  const result = await docker(["inspect", "-f", "{{.State.OOMKilled}} {{.State.ExitCode}}", name]);
  if (result.code !== 0) return { oomKilled: false, exitCode: null };
  const [oom, code] = result.stdout.trim().split(/\s+/);
  const exitCode = Number(code);
  return {
    oomKilled: oom === "true",
    exitCode: Number.isInteger(exitCode) ? exitCode : null,
  };
}

function docker(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}
