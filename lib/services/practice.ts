import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  concepts,
  learningSessions,
  moduleConcepts,
  modules,
  questionConcepts,
  questions,
  tests,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";

export type ChallengeStatus = "solved" | "attempted" | "todo";
export type ChallengeDifficulty = "Easy" | "Medium" | "Hard";

export type EnrolledModuleItem = {
  id: string;
  name: string;
  totalChallenges: number;
  solvedChallenges: number;
};

export type PracticeChallengeSummary = {
  id: string;
  number: number;
  title: string;
  statement: string;
  difficulty: number;
  difficultyLabel: ChallengeDifficulty;
  conceptId: string;
  conceptName: string;
  moduleId: string;
  moduleName: string;
  languages: string[];
  status: ChallengeStatus;
  acceptanceRate: number;
};

export type PracticeCatalogData = {
  student: { id: string; name: string };
  activeModuleId: string;
  activeModuleName: string;
  modules: EnrolledModuleItem[];
  challenges: PracticeChallengeSummary[];
  stats: {
    total: number;
    solved: number;
    attempted: number;
    acceptanceRate: number;
    easy: { total: number; solved: number };
    medium: { total: number; solved: number };
    hard: { total: number; solved: number };
  };
};

export type PracticeExample = {
  id: string;
  input: string;
  output: string;
  explanation?: string;
};

export type PracticeEditorial = {
  intuition: string;
  approach: string;
  keyConcepts: string[];
  complexity: {
    time: string;
    space: string;
  };
};

export type PracticeQuestionDetail = {
  id: string;
  number: number;
  title: string;
  statement: string;
  difficulty: number;
  difficultyLabel: ChallengeDifficulty;
  conceptId: string;
  conceptName: string;
  moduleId: string;
  moduleName: string;
  languages: string[];
  starterCode: Record<string, string>;
  status: ChallengeStatus;
  examples: PracticeExample[];
  constraints: string[];
  hints: string[];
  editorial: PracticeEditorial;
  visibleTests: { id: string; input: string; expectedOutput: string }[];
  hiddenTestCount: number;
  pastSubmissions: {
    id: string;
    kind: "run" | "submit";
    passed: boolean;
    passRate: number;
    language: string;
    code: string;
    createdAt: string;
    durationMs?: number;
  }[];
  allChallenges: {
    id: string;
    number: number;
    title: string;
    difficultyLabel: ChallengeDifficulty;
    status: ChallengeStatus;
  }[];
};

function requireStudent(actor: Actor): string {
  if (actor.role !== "student") {
    throw AppError.forbidden("The Practice Lab is exclusively available for enrolled students.");
  }
  if (!actor.instituteId) {
    throw AppError.forbidden("Your account is not assigned to an institute.");
  }
  return actor.instituteId;
}

export function difficultyToLabel(difficulty: number): ChallengeDifficulty {
  if (difficulty <= 2) return "Easy";
  if (difficulty === 3) return "Medium";
  return "Hard";
}

// Curated metadata and editorial approaches for common challenge templates
const ENRICHED_METADATA: Record<
  string,
  {
    title: string;
    examples?: { input: string; output: string; explanation: string }[];
    constraints?: string[];
    hints?: string[];
    editorial?: PracticeEditorial;
  }
> = {
  "Read two integers and print their sum.": {
    title: "Sum of Two Integers from Stdin",
    examples: [
      {
        input: "2 3",
        output: "5",
        explanation: "Function sum(2, 3) returns 2 + 3 = 5.",
      },
      {
        input: "10 -4",
        output: "6",
        explanation: "Function sum(10, -4) returns 10 + (-4) = 6.",
      },
    ],
    constraints: [
      "-10^9 <= a, b <= 10^9",
      "Implement the body of function sum(a, b)",
      "Return the computed numeric sum directly",
    ],
    hints: [
      "Input parameters `a` and `b` are passed directly into the function.",
      "Perform the addition operation on the arguments and return the resulting value.",
    ],
    editorial: {
      intuition:
        "Standard LeetCode function style accepts parameters directly through the function signature.",
      approach:
        "1. Receive arguments `a` and `b`.\n2. Compute the addition of both operands and return the value.",
      keyConcepts: ["Variables", "Function Parameters", "Arithmetic Operators", "Return Values"],
      complexity: {
        time: "O(1) arithmetic operations",
        space: "O(1) memory auxiliary",
      },
    },
  },

  "Read one integer and print its double.": {
    title: "Double the Integer",
    examples: [
      {
        input: "4",
        output: "8",
        explanation: "4 * 2 = 8.",
      },
      {
        input: "-3",
        output: "-6",
        explanation: "-3 * 2 = -6.",
      },
    ],
    constraints: ["-10^9 <= n <= 10^9", "Standard I/O"],
    hints: ["Multiply the parsed integer by 2."],
    editorial: {
      intuition: "Basic scalar multiplication on parsed input.",
      approach: "Read single integer n and output n * 2.",
      keyConcepts: ["Variables", "Type Coercion", "Math"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "Read three integers and print the largest.": {
    title: "Maximum of Three Numbers",
    examples: [
      {
        input: "1 9 4",
        output: "9",
        explanation: "Among 1, 9, and 4, the maximum integer is 9.",
      },
    ],
    constraints: ["-10^9 <= a, b, c <= 10^9"],
    hints: ["Use Math.max(...nums) or conditional branch comparisons."],
    editorial: {
      intuition: "Finding the maximum element among three scalar inputs.",
      approach: "Parse three numbers and evaluate Math.max(a, b, c).",
      keyConcepts: ["Variables", "Conditionals", "Math.max"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "Write a function that returns the product of two integers read from stdin.": {
    title: "Product of Two Integers Function",
    examples: [
      {
        input: "3 5",
        output: "15",
        explanation: "Function product(3, 5) returns 15.",
      },
    ],
    constraints: ["-10^6 <= a, b <= 10^6"],
    hints: ["Perform multiplication between the two arguments and return the computed product."],
    editorial: {
      intuition: "Encapsulate arithmetic computation inside a pure function.",
      approach: "Compute the product of both operands and return the result.",
      keyConcepts: ["Functions", "Parameters", "Return Statements"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "Write a function that returns the factorial of n for n up to 10.": {
    title: "Factorial of N (Iterative or Recursive)",
    examples: [
      {
        input: "5",
        output: "120",
        explanation: "5! = 5 * 4 * 3 * 2 * 1 = 120.",
      },
      {
        input: "0",
        output: "1",
        explanation: "By mathematical definition, 0! = 1.",
      },
    ],
    constraints: ["0 <= n <= 10"],
    hints: [
      "Remember the base case: factorial(0) is 1.",
      "You can use an iterative loop from 1 to n multiplying into an accumulator.",
    ],
    editorial: {
      intuition: "Factorial represents product of integers from 1 up to n, with 0! = 1.",
      approach:
        "Initialize let result = 1. If n <= 1 return 1. Loop i from 2 to n: result *= i. Return result.",
      keyConcepts: ["Functions", "Loops", "Base Cases", "Recursion vs Iteration"],
      complexity: { time: "O(n)", space: "O(1)" },
    },
  },
  "Write a function that returns the minimum of three integers.": {
    title: "Minimum of Three Integers Function",
    examples: [
      {
        input: "8 3 5",
        output: "3",
        explanation: "The minimum among 8, 3, 5 is 3.",
      },
    ],
    constraints: ["-10^9 <= a, b, c <= 10^9"],
    hints: ["Compare the three values or use comparative logic to return the smallest."],
    editorial: {
      intuition: "Finding minimum using pure function abstractions.",
      approach: "Determine the smallest value among the three inputs and return it.",
      keyConcepts: ["Functions", "Comparative Logic"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "Implement Rectangle.area and print the area of the width and height read from stdin.": {
    title: "Rectangle Class & Area Method",
    examples: [
      {
        input: "3 4",
        output: "12",
        explanation: "Rectangle with width 3 and height 4 has area 3 * 4 = 12.",
      },
    ],
    constraints: ["width > 0, height > 0"],
    hints: ["Inside the area() method, access this.width and this.height."],
    editorial: {
      intuition: "Object-oriented encapsulation of geometric properties.",
      approach: "In Rectangle.area(), compute the rectangle area from its stored dimensions and return it.",
      keyConcepts: ["Classes", "Constructors", "Methods", "this keyword"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "Implement Counter.increment so it prints the value after one increment, starting from the integer on stdin.": {
    title: "Stateful Counter Increment",
    examples: [
      {
        input: "10",
        output: "11",
        explanation: "Starting at 10, one increment yields 11.",
      },
    ],
    constraints: ["-10^6 <= start <= 10^6"],
    hints: ["In increment(), increment this.value and return the updated value."],
    editorial: {
      intuition: "Encapsulating mutable state within class instances.",
      approach: "this.value += 1; return this.value;",
      keyConcepts: ["Classes", "Instance State", "State Mutation"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "Extend Shape with Square.area and print the area of the side length on stdin.": {
    title: "Shape Inheritance & Square Area",
    examples: [
      {
        input: "6",
        output: "36",
        explanation: "A square with side 6 has area 6 * 6 = 36.",
      },
    ],
    constraints: ["side >= 0"],
    hints: ["Square extends Shape. Inside Square.area(), return this.side * this.side."],
    editorial: {
      intuition: "Inheritance allows subclass specialization while retaining the base contract.",
      approach: "class Square extends Shape { area() { return this.side * this.side; } }",
      keyConcepts: ["Inheritance", "extends", "super()", "Polymorphism"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "Dog extends Animal. Print the sound for the name read from stdin as 'name: woof'.": {
    title: "Animal Polymorphic Sound Hierarchy",
    examples: [
      {
        input: "Rex",
        output: "Rex: woof",
        explanation: "For dog name 'Rex', speak() produces 'Rex: woof'.",
      },
    ],
    constraints: ["name is a non-empty string"],
    hints: ["Use template literal `${this.name}: woof` in the speak() method."],
    editorial: {
      intuition: "Subclasses inherit parent properties (this.name) and implement specialized behavior.",
      approach: "speak() { return `${this.name}: woof`; }",
      keyConcepts: ["Inheritance", "Superclass Properties", "String Formatting"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "A subclass DiscountedPrice overrides price. Print the discounted price for the base price on stdin, using 10 percent off.": {
    title: "Discounted Price Method Override",
    examples: [
      {
        input: "100",
        output: "90",
        explanation: "10% off of 100 is 100 - 10 = 90.",
      },
    ],
    constraints: ["amount >= 0"],
    hints: ["10% off means returning this.amount * 0.9."],
    editorial: {
      intuition: "Method overriding replaces parent class calculation with specialized discounted pricing.",
      approach: "value() { return this.amount * 0.9; }",
      keyConcepts: ["Method Overriding", "Polymorphic Dispatch", "Math Calculation"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "Greeter receives a formatter. Print the formatted hello for the name on stdin.": {
    title: "Dependency Injection Greeter",
    examples: [
      {
        input: "Ada",
        output: "Hello, Ada",
        explanation: "PlainFormatter.format('Ada') returns 'Hello, Ada'.",
      },
    ],
    constraints: ["name is a string"],
    hints: ["Implement PlainFormatter.format(name) returning `Hello, ${name}`."],
    editorial: {
      intuition: "Dependency Injection provides collaborators to classes rather than hard-coding them.",
      approach:
        "Inside PlainFormatter.format(name), return `Hello, ${name}`. Greeter calls this.formatter.format(name).",
      keyConcepts: ["Dependency Injection", "Inversion of Control", "Loose Coupling"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "A reporter depends on a clock. Print 'tick ' plus the number on stdin.": {
    title: "Clock Dependency Injected Reporter",
    examples: [
      {
        input: "3",
        output: "tick 3",
        explanation: "Reporter combines 'tick ' with clock.now().",
      },
    ],
    constraints: ["value is an integer"],
    hints: ["In Clock.now(), return this.value."],
    editorial: {
      intuition: "Injecting time providers allows deterministic testing and reproducible outcomes.",
      approach: "now() { return this.value; }",
      keyConcepts: ["Dependency Injection", "Collaborator Objects"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
  "Mailer depends on a transport. Print 'sent:' plus the body read from stdin.": {
    title: "Mailer Transport Injection",
    examples: [
      {
        input: "ready",
        output: "sent:ready",
        explanation: "Transport.send(body) prepends 'sent:' to the body.",
      },
    ],
    constraints: ["body is a string"],
    hints: ["In Transport.send(body), return 'sent:' + body."],
    editorial: {
      intuition: "Decoupling transport logic from high-level mail delivery abstractions.",
      approach: "send(body) { return 'sent:' + body; }",
      keyConcepts: ["Dependency Injection", "Service Layer Pattern", "Abstraction"],
      complexity: { time: "O(1)", space: "O(1)" },
    },
  },
};

function generateCleanTitle(statement: string, index: number): string {
  const custom = ENRICHED_METADATA[statement.trim()];
  if (custom?.title) return custom.title;

  // Fallback: generate title from statement
  const firstSentence = statement.split(".")[0]?.trim() ?? statement;
  if (firstSentence.length <= 42) return firstSentence;
  return `${firstSentence.slice(0, 39)}...`;
}

/**
 * Fetch all practice modules and challenges for a student.
 */
export async function getPracticeCatalog(
  actor: Actor,
  preferredModuleId?: string,
): Promise<PracticeCatalogData> {
  const instituteId = requireStudent(actor);

  // 1. Fetch all modules for the institute
  const moduleRows = await db
    .select({
      id: modules.id,
      name: modules.name,
      goalConceptId: modules.goalConceptId,
    })
    .from(modules)
    .where(eq(modules.instituteId, instituteId));

  // 2. Fetch module-to-concept mappings
  const moduleConceptRows = await db
    .select({
      moduleId: moduleConcepts.moduleId,
      conceptId: moduleConcepts.conceptId,
      conceptName: concepts.name,
    })
    .from(moduleConcepts)
    .innerJoin(concepts, eq(concepts.id, moduleConcepts.conceptId))
    .where(eq(moduleConcepts.instituteId, instituteId));

  const conceptToModule = new Map<string, { moduleId: string; moduleName: string; conceptName: string }>();
  for (const row of moduleConceptRows) {
    const mod = moduleRows.find((m) => m.id === row.moduleId);
    conceptToModule.set(row.conceptId, {
      moduleId: row.moduleId,
      moduleName: mod?.name ?? "Module",
      conceptName: row.conceptName,
    });
  }

  // Resolve active module
  const activeModule =
    (preferredModuleId && preferredModuleId !== "all"
      ? moduleRows.find((m) => m.id === preferredModuleId)
      : null) ??
    (preferredModuleId === "all" ? null : moduleRows[0] ?? null);

  const activeModuleId = activeModule ? activeModule.id : "all";
  const activeModuleName = activeModule ? activeModule.name : "All Enrolled Modules";

  // 3. Fetch all published questions in the institute
  const questionRows = await db
    .select({
      id: questions.id,
      statement: questions.statement,
      difficulty: questions.difficulty,
      languages: questions.languages,
      createdAt: questions.createdAt,
      conceptId: questionConcepts.conceptId,
    })
    .from(questions)
    .leftJoin(questionConcepts, eq(questions.id, questionConcepts.questionId))
    .where(and(eq(questions.instituteId, instituteId), eq(questions.status, "published")))
    .orderBy(questions.difficulty, questions.createdAt);

  // Deduplicate questions (in case a question has multiple concept tags)
  const uniqueQuestionsMap = new Map<
    string,
    {
      id: string;
      statement: string;
      difficulty: number;
      languages: string[];
      conceptId: string;
    }
  >();

  for (const q of questionRows) {
    if (!uniqueQuestionsMap.has(q.id)) {
      uniqueQuestionsMap.set(q.id, {
        id: q.id,
        statement: q.statement,
        difficulty: q.difficulty,
        languages: q.languages,
        conceptId: q.conceptId ?? "",
      });
    }
  }

  const allQuestions = Array.from(uniqueQuestionsMap.values());

  // 4. Fetch student's prior submit and run attempts
  const studentAttempts = await db
    .select({
      questionId: learningSessions.questionId,
      kind: attempts.kind,
      passRate: attempts.passRate,
    })
    .from(attempts)
    .innerJoin(learningSessions, eq(learningSessions.id, attempts.sessionId))
    .where(
      and(
        eq(learningSessions.studentId, actor.id),
        eq(learningSessions.instituteId, instituteId),
      ),
    );

  const questionStatusMap = new Map<string, ChallengeStatus>();
  for (const att of studentAttempts) {
    const current = questionStatusMap.get(att.questionId);
    if (att.kind === "submit" && (att.passRate ?? 0) >= 1.0) {
      questionStatusMap.set(att.questionId, "solved");
    } else if (current !== "solved") {
      questionStatusMap.set(att.questionId, "attempted");
    }
  }

  // 5. Construct challenge summary items
  const challenges: PracticeChallengeSummary[] = [];
  let challengeNumber = 1;

  for (const q of allQuestions) {
    const modInfo = conceptToModule.get(q.conceptId) ?? {
      moduleId: moduleRows[0]?.id ?? "default",
      moduleName: moduleRows[0]?.name ?? "General Module",
      conceptName: "Core Concept",
    };

    // Filter by active module if not "all"
    if (activeModuleId !== "all" && modInfo.moduleId !== activeModuleId) {
      continue;
    }

    const status = questionStatusMap.get(q.id) ?? "todo";
    const difficultyLabel = difficultyToLabel(q.difficulty);

    // Acceptance rate simulation based on difficulty for LeetCode authentic feel
    const baseRate = q.difficulty === 1 ? 88.4 : q.difficulty === 2 ? 74.2 : q.difficulty === 3 ? 56.8 : 39.5;
    const acceptanceRate = Number((baseRate + (q.id.charCodeAt(0) % 7) - 3).toFixed(1));

    challenges.push({
      id: q.id,
      number: challengeNumber++,
      title: generateCleanTitle(q.statement, challengeNumber),
      statement: q.statement,
      difficulty: q.difficulty,
      difficultyLabel,
      conceptId: q.conceptId,
      conceptName: modInfo.conceptName,
      moduleId: modInfo.moduleId,
      moduleName: modInfo.moduleName,
      languages: q.languages,
      status,
      acceptanceRate,
    });
  }

  // 6. Aggregate module-level challenge counts
  const modulesSummary: EnrolledModuleItem[] = moduleRows.map((mod) => {
    const modConceptIds = new Set(
      moduleConceptRows.filter((mc) => mc.moduleId === mod.id).map((mc) => mc.conceptId),
    );
    const modQuestions = allQuestions.filter((q) => modConceptIds.has(q.conceptId));
    const solvedCount = modQuestions.filter((q) => questionStatusMap.get(q.id) === "solved").length;
    return {
      id: mod.id,
      name: mod.name,
      totalChallenges: modQuestions.length,
      solvedChallenges: solvedCount,
    };
  });

  // Stats calculation
  const total = challenges.length;
  const solved = challenges.filter((c) => c.status === "solved").length;
  const attempted = challenges.filter((c) => c.status === "attempted").length;

  const easyTotal = challenges.filter((c) => c.difficultyLabel === "Easy").length;
  const easySolved = challenges.filter((c) => c.difficultyLabel === "Easy" && c.status === "solved").length;

  const mediumTotal = challenges.filter((c) => c.difficultyLabel === "Medium").length;
  const mediumSolved = challenges.filter((c) => c.difficultyLabel === "Medium" && c.status === "solved").length;

  const hardTotal = challenges.filter((c) => c.difficultyLabel === "Hard").length;
  const hardSolved = challenges.filter((c) => c.difficultyLabel === "Hard" && c.status === "solved").length;

  const avgAcceptance =
    challenges.length > 0
      ? Number((challenges.reduce((sum, c) => sum + c.acceptanceRate, 0) / challenges.length).toFixed(1))
      : 72.0;

  return {
    student: { id: actor.id, name: actor.name },
    activeModuleId,
    activeModuleName,
    modules: modulesSummary,
    challenges,
    stats: {
      total,
      solved,
      attempted,
      acceptanceRate: avgAcceptance,
      easy: { total: easyTotal, solved: easySolved },
      medium: { total: mediumTotal, solved: mediumSolved },
      hard: { total: hardTotal, solved: hardSolved },
    },
  };
}

/**
 * Fetch full question detail with LeetCode format for solving.
 */
export async function getPracticeQuestionDetail(
  actor: Actor,
  questionId: string,
): Promise<PracticeQuestionDetail> {
  const instituteId = requireStudent(actor);

  // 1. Fetch question row
  const [questionRow] = await db
    .select({
      id: questions.id,
      statement: questions.statement,
      difficulty: questions.difficulty,
      languages: questions.languages,
      starterCodeJson: questions.starterCodeJson,
      status: questions.status,
    })
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.instituteId, instituteId)))
    .limit(1);

  if (!questionRow || questionRow.status !== "published") {
    throw AppError.notFound("Challenge not found or not published.");
  }

  // 2. Fetch question concept & module
  const [conceptLink] = await db
    .select({
      conceptId: questionConcepts.conceptId,
      conceptName: concepts.name,
    })
    .from(questionConcepts)
    .innerJoin(concepts, eq(concepts.id, questionConcepts.conceptId))
    .where(eq(questionConcepts.questionId, questionId))
    .limit(1);

  const conceptId = conceptLink?.conceptId ?? "";
  const conceptName = conceptLink?.conceptName ?? "Core Programming";

  const [moduleLink] = conceptId
    ? await db
        .select({
          moduleId: moduleConcepts.moduleId,
          moduleName: modules.name,
        })
        .from(moduleConcepts)
        .innerJoin(modules, eq(modules.id, moduleConcepts.moduleId))
        .where(eq(moduleConcepts.conceptId, conceptId))
        .limit(1)
    : [undefined];

  const moduleId = moduleLink?.moduleId ?? "";
  const moduleName = moduleLink?.moduleName ?? "Module";

  // 3. Fetch visible and hidden test cases
  const testRows = await db
    .select({
      id: tests.id,
      visibility: tests.visibility,
      input: tests.input,
      expectedOutput: tests.expectedOutput,
    })
    .from(tests)
    .where(and(eq(tests.questionId, questionId), eq(tests.instituteId, instituteId)));

  const visibleTests = testRows
    .filter((t) => t.visibility === "visible")
    .map((t) => ({
      id: t.id,
      input: t.input,
      expectedOutput: t.expectedOutput,
    }));

  const hiddenTestCount = testRows.filter((t) => t.visibility === "hidden").length;

  // 4. Fetch student's past submissions and runs on this question
  const attemptRows = await db
    .select({
      id: attempts.id,
      kind: attempts.kind,
      passRate: attempts.passRate,
      language: attempts.language,
      code: attempts.code,
      createdAt: attempts.createdAt,
      resultJson: attempts.resultJson,
    })
    .from(attempts)
    .innerJoin(learningSessions, eq(learningSessions.id, attempts.sessionId))
    .where(
      and(
        eq(learningSessions.studentId, actor.id),
        eq(learningSessions.questionId, questionId),
        eq(learningSessions.instituteId, instituteId),
      ),
    )
    .orderBy(desc(attempts.createdAt))
    .limit(20);

  const pastSubmissions = attemptRows.map((att) => {
    const isPassed = (att.passRate ?? 0) >= 1.0;
    return {
      id: att.id,
      kind: att.kind as "run" | "submit",
      passed: isPassed,
      passRate: att.passRate ?? 0,
      language: att.language,
      code: att.code,
      createdAt: att.createdAt.toISOString(),
    };
  });

  const isSolved = pastSubmissions.some((s) => s.kind === "submit" && s.passed);
  const isAttempted = pastSubmissions.length > 0;
  const status: ChallengeStatus = isSolved ? "solved" : isAttempted ? "attempted" : "todo";

  // 5. Curated or derived LeetCode structures (Examples, Constraints, Hints, Editorial)
  const enriched = ENRICHED_METADATA[questionRow.statement.trim()];

  const examples: PracticeExample[] =
    enriched?.examples?.map((ex, i) => ({
      id: `ex-${i + 1}`,
      input: ex.input,
      output: ex.output,
      explanation: ex.explanation,
    })) ??
    visibleTests.map((t, i) => ({
      id: `ex-${i + 1}`,
      input: t.input.trim(),
      output: t.expectedOutput.trim(),
      explanation: `Expected output corresponding to sample input ${i + 1}.`,
    }));

  const constraints = enriched?.constraints ?? [
    "Standard I/O via stdin and stdout",
    "Time Limit: 2000 ms",
    "Memory Limit: 256 MB",
  ];

  const hints = enriched?.hints ?? [
    "Carefully review the sample test case inputs and expected outputs.",
    "Ensure all input tokens are converted to their appropriate types before computation.",
  ];

  const editorial: PracticeEditorial = enriched?.editorial ?? {
    intuition:
      "Solve the challenge by carefully identifying input parameters and returning or printing the required output.",
    approach:
      "1. Parse input tokens from stdin.\n2. Apply the required business logic.\n3. Output the result cleanly to stdout.",
    keyConcepts: [conceptName, "Standard I/O", "Algorithm Efficiency"],
    complexity: {
      time: "O(1) to O(n) dependent on input size",
      space: "O(1) auxiliary memory",
    },
  };

  // 6. Fetch sibling questions for the problem switcher / drawer
  const catalog = await getPracticeCatalog(actor, moduleId);
  const allChallenges = catalog.challenges.map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    difficultyLabel: c.difficultyLabel,
    status: c.status,
  }));

  const currentChallengeIndex = allChallenges.findIndex((c) => c.id === questionId);
  const number = currentChallengeIndex >= 0 ? currentChallengeIndex + 1 : 1;
  const title = generateCleanTitle(questionRow.statement, number);

  return {
    id: questionRow.id,
    number,
    title,
    statement: questionRow.statement,
    difficulty: questionRow.difficulty,
    difficultyLabel: difficultyToLabel(questionRow.difficulty),
    conceptId,
    conceptName,
    moduleId,
    moduleName,
    languages: questionRow.languages,
    starterCode: questionRow.starterCodeJson,
    status,
    examples,
    constraints,
    hints,
    editorial,
    visibleTests,
    hiddenTestCount,
    pastSubmissions,
    allChallenges,
  };
}
