import { describe, expect, it } from "vitest";

import { containerCommand, containerCreateArgs } from "@/sandbox/args";
import { DEFAULT_LIMITS } from "@/sandbox/types";

const args = containerCreateArgs({
  name: "portal-sbx-test",
  language: "javascript",
  limits: DEFAULT_LIMITS,
  seccompPath: "D:/project/sandbox/seccomp.json",
});

describe("containerCreateArgs", () => {
  it("drops the network, capabilities, and host mounts", () => {
    expect(args).toContain("--network");
    expect(args).toContain("none");
    expect(args).toContain("--read-only");
    expect(args).toContain("--cap-drop");
    expect(args).toContain("ALL");
    expect(args).toContain("no-new-privileges");
    expect(args.some((arg) => arg.startsWith("seccomp="))).toBe(true);
    expect(args).toContain("--pids-limit");
    expect(args).toContain("64");
    expect(args).toContain("256m");
    expect(args).toContain("--user");
    expect(args).toContain("65534:65534");
    expect(args.join(" ")).not.toContain("-v ");
    expect(args).not.toContain("--privileged");
    expect(args.join("\n")).not.toContain("expected");
  });

  it("applies the student cpu limit only after compilation", () => {
    expect(containerCommand("javascript", DEFAULT_LIMITS).join(" ")).toContain("ulimit -t 2");
    expect(containerCommand("cpp", DEFAULT_LIMITS).join(" ")).toContain("exit 65");
    expect(containerCommand("java", DEFAULT_LIMITS).join(" ")).toContain("javac");
    expect(containerCommand("java", DEFAULT_LIMITS).join(" ")).toContain("ulimit -t 2");
  });
});
