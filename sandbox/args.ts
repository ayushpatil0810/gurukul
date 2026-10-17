import type { RunLimits, SubmissionLanguage } from "@/sandbox/types";

const LANGUAGE_IMAGES: Record<SubmissionLanguage, string> = {
  javascript: "node:22-bookworm-slim",
  cpp: "gcc:14-bookworm",
  java: "eclipse-temurin:21-jdk-jammy",
};

const SOURCE_FILE: Record<SubmissionLanguage, string> = {
  javascript: "main.js",
  cpp: "main.cpp",
  java: "Main.java",
};

/** Ceiling for the compiler. Student code is limited separately with ulimit. */
const CONTAINER_CPU_CEILING_SECONDS = 30;

export function sourceFile(language: SubmissionLanguage): string {
  return SOURCE_FILE[language];
}

/**
 * The program arrives on stdin as "<byte length>\\n" plus the source bytes.
 * The wrapper writes that source onto the scratch tmpfs, then leaves the
 * remaining stdin for the student program. Nothing is copied onto the rootfs.
 */
export function containerCommand(language: SubmissionLanguage, limits: RunLimits): string[] {
  const cpu = limits.cpuSeconds;
  const file = `/sandbox/${SOURCE_FILE[language]}`;
  const readSource = `set -eu; IFS= read -r n; head -c "$n" > ${file};`;
  if (language === "javascript") {
    return ["sh", "-c", `${readSource} ulimit -t ${cpu}; exec node ${file}`];
  }
  if (language === "cpp") {
    return [
      "sh",
      "-c",
      `${readSource} g++ -std=c++17 -O2 -pipe -o /sandbox/a.out ${file} > /sandbox/compile.txt 2>&1 || { cat /sandbox/compile.txt >&2; exit 65; }; ulimit -t ${cpu}; exec /sandbox/a.out`,
    ];
  }
  return [
    "sh",
    "-c",
    `${readSource} javac -d /sandbox ${file} > /sandbox/compile.txt 2>&1 || { cat /sandbox/compile.txt >&2; exit 65; }; ulimit -t ${cpu}; exec java -Xmx64m -Xms16m -XX:MaxMetaspaceSize=48m -Djava.io.tmpdir=/tmp -cp /sandbox Main`,
  ];
}

export function containerCreateArgs(input: {
  name: string;
  language: SubmissionLanguage;
  limits: RunLimits;
  seccompPath: string;
  runtime?: string;
}): string[] {
  const { limits } = input;
  const args = [
    "create",
    "--name",
    input.name,
    "-i",
    "--network",
    "none",
    "--read-only",
    "--tmpfs",
    `/sandbox:rw,exec,nosuid,nodev,size=${limits.tmpfsMb}m,mode=1777`,
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=8m,mode=1777",
    "--user",
    "65534:65534",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--security-opt",
    `seccomp=${input.seccompPath}`,
    "--pids-limit",
    String(limits.pids),
    "--memory",
    `${limits.memoryMb}m`,
    "--memory-swap",
    `${limits.memoryMb}m`,
    "--cpus",
    "1",
    "--ulimit",
    `cpu=${CONTAINER_CPU_CEILING_SECONDS}`,
    "--ulimit",
    `nproc=${limits.pids}`,
    "--ulimit",
    "fsize=2097152",
    "--stop-timeout",
    "1",
    "--init",
    "-e",
    "HOME=/sandbox",
    "-e",
    "TMPDIR=/tmp",
    "-e",
    "LANG=C.UTF-8",
    "-w",
    "/sandbox",
  ];

  if (input.runtime) {
    args.push("--runtime", input.runtime);
  }

  args.push(LANGUAGE_IMAGES[input.language], ...containerCommand(input.language, limits));
  return args;
}
