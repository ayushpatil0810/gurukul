import type { ContainerFacts, RunOutcome } from "@/sandbox/types";

const BLOCKED_STDERR = [
  /read-only file system/i,
  /\bEROFS\b/,
  /operation not permitted/i,
  /\bEPERM\b/,
  /permission denied/i,
  /\bEACCES\b/,
  /network is unreachable/i,
  /\bENETUNREACH\b/,
  /network is down/i,
  /\bENETDOWN\b/,
  /getaddrinfo/i,
  /\bEAI_NONAME\b/,
  /\bEAI_AGAIN\b/,
  /bad system call/i,
  /cannot assign requested address/i,
  /\bEADDRNOTAVAIL\b/,
  /unknown host/i,
  /UnknownHostException/,
  /name or service not known/i,
  /temporary failure in name resolution/i,
  /no address associated/i,
];

const MEMORY_STDERR = [
  /cannot allocate memory/i,
  /out of memory/i,
  /\bENOMEM\b/,
  /javascript heap out of memory/i,
  /std::bad_alloc/,
  /java\.lang\.OutOfMemoryError/,
];

export function classifyRun(facts: ContainerFacts): {
  outcome: RunOutcome;
  message: string;
} {
  if (facts.outputCapped) {
    return {
      outcome: "output_limit",
      message: "The program wrote more output than the limit allows.",
    };
  }

  const combined = `${facts.stderr}\n${facts.stdout}`;
  if (/unable to create native thread/i.test(combined)) {
    return {
      outcome: "blocked_operation",
      message: "The program tried an operation the sandbox does not allow.",
    };
  }

  if (facts.oomKilled || matches(combined, MEMORY_STDERR)) {
    return {
      outcome: "memory_limit",
      message: "The program used more memory than the limit allows.",
    };
  }

  if (facts.timedOut) {
    return {
      outcome: "timeout",
      message: "The program ran longer than the time limit.",
    };
  }

  if (facts.exitCode === 65) {
    return {
      outcome: "compile_error",
      message: "The program did not compile.",
    };
  }

  if (
    facts.exitCode === 152 ||
    facts.exitCode === 24 ||
    (facts.cpuLimitLikely && facts.exitCode === 137)
  ) {
    return {
      outcome: "timeout",
      message: "The program ran longer than the time limit.",
    };
  }

  const processLimit =
    facts.exitCode !== 0 &&
    facts.exitCode !== null &&
    /resource temporarily unavailable|posix_spawn failed|\bEAGAIN\b/i.test(combined);

  if (matches(combined, BLOCKED_STDERR) || facts.exitCode === 159 || facts.exitCode === 137 || processLimit) {
    return {
      outcome: "blocked_operation",
      message: "The program tried an operation the sandbox does not allow.",
    };
  }

  if (facts.exitCode === 0) {
    return {
      outcome: "ok",
      message: "The program finished.",
    };
  }

  return {
    outcome: "runtime_error",
    message: "The program stopped with an error.",
  };
}

function matches(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}
