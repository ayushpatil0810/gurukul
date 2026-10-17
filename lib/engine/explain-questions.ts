import type { RunResult, SandboxRunner, SubmissionLanguage } from "@/sandbox/types";

const EXPLAIN_SOURCE = "line-scan-v1";

const KEYWORDS = new Set([
  "function",
  "return",
  "if",
  "else",
  "const",
  "let",
  "var",
  "for",
  "while",
  "class",
  "public",
  "static",
  "void",
  "int",
  "string",
  "true",
  "false",
  "null",
  "new",
  "this",
  "async",
  "await",
  "from",
  "import",
  "export",
]);

export type ExplainQuestionType = "trace" | "edge" | "reasoning" | "mutation";

export type ExplainDraft = {
  type: ExplainQuestionType;
  prompt: string;
  startLine: number;
  endLine: number;
  quote: string;
  grounded: true;
  execution: boolean;
  grader: {
    method: "sandbox" | "facts";
    expected: string | null;
    tokens: string[];
    literal: string | null;
  };
};

export type ExplainGrade = {
  verdict: "yes" | "partial" | "no" | null;
  reviewStatus: "none" | "needs_review";
  evidence: string[];
  missed: string[];
  confidence: number | null;
  method: "sandbox" | "facts" | "none";
};

type SourceLine = { number: number; text: string };

const blankRun: RunResult = {
  outcome: "runtime_error",
  stdout: "",
  stderr: "",
  exitCode: 1,
  timedOut: false,
  durationMs: 0,
  message: "The probe did not run",
};

export async function generateExplainQuestions(input: {
  code: string;
  language: SubmissionLanguage;
  runner: SandboxRunner;
}): Promise<{ questions: ExplainDraft[]; note: string | null }> {
  const scanned = scanLines(input.code);
  const drafted: ExplainDraft[] = [];
  const traced = await traceQuestion(input.code, input.language, scanned, input.runner);
  if (traced) drafted.push(traced);
  const edge = await edgeQuestion(input.code, input.language, scanned, input.runner, traced?.grader.expected ?? null);
  if (edge) drafted.push(edge);
  const mutated = await mutationQuestion(input.code, input.language, scanned, input.runner);
  if (mutated && drafted.length < 3) drafted.push(mutated);
  const rankedReasons = reasoningLines(scanned).sort(
    (left, right) => Number(hasLiteral(right.text)) - Number(hasLiteral(left.text)),
  );
  for (const line of rankedReasons) {
    if (drafted.length >= 3) break;
    if (drafted.some((item) => item.startLine === line.number && item.type === "reasoning")) continue;
    const question = reasoningQuestion(line);
    if (question) drafted.push(question);
  }
  if (drafted.length < 2) {
    const printed = await stdoutQuestion(input.code, input.language, scanned, input.runner);
    if (printed && !drafted.some((item) => item.type === "trace" && item.prompt === printed.prompt)) {
      drafted.push(printed);
    }
  }
  const questions = validateQuestions(drafted).slice(0, 3);
  if (questions.length < 2) {
    return {
      questions: [],
      note: "This submission does not include enough grounded structure for two questions. No generic questions were added.",
    };
  }
  return { questions, note: null };
}

function validateQuestions(questions: readonly ExplainDraft[]): ExplainDraft[] {
  return questions.filter(isValidQuestion).slice(0, 3);
}

export function questionsFromUntrusted(payload: unknown, fallback: readonly ExplainDraft[]): ExplainDraft[] {
  if (!Array.isArray(payload)) return validateQuestions(fallback).slice(0, 3);
  const accepted: ExplainDraft[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const record = item as Partial<ExplainDraft>;
    if (record.grounded !== true || !record.grader || !record.prompt || !record.type) continue;
    const draft: ExplainDraft = {
      type: record.type,
      prompt: record.prompt,
      startLine: record.startLine ?? 0,
      endLine: record.endLine ?? 0,
      quote: record.quote ?? "",
      grounded: true,
      execution: record.execution === true,
      grader: record.grader,
    };
    if (isValidQuestion(draft)) accepted.push(draft);
  }
  if (accepted.length < 2 || accepted.length > 3) return validateQuestions(fallback).slice(0, 3);
  return accepted;
}

export function gradeExplainAnswer(question: Pick<ExplainDraft, "grader" | "quote" | "startLine">, answer: string): ExplainGrade {
  const text = answer.trim();
  if (question.grader.method === "sandbox") {
    if (!question.grader.expected) {
      return insufficient("The recorded run did not produce an output to compare.");
    }
    const judged = judgeSandbox(question.grader.expected, text);
    return {
      verdict: judged,
      reviewStatus: "none",
      evidence: [`Running the submitted code produced ${show(question.grader.expected)}.`],
      missed: judged === "yes" ? [] : [`The recorded result is ${show(question.grader.expected)}.`],
      confidence: judged === "yes" ? 0.95 : judged === "partial" ? 0.6 : 0.9,
      method: "sandbox",
    };
  }
  const token = question.grader.tokens[0] ?? null;
  if (!token) return insufficient("The cited line has no name or value to check against.");
  const hasToken = hasWord(text, token);
  const literal = question.grader.literal;
  const hasLiteral = literal ? hasWord(text, literal) : true;
  if (!text) {
    return {
      verdict: "no",
      reviewStatus: "none",
      evidence: [`Line ${question.startLine} uses ${token}.`],
      missed: [`Name the role of ${token}${literal ? ` and ${literal}` : ""}.`],
      confidence: 0.8,
      method: "facts",
    };
  }
  if (hasToken && hasLiteral) {
    return {
      verdict: "yes",
      reviewStatus: "none",
      evidence: [`The answer names ${token}${literal ? ` and ${literal}` : ""}, which appear on line ${question.startLine}.`],
      missed: [],
      confidence: 0.7,
      method: "facts",
    };
  }
  if (hasToken || (literal ? hasWord(text, literal) : false)) {
    return {
      verdict: "partial",
      reviewStatus: "none",
      evidence: [`Line ${question.startLine} is: ${question.quote}`],
      missed: [hasToken ? `The value ${literal} was not mentioned.` : `The name ${token} was not mentioned.`],
      confidence: 0.55,
      method: "facts",
    };
  }
  return {
    verdict: "no",
    reviewStatus: "none",
    evidence: [`Line ${question.startLine} is: ${question.quote}`],
    missed: [`The answer does not mention ${token}.`],
    confidence: 0.75,
    method: "facts",
  };
}

function insufficient(reason: string): ExplainGrade {
  return {
    verdict: null,
    reviewStatus: "needs_review",
    evidence: [reason],
    missed: [],
    confidence: null,
    method: "none",
  };
}

async function traceQuestion(
  code: string,
  language: SubmissionLanguage,
  lines: SourceLine[],
  runner: SandboxRunner,
): Promise<ExplainDraft | null> {
  const fn = language === "javascript" ? findJsFunction(lines) : null;
  if (!fn) return null;
  const call = jsCall(fn.name, fn.params, "main");
  if (!call) return null;
  const run = await probe(runner, language, harness(code, call));
  const expected = readProbe(run);
  if (!expected) return null;
  return executionDraft({
    type: "trace",
    prompt: `What does \`${call}\` return?`,
    line: fn.line,
    expected,
  });
}

async function edgeQuestion(
  code: string,
  language: SubmissionLanguage,
  lines: SourceLine[],
  runner: SandboxRunner,
  traceExpected: string | null,
): Promise<ExplainDraft | null> {
  if (language !== "javascript") return null;
  const fn = findJsFunction(lines);
  const branch = lines.find((line) => /^\s*if\s*\(/.test(line.text));
  if (!fn || !branch) return null;
  const call = jsCall(fn.name, fn.params, "edge");
  if (!call) return null;
  const run = await probe(runner, language, harness(code, call));
  const expected = readProbe(run);
  if (!expected || expected === traceExpected) return null;
  return executionDraft({
    type: "edge",
    prompt: `On line ${branch.number}, the condition is \`${squash(branch.text)}\`. What does \`${call}\` return?`,
    line: branch,
    expected,
  });
}

async function mutationQuestion(
  code: string,
  language: SubmissionLanguage,
  lines: SourceLine[],
  runner: SandboxRunner,
): Promise<ExplainDraft | null> {
  if (language !== "javascript") return null;
  const fn = findJsFunction(lines);
  const target = lines.find((line) => /<=|>=|===|!==|==|!=/.test(line.text) && !/^\s*(?:async\s+)?function\b/.test(line.text));
  if (!fn || !target) return null;
  const swapped = swapOperator(target.text);
  if (!swapped) return null;
  const call = jsCall(fn.name, fn.params, "main");
  if (!call) return null;
  const original = await probe(runner, language, harness(code, call));
  const mutatedSource = replaceLine(code, target.number, swapped.next);
  const mutated = await probe(runner, language, harness(mutatedSource, call));
  const before = readProbe(original);
  const after = readProbe(mutated);
  if (!before || !after || before === after) return null;
  return executionDraft({
    type: "mutation",
    prompt: `If line ${target.number} used \`${swapped.to}\` instead of \`${swapped.from}\`, what would \`${call}\` return?`,
    line: target,
    expected: after,
  });
}

async function stdoutQuestion(
  code: string,
  language: SubmissionLanguage,
  lines: SourceLine[],
  runner: SandboxRunner,
): Promise<ExplainDraft | null> {
  const run = await probe(runner, language, code, "");
  if (run.outcome !== "ok") return null;
  const printed = run.stdout.trim();
  if (!printed || printed.length > 200) return null;
  const first = lines.find((line) => line.text.trim().length > 0);
  const last = [...lines].reverse().find((line) => line.text.trim().length > 0);
  if (!first || !last) return null;
  return {
    type: "trace",
    prompt: "What does this program write when it is run with no input?",
    startLine: first.number,
    endLine: last.number,
    quote: squash(first.text).slice(0, 160),
    grounded: true,
    execution: true,
    grader: { method: "sandbox", expected: printed, tokens: [], literal: null },
  };
}

function reasoningQuestion(line: SourceLine): ExplainDraft | null {
  const tokens = identifiers(line.text);
  const token = tokens[0];
  if (!token) return null;
  const literal = line.text.match(/(-?\d+(?:\.\d+)?|"[^"]*"|'[^']*')/)?.[1] ?? null;
  return {
    type: "reasoning",
    prompt: `Why is line ${line.number} (\`${squash(line.text)}\`) written that way?`,
    startLine: line.number,
    endLine: line.number,
    quote: squash(line.text).slice(0, 160),
    grounded: true,
    execution: false,
    grader: { method: "facts", expected: null, tokens: [token], literal: literal?.replace(/^['"]|['"]$/g, "") ?? null },
  };
}

function executionDraft(input: {
  type: ExplainQuestionType;
  prompt: string;
  line: SourceLine;
  expected: string;
}): ExplainDraft {
  return {
    type: input.type,
    prompt: input.prompt,
    startLine: input.line.number,
    endLine: input.line.number,
    quote: squash(input.line.text).slice(0, 160),
    grounded: true,
    execution: true,
    grader: { method: "sandbox", expected: input.expected, tokens: [], literal: null },
  };
}

function isValidQuestion(question: ExplainDraft): boolean {
  if (!question.grounded || !question.prompt || question.prompt.length > 500) return false;
  if (!Number.isInteger(question.startLine) || question.startLine < 1) return false;
  if (!Number.isInteger(question.endLine) || question.endLine < question.startLine) return false;
  if (!question.quote.trim()) return false;
  const kinds: ExplainQuestionType[] = ["trace", "edge", "reasoning", "mutation"];
  if (!kinds.includes(question.type)) return false;
  const lower = question.prompt.toLowerCase();
  if (lower.includes("reference solution") || lower.includes("hidden test") || lower.includes("expected output")) {
    return false;
  }
  if (question.grader.method === "sandbox" && question.grader.expected) {
    const escaped = question.grader.expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:returns?|result is|output is|answer is)\\s+${escaped}`, "i").test(question.prompt)) {
      return false;
    }
  }
  return true;
}

function judgeSandbox(expected: string, answer: string): "yes" | "partial" | "no" {
  if (!answer) return "no";
  const normExpected = normalizeOutput(expected);
  if (normalizeOutput(answer) === normExpected) return "yes";
  const primitive = normExpected.replace(/^"|"$/g, "");
  const tokens = answer
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[("']+|[)"',.;:!?]+$/g, ""));
  const hits = tokens.filter((token) => token === primitive || normalizeOutput(token) === normExpected);
  if (hits.length === 0) return "no";
  const numbers = tokens.flatMap((token) => token.match(/-?\d+(?:\.\d+)?/g) ?? []);
  const expectedNumbers: string[] = primitive.match(/-?\d+(?:\.\d+)?/g) ?? [];
  if (numbers.some((value) => !expectedNumbers.includes(value))) return "partial";
  return "yes";
}

function hasLiteral(text: string): boolean {
  return /(-?\d+(?:\.\d+)?|"[^"]*"|'[^']*')/.test(text);
}

function normalizeOutput(value: string): string {
  const trimmed = value.trim();
  try {
    return JSON.stringify(JSON.parse(trimmed));
  } catch {
    return trimmed;
  }
}

function scanLines(code: string): SourceLine[] {
  return code.split(/\r?\n/).map((text, index) => ({ number: index + 1, text }));
}

function findJsFunction(lines: readonly SourceLine[]): { name: string; params: string[]; line: SourceLine } | null {
  for (const line of lines) {
    const declared = line.text.match(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/);
    const assigned = line.text.match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/);
    const match = declared ?? assigned;
    if (!match?.[1]) continue;
    const params = match[2]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return { name: match[1], params, line };
  }
  return null;
}

function jsCall(name: string, params: string[], kind: "main" | "edge"): string | null {
  if (params.length > 2) return null;
  if (params.length === 0) return `${name}()`;
  const edge = params.map((param) => (looksString(param) ? '""' : "0"));
  const main = params.map((param, index) => (looksString(param) ? '"a"' : String(index + 2)));
  const args = kind === "edge" ? edge : main;
  return `${name}(${args.join(", ")})`;
}

function looksString(name: string): boolean {
  return /text|name|str|word|label/i.test(name);
}

function reasoningLines(lines: readonly SourceLine[]): SourceLine[] {
  return lines.filter(
    (line) =>
      /^\s*(if\s*\(|for\s*\(|while\s*\(|return\b|function\b)/.test(line.text) ||
      /\b(?:console\.log|System\.out|cout)\b/.test(line.text),
  );
}

function hasWord(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9_$])${escaped}(?:$|[^A-Za-z0-9_$])`, "i").test(text);
}

function identifiers(text: string): string[] {
  const found = text.match(/[A-Za-z_$][\w$]*/g) ?? [];
  return found.filter((token) => !KEYWORDS.has(token) && token.length > 0);
}

function swapOperator(text: string): { from: string; to: string; next: string } | null {
  const pairs: [string, string][] = [
    ["<=", "<"],
    [">=", ">"],
    ["===", "=="],
    ["!==", "!="],
    ["==", "==="],
    ["!=", "!=="],
  ];
  for (const [from, to] of pairs) {
    if (text.includes(from)) return { from, to, next: text.replace(from, to) };
  }
  return null;
}

function replaceLine(code: string, lineNumber: number, next: string): string {
  const lines = code.split(/\r?\n/);
  lines[lineNumber - 1] = next;
  return lines.join("\n");
}

function harness(code: string, call: string): string {
  return `${code}\n;try{const __explain_probe=(${call});console.log(JSON.stringify(__explain_probe===undefined?"undefined":__explain_probe));}catch(e){console.log("THROW");}\n`;
}

async function probe(runner: SandboxRunner, language: SubmissionLanguage, code: string, stdin = ""): Promise<RunResult> {
  try {
    return await runner.run(language, code, stdin);
  } catch {
    return blankRun;
  }
}

function readProbe(run: RunResult): string | null {
  if (run.outcome !== "ok") return null;
  const line = run.stdout.trim().split(/\r?\n/).at(-1) ?? "";
  if (!line || line === "THROW" || line === "\"undefined\"" || line === "undefined") return null;
  return line;
}

function squash(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function show(value: string): string {
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}
