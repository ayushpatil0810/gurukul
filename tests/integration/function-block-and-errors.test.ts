import { describe, expect, it } from "vitest";
import { prepareExecutionCode } from "@/lib/engine/harness";
import { DEMO_QUESTIONS } from "@/seed/catalog";
import { toHiddenResults, toVisibleResults } from "@/lib/engine/attempt-result";

describe("Function Block & Error Display Suite", () => {
  it("wraps clean function block with runtime test harness for sum question", () => {
    const studentCode = `function sum(a, b) {\n  return a + b;\n}`;
    const prepared = prepareExecutionCode(
      "Read two integers and print their sum.",
      "javascript",
      studentCode,
    );

    expect(prepared).toContain("function sum(a, b)");
    expect(prepared).toContain("fs.readFileSync");
    expect(prepared).toContain("sum(_a, _b)");
  });

  it("leaves code untouched if student manually writes I/O", () => {
    const manualCode = `const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);`;
    const prepared = prepareExecutionCode(
      "Read two integers and print their sum.",
      "javascript",
      manualCode,
    );

    expect(prepared).toBe(manualCode);
  });

  it("handles OOP and inheritance function blocks cleanly", () => {
    const squareCode = `class Shape {}\nclass Square extends Shape {\n  constructor(side) { super(); this.side = side; }\n  area() { return this.side * this.side; }\n}`;
    const prepared = prepareExecutionCode(
      "Extend Shape with Square.area and print the area of the side length on stdin.",
      "javascript",
      squareCode,
    );

    expect(prepared).toContain("new Square(_side)");
    expect(prepared).toContain("_obj.area()");
  });


  it("has expanded test cases (at least 3 visible and 4 hidden) for all demo questions", () => {
    for (const q of DEMO_QUESTIONS) {
      expect(
        q.visibleTests.length,
        `Question "${q.statement}" should have at least 3 visible tests`,
      ).toBeGreaterThanOrEqual(3);

      expect(
        q.hiddenTests.length,
        `Question "${q.statement}" should have at least 4 hidden tests`,
      ).toBeGreaterThanOrEqual(4);

      // Starter code must be function or class block, not raw stdin reader
      expect(
        q.starter,
        `Starter code for "${q.statement}" should not contain readFileSync`,
      ).not.toContain("readFileSync");
    }
  });

  it("captures syntax and compilation errors in toHiddenResults and toVisibleResults", () => {
    const syntaxErrorStderr = `/sandbox/main.js:2\n  return a + ;\n             ^\nSyntaxError: Unexpected token ';'`;

    const visible = toVisibleResults([
      {
        id: "t1",
        outcome: "compile_error",
        stdout: "",
        stderr: syntaxErrorStderr,
        exitCode: 65,
        durationMs: 120,
        message: "The program did not compile.",
      },
    ]);

    expect(visible[0].passed).toBe(false);
    expect(visible[0].stderr).toContain("SyntaxError: Unexpected token ';'");

    const hidden = toHiddenResults([
      {
        id: "h1",
        outcome: "compile_error",
        message: "The program did not compile.",
        stderr: syntaxErrorStderr,
      },
    ]);

    expect(hidden.passed).toBe(0);
    expect(hidden.compilationError).toContain("SyntaxError: Unexpected token ';'");
    expect(hidden.tests[0].stderr).toContain("SyntaxError: Unexpected token ';'");
  });
});
