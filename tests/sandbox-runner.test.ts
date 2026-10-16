import { describe, expect, it } from "vitest";

import { DockerSandboxRunner } from "@/sandbox/docker-runner";
import { gradeOutput } from "@/sandbox/grade";

const runner = new DockerSandboxRunner();

describe("DockerSandboxRunner", () => {
  it("runs a javascript program and grades stdout outside the container", async () => {
    const result = await runner.run(
      "javascript",
      "const fs = require('fs'); const line = fs.readFileSync(0, 'utf8'); process.stdout.write(String(Number(line) + 1));",
      "41\n",
    );
    expect(result.outcome).toBe("ok");
    expect(result.stdout).toBe("42");
    const graded = gradeOutput(result, "not-the-program-output");
    expect(graded.outcome).toBe("wrong_answer");
    expect(JSON.stringify(graded)).not.toContain("not-the-program-output");
  }, 60_000);

  it("runs a C++ program", async () => {
    const result = await runner.run(
      "cpp",
      '#include <iostream>\nint main(){std::cout<<"hello\\n";}\n',
      "",
    );
    expect(result.outcome).toBe("ok");
    expect(result.stdout).toContain("hello");
  }, 60_000);

  it("runs a Java program", async () => {
    const result = await runner.run(
      "java",
      'public class Main { public static void main(String[] args) { System.out.print("hello\\n"); } }\n',
      "",
    );
    expect(result.outcome).toBe("ok");
    expect(result.stdout).toContain("hello");
  }, 90_000);

  it("reports a C++ compile error", async () => {
    const result = await runner.run("cpp", "int main( {", "");
    expect(result.outcome).toBe("compile_error");
  }, 60_000);
});
