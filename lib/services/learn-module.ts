import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  concepts,
  lessons,
  masteryState,
  moduleConcepts,
  modules,
  prerequisites,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { masteryBand, orderByPrerequisite, type MasteryBand } from "@/lib/engine/dashboard-bands";
import { previewScenes, type PreviewScene } from "@/lib/engine/lesson-preview";
import { parseLanguageDirective } from "@/lib/engine/lesson-languages";

export type ConceptQuizQuestion = {
  id: string;
  question: string;
  codeSnippet?: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  topicFocus: string;
};

export type ConceptQuiz = {
  conceptId: string;
  conceptName: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  passingScorePercent: number;
  questions: ConceptQuizQuestion[];
};

export type ConceptDocSection = {
  id: string;
  title: string;
  content: string;
  codeSnippet?: string;
  language?: string;
  callout?: {
    type: "tip" | "warning" | "note" | "invariant";
    text: string;
  };
};

export type ConceptDocData = {
  title: string;
  conceptName: string;
  overview: string;
  estimatedMinutes: number;
  learningObjectives: string[];
  mentalModelDescription: string;
  sections: ConceptDocSection[];
  keyInvariants: string[];
  commonPitfalls: { mistake: string; correction: string }[];
  bestPractices: string[];
};

export type ConceptSlideData = {
  id: string;
  slideNumber: number;
  role: "intro" | "concept" | "diagram" | "code" | "comparison" | "summary";
  title: string;
  subtitle?: string;
  summary: string;
  keyPoints: string[];
  codeSnippet?: string;
  language?: string;
  diagramData?: {
    nodes: { id: string; label: string; desc: string; type?: string }[];
    connections: { from: string; to: string; label?: string }[];
  };
  comparisonTable?: {
    headers: string[];
    rows: string[][];
  };
  takeaway: string;
};

export type CourseConceptItem = {
  id: string;
  name: string;
  description: string;
  step: number;
  isGoal: boolean;
  conceptMapStatus: "Mastered" | "In Progress" | "Ready to Learn" | "Prerequisites Blocked";
  allPrerequisitesMet: boolean;
  unlocks: { id: string; name: string }[];
  prerequisites: { id: string; name: string; met: boolean; mastery: number | null }[];
  mastery: number | null;
  masteryBand: MasteryBand;
  understandingStanding: "Mastered" | "Proficient" | "Developing" | "Foundational" | "Not Assessed";
  estimatedMinutes: number;
  lesson: { id: string; title: string; durationMinutes?: number } | null;
  docs: ConceptDocData;
  slides: ConceptSlideData[];
  quiz: ConceptQuiz;
};

export type LearnCourseData = {
  student: { id: string; name: string };
  module: {
    id: string;
    name: string;
    threshold: number;
    goalConceptId: string;
    goalConceptName: string;
  } | null;
  availableModules: {
    id: string;
    name: string;
    threshold: number;
    goalConceptName: string;
    totalConcepts: number;
    masteredConcepts: number;
  }[];
  overview: {
    totalConcepts: number;
    masteredConcepts: number;
    developingConcepts: number;
    unassessedConcepts: number;
    averageMastery: number;
    standingLabel: string;
  };
  concepts: CourseConceptItem[];
};

// Rich curated concept quiz bank evaluating conceptual understanding and mastery
const CONCEPT_QUIZZES: Record<string, Omit<ConceptQuiz, "conceptId" | "conceptName">> = {
  variables: {
    title: "Variables, Types & Scope Mastery",
    description: "Evaluates your understanding of variable scoping (const/let/var), value vs reference semantics, and type safety.",
    estimatedMinutes: 5,
    passingScorePercent: 70,
    questions: [
      {
        id: "var-q1",
        question: "What is the primary architectural advantage of using `const` over `let` when declaring identifiers in modern TypeScript/JavaScript?",
        options: [
          "const prevents any mutation of nested object properties and arrays",
          "const guarantees identifier immutability (reassignment prevention), reducing temporal bugs and state mutation surface",
          "const allocates variables on the CPU register rather than heap memory",
          "const allows hoisting to global scope across file modules",
        ],
        answerIndex: 1,
        explanation: "`const` prevents variable reassignment to a different memory address, enforcing intention and preventing unintended state mutations across function boundaries.",
        topicFocus: "Immutability & Reassignment",
      },
      {
        id: "var-q2",
        question: "Consider the following code snippet. What will be printed to stdout?",
        codeSnippet: `const config = { retries: 3 };
config.retries = 5;
console.log(config.retries);`,
        options: [
          "Throws a TypeError: Assignment to constant variable",
          "Prints 3 because the object is frozen by const",
          "Prints 5 because const binds the reference, not the internal properties of the object",
          "Prints undefined due to temporal dead zone",
        ],
        answerIndex: 2,
        explanation: "`const` prevents reassigning the reference itself (`config = ...`), but does not make the object deeply immutable. `Object.freeze()` would be required for shallow property freeze.",
        topicFocus: "Reference vs Value Semantics",
      },
      {
        id: "var-q3",
        question: "What occurs in the Temporal Dead Zone (TDZ) in ECMAScript/TypeScript?",
        options: [
          "Variables declared with `let` and `const` cannot be accessed before their declaration line is executed",
          "Memory is automatically cleared by the garbage collector during asynchronous wait",
          "Unused variables are stripped out during tree-shaking compilation",
          "Variables revert back to their default undefined state when their execution context terminates",
        ],
        answerIndex: 0,
        explanation: "The Temporal Dead Zone refers to the time period between entering scope and the lexical declaration being executed, accessing `let` or `const` during this time throws a ReferenceError.",
        topicFocus: "Scope & Temporal Dead Zone",
      },
    ],
  },
  functions: {
    title: "Functions, Closures & Execution Context",
    description: "Assesses understanding of lexical scope, closures, pure functions, and parameter passing.",
    estimatedMinutes: 6,
    passingScorePercent: 70,
    questions: [
      {
        id: "fn-q1",
        question: "What defines a closure in JavaScript/TypeScript?",
        options: [
          "A function that returns another function asynchronously",
          "The combination of a function bundled together with references to its surrounding lexical environment",
          "A recursive function terminating on an empty base case",
          "An immediately invoked function expression (IIFE) that hides local variables from global scope",
        ],
        answerIndex: 1,
        explanation: "A closure gives an inner function access to its outer enclosing scope's variables even after the outer function has returned and finished executing.",
        topicFocus: "Closures & Lexical Scope",
      },
      {
        id: "fn-q2",
        question: "Which of the following describes a pure function?",
        options: [
          "A function that performs no asynchronous I/O and executes in under 1ms",
          "A function that always returns the same output given the same arguments, and produces no observable side effects",
          "A function that does not declare any internal local variables",
          "A function that accepts only primitive types and returns a Promise",
        ],
        answerIndex: 1,
        explanation: "Purity requires referential transparency: deterministic return values for identical inputs and zero side effects (no mutating global state, network requests, or disk I/O).",
        topicFocus: "Pure Functions & Determinism",
      },
      {
        id: "fn-q3",
        question: "What will the following code output?",
        codeSnippet: `function createCounter() {
  let count = 0;
  return () => ++count;
}
const c1 = createCounter();
const c2 = createCounter();
c1();
console.log(c1(), c2());`,
        options: [
          "2 1",
          "2 2",
          "1 1",
          "NaN NaN",
        ],
        answerIndex: 0,
        explanation: "Each invocation of `createCounter()` creates a distinct lexical environment. `c1` increments its own `count` twice (yielding 2), while `c2` executes once on its independent `count` (yielding 1).",
        topicFocus: "Independent Closure State",
      },
    ],
  },
  classes: {
    title: "Classes, Objects & Encapsulation",
    description: "Evaluates your grasp of Object-Oriented principles: encapsulation, state management, private fields, and constructors.",
    estimatedMinutes: 6,
    passingScorePercent: 70,
    questions: [
      {
        id: "cls-q1",
        question: "In modern TypeScript/JavaScript, what is the key difference between `#privateField` and `private privateField`?",
        options: [
          "`#privateField` is enforced at runtime by the JS engine, whereas `private` is a TypeScript compile-time type check only",
          "`#privateField` can only store strings, whereas `private` can store any type",
          "`private` creates a Symbol key, while `#privateField` creates a WeakMap",
          "`#privateField` is inherited by subclasses, whereas `private` is completely isolated",
        ],
        answerIndex: 0,
        explanation: "ECMAScript private fields (using `#`) have true runtime private encapsulation that cannot be accessed via bracket notation or inspection, whereas TypeScript's `private` keyword is purely checked at compile-time.",
        topicFocus: "Encapsulation & Private Fields",
      },
      {
        id: "cls-q2",
        question: "What is the primary role of the `constructor` method in a class definition?",
        options: [
          "To register methods in the global prototype registry",
          "To initialize instance state and invariants when a new instance is instantiated with `new`",
          "To serialize the class instance into JSON format",
          "To invoke static initializer blocks before module execution",
        ],
        answerIndex: 1,
        explanation: "The constructor is the special method invoked when allocating a new instance with the `new` operator, tasked with establishing initial state and validating invariants.",
        topicFocus: "Constructors & Object Lifecycle",
      },
      {
        id: "cls-q3",
        question: "What distinguishes `static` methods from instance methods on a class?",
        options: [
          "Static methods run in parallel web worker threads",
          "Static methods belong to the class constructor itself rather than to individual instances of the class",
          "Static methods cannot accept arguments or return values",
          "Static methods are automatically cached in local storage",
        ],
        answerIndex: 1,
        explanation: "Static methods are called on the constructor function itself (e.g. `Math.max()` or `User.create()`) without instantiating an object instance, and cannot access `this` instance members.",
        topicFocus: "Static vs Instance Members",
      },
    ],
  },
  inheritance: {
    title: "Inheritance, Polymorphism & Subtyping",
    description: "Tests mastery of subclassing, method overriding, `super` invocation, and the Liskov Substitution Principle.",
    estimatedMinutes: 7,
    passingScorePercent: 70,
    questions: [
      {
        id: "inh-q1",
        question: "When a derived class defines its own `constructor`, why must `super()` be called before referencing `this`?",
        options: [
          "Because the parent class constructor is responsible for allocating and binding the `this` instance object",
          "To import static prototype utilities from the base module",
          "To reset memory counters in V8 garbage collector",
          "Because TypeScript compiler will generate invalid bytecode without it",
        ],
        answerIndex: 0,
        explanation: "In ES6 derived classes, `this` is uninitialized until `super()` executes. The superclass constructor initializes the base object and attaches prototype linkages.",
        topicFocus: "Super Constructor Invocation",
      },
      {
        id: "inh-q2",
        question: "Which Object-Oriented principle states that objects of a superclass should be replaceable with objects of a subclass without breaking application correctness?",
        options: [
          "Single Responsibility Principle (SRP)",
          "Liskov Substitution Principle (LSP)",
          "Interface Segregation Principle (ISP)",
          "Open/Closed Principle (OCP)",
        ],
        answerIndex: 1,
        explanation: "The Liskov Substitution Principle (the L in SOLID) guarantees that a derived subtype honors the behavioral contract and invariants of its base type.",
        topicFocus: "Liskov Substitution Principle",
      },
      {
        id: "inh-q3",
        question: "What occurs during method overriding in a subclass?",
        options: [
          "The parent method is completely deleted from memory",
          "The subclass provides a specialized implementation of a method that is already defined in its parent class",
          "Both methods are merged together into a unified callback",
          "The subclass method can only accept fewer parameters than the parent method",
        ],
        answerIndex: 1,
        explanation: "Method overriding allows a derived class to provide a specific implementation of a method inherited from a base class, participating in dynamic runtime polymorphism.",
        topicFocus: "Method Overriding & Polymorphism",
      },
    ],
  },
  di: {
    title: "Dependency Injection & Modular Architecture",
    description: "Assesses knowledge of Inversion of Control (IoC), loose coupling, testability, and dependency lifecycles.",
    estimatedMinutes: 7,
    passingScorePercent: 70,
    questions: [
      {
        id: "di-q1",
        question: "What is the primary architectural goal of Dependency Injection (DI)?",
        options: [
          "To speed up execution of SQL database queries",
          "To decouple the creation of a component's dependencies from its execution behavior, improving testability and modularity",
          "To eliminate the need for classes and TypeScript types",
          "To replace all HTTP requests with direct IPC sockets",
        ],
        answerIndex: 1,
        explanation: "By injecting collaborators (e.g. repositories, loggers, mailers) rather than hardcoding `new Service()` inside a class, components become loosely coupled, configurable, and trivially mockable in tests.",
        topicFocus: "Decoupling & Testability",
      },
      {
        id: "di-q2",
        question: "Which of the following is an example of Constructor Injection?",
        codeSnippet: `// Option A
class OrderService {
  private db = new Database();
}

// Option B
class OrderService {
  constructor(private readonly db: DatabaseClient) {}
}`,
        options: [
          "Option A",
          "Option B",
          "Both Option A and B",
          "Neither",
        ],
        answerIndex: 1,
        explanation: "Option B passes `db` as a parameter to the constructor. The caller or IoC container provides the dependency, allowing test suites to inject mock or in-memory database instances.",
        topicFocus: "Constructor Injection Pattern",
      },
      {
        id: "di-q3",
        question: "How does Dependency Inversion (the D in SOLID) relate to Dependency Injection?",
        options: [
          "Dependency Inversion is the high-level principle (high-level modules depend on abstractions, not concrete details); Dependency Injection is a design pattern used to realize it",
          "They are identical terms with no conceptual difference",
          "Dependency Inversion is deprecated in favor of microservices",
          "Dependency Inversion requires an external npm framework, whereas DI is purely manual",
        ],
        answerIndex: 0,
        explanation: "Dependency Inversion Principle (DIP) states that high-level modules should depend on abstractions (interfaces/contracts). Dependency Injection is the practical mechanism by which those dependencies are supplied.",
        topicFocus: "Dependency Inversion Principle",
      },
    ],
  },
};

// Fallback generator for custom or dynamically created concepts
function defaultQuizForConcept(conceptId: string, conceptName: string): ConceptQuiz {
  return {
    conceptId,
    conceptName,
    title: `${conceptName} Diagnostic Quiz`,
    description: `Evaluate your core understanding, syntax patterns, and best practices for ${conceptName}.`,
    estimatedMinutes: 5,
    passingScorePercent: 70,
    questions: [
      {
        id: `${conceptId}-q1`,
        question: `What is the primary role and core responsibility of ${conceptName} in modern software engineering?`,
        options: [
          `Providing structured, maintainable, and predictable abstractions for ${conceptName}`,
          `Bypassing CPU pipeline scheduling for hardware acceleration`,
          `Enforcing strict single-threaded synchronous blocking execution`,
          `Replacing network sockets with localized thread pools`,
        ],
        answerIndex: 0,
        explanation: `${conceptName} provides standard, robust software abstractions to improve correctness, modularity, and maintainability.`,
        topicFocus: "Foundational Concepts",
      },
      {
        id: `${conceptId}-q2`,
        question: `When designing software utilizing ${conceptName}, which architectural practice is strongly recommended?`,
        options: [
          "Tight coupling with concrete implementation details",
          "Favoring clear separation of concerns, testability, and explicit contracts",
          "Disabling type checking and runtime validation checks",
          "Storing all mutable state in global variables",
        ],
        answerIndex: 1,
        explanation: "Adhering to clear separation of concerns and explicit contracts ensures high cohesion, reliability, and ease of automated testing.",
        topicFocus: "Design Best Practices",
      },
      {
        id: `${conceptId}-q3`,
        question: `How does mastering ${conceptName} directly impact production system resilience?`,
        options: [
          "It eliminates the need for software code reviews and unit tests",
          "It allows developers to diagnose edge cases, avoid regression anti-patterns, and build scalable systems",
          "It converts all runtime exceptions into silent warnings",
          "It guarantees 100% CPU utilization at all times",
        ],
        answerIndex: 1,
        explanation: "A deep conceptual mastery allows engineers to write defensively, handle edge conditions gracefully, and construct scalable software.",
        topicFocus: "Production Engineering & Resilience",
      },
    ],
  };
}

/**
 * Rich Docs & Slides Generator
 * Generates comprehensive documentation and structured presentation slides for LearnWin.
 */
function buildDocsAndSlides(
  conceptId: string,
  conceptName: string,
  rawDescription: string,
  publishedLesson?: {
    title: string;
    objectives: string;
    sourceMaterial: string;
    durationMinutes: number;
    scenes: PreviewScene[];
  } | null,
): { docs: ConceptDocData; slides: ConceptSlideData[]; estimatedMinutes: number } {
  const lower = conceptName.toLowerCase();

  // If a published lesson with scenes already exists, adapt authored scenes into slides and docs
  if (publishedLesson && publishedLesson.scenes && publishedLesson.scenes.length > 0) {
    const authoredSlides: ConceptSlideData[] = publishedLesson.scenes.map((scene, idx) => {
      let codeSnippet: string | undefined;
      let language: string | undefined;
      const keyPoints: string[] = [];

      for (const block of scene.blocks) {
        if (block.kind === "code") {
          codeSnippet = block.code;
          language = block.language;
        } else if (block.kind === "steps") {
          keyPoints.push(...block.steps);
        } else if (block.kind === "prose") {
          keyPoints.push(block.text);
        }
      }
      if (scene.paragraphs && scene.paragraphs.length > 0) {
        keyPoints.push(...scene.paragraphs);
      }

      const roleMapping: Record<string, ConceptSlideData["role"]> = {
        introduction: "intro",
        intro: "intro",
        diagram: "diagram",
        code: "code",
        code_walkthrough: "code",
        comparison: "comparison",
        step_by_step: "concept",
        steps: "concept",
        summary: "summary",
      };

      return {
        id: scene.id || `${conceptId}-slide-${idx + 1}`,
        slideNumber: idx + 1,
        role: roleMapping[scene.role] ?? "concept",
        title: scene.title,
        subtitle: `Curriculum Module · ${conceptName}`,
        summary: scene.paragraphs[0] ?? `Core instructional scene covering ${scene.title}.`,
        keyPoints: keyPoints.slice(0, 4),
        codeSnippet,
        language: language ?? "typescript",
        takeaway: `Master the principles of ${scene.title} before attempting diagnostic quizzes.`,
      };
    });

    const docs: ConceptDocData = {
      title: `${publishedLesson.title || conceptName} Documentation`,
      conceptName,
      overview:
        publishedLesson.objectives ||
        rawDescription ||
        `Comprehensive courseware documentation covering ${conceptName}.`,
      estimatedMinutes: publishedLesson.durationMinutes || 10,
      learningObjectives: publishedLesson.objectives
        ? publishedLesson.objectives.split("\n").filter((s) => s.trim().length > 0)
        : [
            `Understand the foundational architectural mechanics of ${conceptName}`,
            `Learn how to structure maintainable code and identify invariants`,
            `Diagnose common edge-case bugs and verify with tests`,
          ],
      mentalModelDescription:
        publishedLesson.sourceMaterial ||
        `Core mental models and execution semantics designed for ${conceptName}.`,
      sections: [
        {
          id: "sec-overview",
          title: "Conceptual Foundations & Mechanics",
          content:
            rawDescription ||
            `Foundational overview of ${conceptName}. Understand how runtime state and invariants behave.`,
          callout: {
            type: "invariant",
            text: `Always adhere to explicit contracts and deterministic state boundaries when building around ${conceptName}.`,
          },
        },
        {
          id: "sec-implementation",
          title: "Practical Code Walkthrough & Syntax",
          content: `Review the recommended implementation patterns and code layout for ${conceptName}.`,
          codeSnippet: authoredSlides.find((s) => s.codeSnippet)?.codeSnippet ?? `// Core pattern for ${conceptName}\nexport class ProductionHandler {\n  // Implementation\n}`,
          language: "typescript",
        },
        {
          id: "sec-best-practices",
          title: "Architectural Best Practices",
          content: `Key engineering practices to maintain high cohesion, testability, and resilience.`,
        },
      ],
      keyInvariants: [
        `Deterministic execution without hidden side-effects across module boundaries`,
        `Explicit interfaces over brittle concrete coupling`,
        `Graceful edge-case handling with validated inputs`,
      ],
      commonPitfalls: [
        {
          mistake: `Assuming mutable state is isolated without explicit boundaries.`,
          correction: `Enforce immutability and pass dependencies explicitly.`,
        },
        {
          mistake: `Skipping diagnostic checks and unit test invariants.`,
          correction: `Verify contracts with automated tests and diagnostic quizzes.`,
        },
      ],
      bestPractices: [
        `Write self-documenting code with clear type annotations`,
        `Decouple domain logic from I/O and external side effects`,
        `Test boundary cases thoroughly before production deployment`,
      ],
    };

    return { docs, slides: authoredSlides, estimatedMinutes: publishedLesson.durationMinutes || 10 };
  }

  // Curated Knowledge Base for foundational concepts
  if (lower.includes("variable") || lower.includes("type")) {
    const docs: ConceptDocData = {
      title: "Variables, Types & Memory Scoping Documentation",
      conceptName,
      overview:
        "Variables are named references to memory locations holding data. In modern TypeScript/JavaScript, variables are defined via const, let, and var, each exhibiting distinct lifecycle, lexical scoping, and allocation semantics.",
      estimatedMinutes: 8,
      learningObjectives: [
        "Master the differences between const, let, and var in lexical scope",
        "Understand value vs reference semantics in memory allocation (Stack vs Heap)",
        "Understand the Temporal Dead Zone (TDZ) and avoid runtime reference errors",
        "Apply immutability patterns to prevent temporal state coupling",
      ],
      mentalModelDescription:
        "Think of variables as pointers: primitive types (numbers, booleans, strings) are allocated by value on the stack, while objects and arrays are allocated on the heap with pointers stored in variable slots.",
      sections: [
        {
          id: "sec-immutability",
          title: "Immutability & The Temporal Dead Zone (TDZ)",
          content:
            "Using `const` binds an identifier immutably to a memory reference. However, note that `const` does NOT make objects deeply immutable—nested properties can still be modified unless frozen with `Object.freeze()`.",
          codeSnippet: `// Proper immutability pattern
export type ServerConfig = {
  readonly host: string;
  readonly port: number;
  readonly timeoutMs: number;
};

export function createConfig(port: number): ServerConfig {
  return Object.freeze({
    host: "127.0.0.1",
    port,
    timeoutMs: 5000,
  });
}`,
          language: "typescript",
          callout: {
            type: "invariant",
            text: "`const` guarantees reassignment safety. Prefer `const` by default, only using `let` when identifier reassignment is strictly required in a loop or accumulator.",
          },
        },
        {
          id: "sec-reference-semantics",
          title: "Reference vs Value Semantics",
          content:
            "Primitives are passed by copy; objects, arrays, and functions are passed by reference. Mutating a passed object mutates it for all other callers holding that reference.",
          codeSnippet: `const original = { score: 10 };
const referenceCopy = original;
referenceCopy.score = 25; // MUTATES original.score!

// Clean immutable copy pattern:
const cleanCopy = { ...original, score: 30 };`,
          language: "typescript",
        },
      ],
      keyInvariants: [
        "const identifiers cannot be reassigned; doing so throws a compile-time and runtime TypeError",
        "Variables in the TDZ cannot be evaluated prior to lexical execution",
        "Stack primitives are copied by value; Heap objects are shared by reference pointer",
      ],
      commonPitfalls: [
        {
          mistake: "Assuming `const obj = {}` prevents modifying properties like `obj.foo = 'bar'`.",
          correction: "Use TypeScript `readonly` modifiers and runtime `Object.freeze()` for deep immutability.",
        },
        {
          mistake: "Using `var` in modern codebases, leading to hoisting leaks and scope collision.",
          correction: "Use block-scoped `const` or `let` strictly.",
        },
      ],
      bestPractices: [
        "Default to `const` for 95% of variable declarations",
        "Use explicit TypeScript types for public API surfaces",
        "Avoid shared mutable state across module boundaries",
      ],
    };

    const slides: ConceptSlideData[] = [
      {
        id: `${conceptId}-s1`,
        slideNumber: 1,
        role: "intro",
        title: "Variables, Identifiers & Types",
        subtitle: "Foundational Memory Layout & Scope Boundaries",
        summary:
          "Variables store references to values in program memory. Choosing the right declaration keyword defines scope, mutability, and safety.",
        keyPoints: [
          "const: Block-scoped, immutable identifier binding (cannot be reassigned)",
          "let: Block-scoped, mutable identifier binding (for loops & accumulators)",
          "var: Legacy function-scoped, hoisted (avoid in modern engineering)",
        ],
        takeaway: "Always use const by default to minimize state mutation bugs.",
      },
      {
        id: `${conceptId}-s2`,
        slideNumber: 2,
        role: "diagram",
        title: "Stack vs Heap Memory Model",
        subtitle: "How V8 and modern runtimes allocate primitive and reference values",
        summary:
          "Primitive values live on the call stack. Complex objects live on the heap, with variables holding pointers to heap addresses.",
        keyPoints: [
          "Primitives (Number, Boolean, String): Direct value copy on stack",
          "Objects & Arrays: Stored on Heap, multiple variables can point to the same memory",
          "const protects the pointer address, not the internal heap contents",
        ],
        diagramData: {
          nodes: [
            { id: "stack", label: "Call Stack", desc: "Fast LIFO memory for primitive values & pointers", type: "memory" },
            { id: "heap", label: "Heap Memory", desc: "Dynamic memory allocation for objects & arrays", type: "memory" },
            { id: "var_a", label: "const a = 42", desc: "Direct stack value", type: "primitive" },
            { id: "var_b", label: "const b = { id: 1 }", desc: "Pointer 0x7FA3 -> Heap Object", type: "reference" },
          ],
          connections: [
            { from: "stack", to: "var_a", label: "allocates primitive" },
            { from: "stack", to: "var_b", label: "stores pointer" },
            { from: "var_b", to: "heap", label: "references 0x7FA3" },
          ],
        },
        takeaway: "Modifying heap object properties affects all references pointing to that object.",
      },
      {
        id: `${conceptId}-s3`,
        slideNumber: 3,
        role: "code",
        title: "Clean Code & Immutability Patterns",
        subtitle: "Defensive programming with TypeScript readonly interfaces",
        summary:
          "Enforce immutability at compile time and runtime to prevent subtle action-at-a-distance bugs.",
        keyPoints: [
          "Use readonly modifiers in interfaces to prevent field assignment",
          "Use object spread ({ ...obj }) for non-destructive updates",
          "Freeze critical configurations to prevent runtime tamper",
        ],
        codeSnippet: `interface UserState {
  readonly id: string;
  readonly role: "student" | "trainer";
  readonly score: number;
}

function updateScore(user: UserState, delta: number): UserState {
  // Returns a NEW state object without mutating original
  return {
    ...user,
    score: user.score + delta,
  };
}`,
        language: "typescript",
        takeaway: "Pure state transitions eliminate synchronization and concurrent modification bugs.",
      },
      {
        id: `${conceptId}-s4`,
        slideNumber: 4,
        role: "comparison",
        title: "Declaration Semantics Matrix",
        subtitle: "Comparing Scope, Hoisting, and Reassignment",
        summary: "Understand the strict behavioral differences across the three ECMAScript keywords.",
        keyPoints: [
          "const is the gold standard for robust engineering",
          "let is reserved for strictly local counter loops",
          "var is legacy and should be refactored out",
        ],
        comparisonTable: {
          headers: ["Feature", "const", "let", "var"],
          rows: [
            ["Scope", "Block Scope {}", "Block Scope {}", "Function Scope"],
            ["Reassignable", "No (Compile Error)", "Yes", "Yes"],
            ["Temporal Dead Zone", "Yes (Strict)", "Yes (Strict)", "No (Hoisted undefined)"],
            ["Global Window Pollute", "No", "No", "Yes"],
          ],
        },
        takeaway: "Mastering scope guarantees clean memory management and prevents variable shadowing.",
      },
      {
        id: `${conceptId}-s5`,
        slideNumber: 5,
        role: "summary",
        title: "Concept Mastery Summary & Checklist",
        subtitle: "Key takeaways before attempting the diagnostic quiz",
        summary: "You are now equipped with the memory model, scope rules, and immutability practices.",
        keyPoints: [
          "✓ Immutability prevents unintended state mutation across asynchronous boundaries",
          "✓ Understand that const protects the variable reference pointer, not object keys",
          "✓ Temporal Dead Zone errors prevent accessing identifiers before declaration",
          "✓ Always aim for 70%+ minimum marks on the concept quiz",
        ],
        takeaway: "Proceed to Tab 2 to test your mastery with the diagnostic quiz!",
      },
    ];

    return { docs, slides, estimatedMinutes: 8 };
  }

  if (lower.includes("function") || lower.includes("closure")) {
    const docs: ConceptDocData = {
      title: "Functions, Closures & Execution Contexts Documentation",
      conceptName,
      overview:
        "Functions in modern TypeScript are first-class citizens: they can be passed as arguments, returned from other functions, and carry lexical closure environments with them.",
      estimatedMinutes: 9,
      learningObjectives: [
        "Understand execution contexts, call stacks, and lexical scope chains",
        "Master closures and their role in private state encapsulation",
        "Write pure functions with zero side-effects and referential transparency",
        "Understand arrow function lexical this binding vs traditional function prototypes",
      ],
      mentalModelDescription:
        "A closure is a function bundled together with references to its surrounding lexical state. Whenever an inner function is created, it retains a live reference to its outer scope even after the outer function finishes executing.",
      sections: [
        {
          id: "sec-closures",
          title: "Lexical Scope & Closures",
          content:
            "Closures allow functions to maintain private encapsulated state without resorting to global variables or classes.",
          codeSnippet: `export function makeRateLimiter(maxCalls: number) {
  let count = 0;
  return function allowRequest(): boolean {
    if (count >= maxCalls) return false;
    count++;
    return true;
  };
}

const limiter = makeRateLimiter(3);
console.log(limiter()); // true (count: 1)
console.log(limiter()); // true (count: 2)
console.log(limiter()); // true (count: 3)
console.log(limiter()); // false (blocked!)`,
          language: "typescript",
          callout: {
            type: "invariant",
            text: "Each invocation of an outer factory function creates a brand new independent closure environment with its own isolated variable instances.",
          },
        },
        {
          id: "sec-pure-functions",
          title: "Referential Transparency & Pure Functions",
          content:
            "A pure function always returns the exact same output for identical inputs and produces zero observable side-effects (no disk writes, network calls, or global mutations).",
          codeSnippet: `// Pure calculation
export function calculateMastery(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1.0, Math.max(0, correct / total));
}`,
          language: "typescript",
        },
      ],
      keyInvariants: [
        "A closure preserves outer lexical variables even after the outer frame is popped off the call stack",
        "Arrow functions have no own `this`, `arguments`, or `prototype`; they capture `this` from enclosing scope",
        "Pure functions are referentially transparent and trivially unit-testable",
      ],
      commonPitfalls: [
        {
          mistake: "Creating closures inside loops with `var`, causing all callbacks to share the final index value.",
          correction: "Use block-scoped `let` or `for...of` loops, creating a fresh binding per iteration.",
        },
        {
          mistake: "Mutating outer state inside a callback without thread/async coordination.",
          correction: "Return new copies or use atomic state reducers.",
        },
      ],
      bestPractices: [
        "Favor small, single-responsibility functions",
        "Keep functions pure whenever possible; isolate side-effects at system boundaries",
        "Use arrow functions for callbacks to preserve lexical `this`",
      ],
    };

    const slides: ConceptSlideData[] = [
      {
        id: `${conceptId}-s1`,
        slideNumber: 1,
        role: "intro",
        title: "Functions as First-Class Citizens",
        subtitle: "Execution Contexts, Higher-Order Functions & Closures",
        summary:
          "Functions can be passed as values, assigned to variables, and returned from other functions.",
        keyPoints: [
          "First-class values: Functions can be stored, passed, and returned",
          "Lexical Scope: Outer variables are accessible inside nested functions",
          "Execution Context: The call stack manages activation frames and variable environments",
        ],
        takeaway: "Functions are the fundamental unit of modularity in TypeScript.",
      },
      {
        id: `${conceptId}-s2`,
        slideNumber: 2,
        role: "diagram",
        title: "Lexical Scope Chain & Closure Mechanism",
        subtitle: "How nested functions access enclosing variables across time",
        summary:
          "When an inner function survives past the execution of its parent, it holds a reference to its lexical environment scope.",
        keyPoints: [
          "Global Scope -> Outer Function Scope -> Inner Function Scope",
          "Variables are looked up outward along the scope chain",
          "Garbage collector retains enclosed variables referenced by live closures",
        ],
        diagramData: {
          nodes: [
            { id: "outer", label: "Outer Scope", desc: "let count = 0 (preserved)", type: "scope" },
            { id: "inner", label: "Inner Closure", desc: "() => ++count", type: "function" },
            { id: "heap_ref", label: "Retained Environment", desc: "Live closure reference pointer", type: "memory" },
          ],
          connections: [
            { from: "outer", to: "inner", label: "encloses" },
            { from: "inner", to: "heap_ref", label: "keeps alive" },
          ],
        },
        takeaway: "Closures give you private state encapsulation without memory leaks.",
      },
      {
        id: `${conceptId}-s3`,
        slideNumber: 3,
        role: "code",
        title: "Pure Functions & Deterministic Pipelines",
        subtitle: "Building testable domain logic with pure transformations",
        summary: "Pure functions guarantee predictable behavior and eliminate state corruption.",
        keyPoints: [
          "Deterministic: Same inputs always yield identical outputs",
          "No side effects: Does not alter external memory, DOM, or databases",
          "Easy to memoize and parallelize",
        ],
        codeSnippet: `// Pure composition
const formatGreeting = (name: string): string => \`Welcome, \${name.trim()}!\`;
const isValidName = (name: string): boolean => name.trim().length > 0;

export function greetStudent(name: string): string {
  if (!isValidName(name)) return "Welcome, Guest!";
  return formatGreeting(name);
}`,
        language: "typescript",
        takeaway: "A codebase built from pure functions is virtually regression-free.",
      },
      {
        id: `${conceptId}-s4`,
        slideNumber: 4,
        role: "comparison",
        title: "Arrow Functions vs Traditional Functions",
        subtitle: "Behavioral trade-offs and when to use each syntax",
        summary: "Understand the subtle differences in `this` binding and constructor capabilities.",
        keyPoints: [
          "Arrow functions: Lexical `this`, cannot be `new`ed, concise syntax",
          "Function declarations: Dynamic `this`, hoisted, prototype methods",
        ],
        comparisonTable: {
          headers: ["Characteristic", "Arrow Function () => {}", "function keyword"],
          rows: [
            ["this binding", "Lexical (from parent scope)", "Dynamic (from call-site)"],
            ["Constructor capability", "No (TypeError with new)", "Yes (creates instances)"],
            ["arguments object", "No (use rest ...args)", "Yes (built-in)"],
            ["Hoisting", "No (TDZ applies)", "Yes (hoisted fully)"],
          ],
        },
        takeaway: "Use arrow functions for callbacks and class arrow methods; use function for top-level utilities.",
      },
      {
        id: `${conceptId}-s5`,
        slideNumber: 5,
        role: "summary",
        title: "Mastery Review Checklist",
        subtitle: "Ready for the Functions & Closures Quiz",
        summary: "Verify your understanding before unlocking the diagnostic evaluation.",
        keyPoints: [
          "✓ Understand that each factory call produces an independent closure state",
          "✓ Recognize pure functions by deterministic return and zero side effects",
          "✓ Avoid memory leaks by clearing unused closure listeners",
          "✓ Maintain minimum 70% passing marks on Tab 2",
        ],
        takeaway: "Unlock the quiz in Tab 2 to validate your conceptual mastery!",
      },
    ];

    return { docs, slides, estimatedMinutes: 9 };
  }

  // Fallback high-fidelity generator for any other concept
  const docs: ConceptDocData = {
    title: `${conceptName} Engineering Documentation`,
    conceptName,
    overview:
      rawDescription ||
      `Comprehensive architectural breakdown of ${conceptName}. Learn how this concept establishes foundational principles and interfaces in modern software engineering.`,
    estimatedMinutes: 8,
    learningObjectives: [
      `Understand the core responsibilities and design abstractions of ${conceptName}`,
      `Identify architectural patterns, invariants, and syntax conventions for ${conceptName}`,
      `Diagnose production anti-patterns and edge-case errors before they affect users`,
      `Achieve 70%+ minimum marks on the concept mastery diagnostic quiz`,
    ],
    mentalModelDescription: `Think of ${conceptName} as an explicit architectural contract. It isolates domain concerns, minimizes coupling, and guarantees predictable runtime execution.`,
    sections: [
      {
        id: "sec-overview",
        title: `1. Foundational Architecture & Invariants of ${conceptName}`,
        content: `Mastering ${conceptName} requires understanding its lifecycle, state invariants, and runtime implications. Adhering to explicit interfaces ensures that software remains robust and modular as requirements evolve.`,
        callout: {
          type: "invariant",
          text: `Always treat ${conceptName} as a clear boundary. Avoid leaky abstractions and keep component contracts minimal and cohesive.`,
        },
      },
      {
        id: "sec-code-example",
        title: "2. Production-Grade Implementation Pattern",
        content: `Here is a structured, type-safe implementation illustrating standard conventions for ${conceptName}:`,
        codeSnippet: `// Production implementation for ${conceptName}
export interface ${conceptName.replace(/[^a-zA-Z0-9]/g, "")}Contract {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

export class ${conceptName.replace(/[^a-zA-Z0-9]/g, "")}Service {
  constructor(private readonly config: { maxRetries: number }) {}

  public execute(payload: unknown): boolean {
    if (!payload) return false;
    // Core invariant validation
    return true;
  }
}`,
        language: "typescript",
      },
      {
        id: "sec-pitfalls",
        title: "3. Common Pitfalls & Anti-Patterns",
        content: `Engineers often encounter regressions when state transitions in ${conceptName} are uncoordinated. Always enforce single-responsibility boundaries and test edge conditions.`,
      },
    ],
    keyInvariants: [
      `Explicit contracts and parameter validation at all public boundaries`,
      `High cohesion within components; loose coupling across external modules`,
      `Zero silent failures: validate invariants and handle error cases explicitly`,
    ],
    commonPitfalls: [
      {
        mistake: `Tight coupling with concrete implementation details rather than abstractions.`,
        correction: `Rely on explicit interfaces and dependency injection to keep logic decoupled.`,
      },
      {
        mistake: `Neglecting edge-case boundary testing.`,
        correction: `Test empty, null, and concurrent states with automated tests.`,
      },
    ],
    bestPractices: [
      `Keep abstractions simple, clean, and well-typed`,
      `Document architectural decisions and invariants in code comments`,
      `Retake diagnostic quizzes until achieving consistent mastery`,
    ],
  };

  const slides: ConceptSlideData[] = [
    {
      id: `${conceptId}-s1`,
      slideNumber: 1,
      role: "intro",
      title: `${conceptName}: Architectural Overview`,
      subtitle: "Foundations, Design Goals & Engineering Invariants",
      summary: `Understand how ${conceptName} fits into the larger course syllabus and system architecture.`,
      keyPoints: [
        `Provides predictable abstractions and boundary enforcement`,
        `Minimizes coupling and enhances maintainability across modules`,
        `Forms a critical prerequisite step in the course curriculum roadmap`,
      ],
      takeaway: `Master the foundational mental models of ${conceptName} before taking quizzes.`,
    },
    {
      id: `${conceptId}-s2`,
      slideNumber: 2,
      role: "diagram",
      title: "Architectural Flow & Boundary Model",
      subtitle: "Component Interaction and State Propagation",
      summary: `Visual layout of how ${conceptName} communicates with upstream and downstream components.`,
      keyPoints: [
        "Explicit interfaces guarantee safe data flow",
        "Encapsulated internal state protects invariants",
        "Clear boundary contracts facilitate automated testing",
      ],
      diagramData: {
        nodes: [
          { id: "caller", label: "Client Caller", desc: "Upstream component invoking operations", type: "consumer" },
          { id: "core", label: `${conceptName} Core`, desc: "Encapsulated logic & invariant checks", type: "service" },
          { id: "state", label: "State Store", desc: "Isolated memory or persistent state", type: "storage" },
        ],
        connections: [
          { from: "caller", to: "core", label: "invokes contract" },
          { from: "core", to: "state", label: "updates state" },
        ],
      },
      takeaway: "Clear boundaries eliminate cascading failures across system components.",
    },
    {
      id: `${conceptId}-s3`,
      slideNumber: 3,
      role: "code",
      title: "Syntax Patterns & Implementation",
      subtitle: `Clean TypeScript design for ${conceptName}`,
      summary: "Explore clean, production-ready syntax patterns and defensive coding.",
      keyPoints: [
        "Enforce type safety with strict parameter interfaces",
        "Validate inputs at the boundary before processing",
        "Return immutable data structures to prevent side-effects",
      ],
      codeSnippet: `export interface ${conceptName.replace(/[^a-zA-Z0-9]/g, "")}Options {
  timeoutMs: number;
  strictMode: boolean;
}

export function validate${conceptName.replace(/[^a-zA-Z0-9]/g, "")}(options: ${conceptName.replace(/[^a-zA-Z0-9]/g, "")}Options): boolean {
  if (options.timeoutMs <= 0) throw new Error("Invalid timeout");
  return options.strictMode;
}`,
      language: "typescript",
      takeaway: "Defensive validation at boundaries saves hours of debugging in production.",
    },
    {
      id: `${conceptId}-s4`,
      slideNumber: 4,
      role: "comparison",
      title: "Best Practices vs Common Anti-Patterns",
      subtitle: "Navigating architectural trade-offs",
      summary: "Comparing recommended patterns against brittle implementation traps.",
      keyPoints: [
        "Loose coupling is always preferred over concrete hardcoding",
        "Explicit error handling prevents silent failure states",
      ],
      comparisonTable: {
        headers: ["Design Aspect", "Recommended Best Practice", "Common Anti-Pattern"],
        rows: [
          ["Coupling", "Depend on abstractions / interfaces", "Hardcode concrete classes with 'new'"],
          ["State Mutability", "Immutable data & pure transformers", "Global mutable variables"],
          ["Error Strategy", "Explicit failure returns & typed errors", "Swallowing errors silently"],
          ["Testing", "Isolated unit tests with mocked collaborators", "Heavy end-to-end only tests"],
        ],
      },
      takeaway: "Adhere to the left column to build scalable, resilient software.",
    },
    {
      id: `${conceptId}-s5`,
      slideNumber: 5,
      role: "summary",
      title: "Engineering Checklist & Quiz Readiness",
      subtitle: "Review complete. Proceed to Tab 2.",
      summary: `You have completed the syllabus docs and slides for ${conceptName}.`,
      keyPoints: [
        `✓ Core abstractions and boundary invariants understood`,
        `✓ Reviewed production syntax patterns and edge cases`,
        `✓ Minimum 70% passing score required on the diagnostic quiz`,
        `✓ Retake the quiz repeatedly on failure until mastery is achieved`,
      ],
      takeaway: "Mark this concept as completed to unlock Tab 2: Take the Quiz!",
    },
  ];

  return { docs, slides, estimatedMinutes: 8 };
}

export async function getCourseLearnData(actor: Actor, moduleId?: string): Promise<LearnCourseData> {
  if (actor.role !== "student") {
    throw AppError.forbidden("The Learn module is available for enrolled students.");
  }
  if (!actor.instituteId) {
    throw AppError.forbidden("Your account is not assigned to an institute.");
  }

  // 1. Fetch all available courses (modules) for the institute
  const allModules = await db
    .select({
      id: modules.id,
      name: modules.name,
      threshold: modules.masteryThreshold,
      goalConceptId: modules.goalConceptId,
    })
    .from(modules)
    .where(eq(modules.instituteId, actor.instituteId));

  if (allModules.length === 0) {
    return {
      student: { id: actor.id, name: actor.name },
      module: null,
      availableModules: [],
      overview: {
        totalConcepts: 0,
        masteredConcepts: 0,
        developingConcepts: 0,
        unassessedConcepts: 0,
        averageMastery: 0,
        standingLabel: "No Course Enrolled",
      },
      concepts: [],
    };
  }

  // Resolve active course module
  const activeModule =
    (moduleId ? allModules.find((m) => m.id === moduleId) : null) ?? allModules[0];

  // 2. Fetch all concepts in the active module
  const conceptLinks = await db
    .select({
      conceptId: moduleConcepts.conceptId,
      name: concepts.name,
      description: concepts.description,
    })
    .from(moduleConcepts)
    .innerJoin(concepts, eq(concepts.id, moduleConcepts.conceptId))
    .where(
      and(
        eq(moduleConcepts.moduleId, activeModule.id),
        eq(moduleConcepts.instituteId, actor.instituteId),
      ),
    );

  const conceptIds = conceptLinks.map((item) => item.conceptId);

  // 3. Fetch prerequisites within institute
  const edgeRows = conceptIds.length > 0
    ? await db
        .select({
          conceptId: prerequisites.conceptId,
          requiresId: prerequisites.requiresId,
        })
        .from(prerequisites)
        .where(
          and(
            eq(prerequisites.instituteId, actor.instituteId),
            inArray(prerequisites.conceptId, conceptIds),
          ),
        )
    : [];

  // 4. Fetch student's stored mastery state
  const masteryRows = conceptIds.length > 0
    ? await db
        .select({
          conceptId: masteryState.conceptId,
          pKnow: masteryState.pKnow,
        })
        .from(masteryState)
        .where(
          and(
            eq(masteryState.studentId, actor.id),
            eq(masteryState.instituteId, actor.instituteId),
            inArray(masteryState.conceptId, conceptIds),
          ),
        )
    : [];

  const masteryMap = new Map<string, number>(masteryRows.map((r) => [r.conceptId, r.pKnow]));

  // 5. Fetch published lessons for these concepts with full scene data
  const publishedLessons = conceptIds.length > 0
    ? await db
        .select({
          id: lessons.id,
          title: lessons.title,
          conceptId: lessons.conceptId,
          durationMinutes: lessons.durationMinutes,
          topic: lessons.topic,
          objectives: lessons.objectives,
          sourceMaterial: lessons.sourceMaterial,
          languageDirective: lessons.languageDirective,
          scenesJson: lessons.scenesJson,
        })
        .from(lessons)
        .where(
          and(
            eq(lessons.instituteId, actor.instituteId),
            eq(lessons.status, "published"),
            inArray(lessons.conceptId, conceptIds),
          ),
        )
        .orderBy(desc(lessons.publishedAt))
    : [];

  interface StoredLessonData {
    id: string;
    title: string;
    durationMinutes: number;
    objectives: string;
    sourceMaterial: string;
    scenes: PreviewScene[];
  }

  const lessonMap = new Map<string, StoredLessonData>();
  for (const lesson of publishedLessons) {
    if (!lessonMap.has(lesson.conceptId)) {
      const language = parseLanguageDirective(lesson.languageDirective);
      const parsedScenes = previewScenes(lesson.scenesJson, false, language.code);
      lessonMap.set(lesson.conceptId, {
        id: lesson.id,
        title: lesson.title,
        durationMinutes: lesson.durationMinutes,
        objectives: lesson.objectives,
        sourceMaterial: lesson.sourceMaterial,
        scenes: parsedScenes,
      });
    }
  }

  // 6. Build concept lookup maps, prerequisite sequence & unlocks graph
  const conceptNameMap = new Map(conceptLinks.map((c) => [c.conceptId, c.name]));
  const conceptDescMap = new Map(conceptLinks.map((c) => [c.conceptId, c.description]));

  const prereqsByConcept = new Map<string, string[]>();
  const unlocksByConcept = new Map<string, string[]>();
  for (const cid of conceptIds) {
    prereqsByConcept.set(cid, []);
    unlocksByConcept.set(cid, []);
  }

  for (const edge of edgeRows) {
    prereqsByConcept.get(edge.conceptId)?.push(edge.requiresId);
    unlocksByConcept.get(edge.requiresId)?.push(edge.conceptId);
  }

  // Exact topological sort aligning with the Concept Map in /curriculum
  const orderedConceptIds = orderByPrerequisite(
    conceptIds,
    edgeRows.map((e) => ({ conceptId: e.conceptId, requiresId: e.requiresId })),
  );

  // 7. Assemble Course Concepts with Step, Docs, Slides, and Diagnostic Quizzes
  let masteredCount = 0;
  let developingCount = 0;
  let unassessedCount = 0;
  let totalMasterySum = 0;
  let assessedCount = 0;

  const conceptItems: CourseConceptItem[] = orderedConceptIds.map((cid, index) => {
    const name = conceptNameMap.get(cid) ?? cid;
    const description = conceptDescMap.get(cid) ?? "";
    const pKnow = masteryMap.get(cid) ?? null;
    const band = masteryBand(pKnow, activeModule.threshold);
    const isGoal = cid === activeModule.goalConceptId;

    if (pKnow !== null) {
      assessedCount++;
      totalMasterySum += pKnow;
      if (pKnow >= activeModule.threshold) {
        masteredCount++;
      } else {
        developingCount++;
      }
    } else {
      unassessedCount++;
    }

    let understandingStanding: CourseConceptItem["understandingStanding"] = "Not Assessed";
    if (pKnow !== null) {
      if (pKnow >= 0.8) understandingStanding = "Mastered";
      else if (pKnow >= 0.65) understandingStanding = "Proficient";
      else if (pKnow >= 0.45) understandingStanding = "Developing";
      else understandingStanding = "Foundational";
    }

    const prereqList = (prereqsByConcept.get(cid) ?? []).map((reqId) => {
      const reqMastery = masteryMap.get(reqId) ?? null;
      const met = reqMastery !== null && reqMastery >= activeModule.threshold;
      return {
        id: reqId,
        name: conceptNameMap.get(reqId) ?? reqId,
        met,
        mastery: reqMastery,
      };
    });

    const allPrerequisitesMet = prereqList.every((p) => p.met);

    let conceptMapStatus: CourseConceptItem["conceptMapStatus"] = "Ready to Learn";
    if (band === "solid") {
      conceptMapStatus = "Mastered";
    } else if (pKnow !== null && pKnow > 0) {
      conceptMapStatus = "In Progress";
    } else if (allPrerequisitesMet) {
      conceptMapStatus = "Ready to Learn";
    } else {
      conceptMapStatus = "Prerequisites Blocked";
    }

    const outgoingUnlocks = (unlocksByConcept.get(cid) ?? []).map((uId) => ({
      id: uId,
      name: conceptNameMap.get(uId) ?? uId,
    }));

    // Build docs & slides (incorporating published lesson if present)
    const storedLesson = lessonMap.get(cid) ?? null;
    const { docs, slides, estimatedMinutes } = buildDocsAndSlides(
      cid,
      name,
      description,
      storedLesson,
    );

    // Match quiz key from standard concept names or keys
    const lowerName = name.toLowerCase();
    let quizTemplate = CONCEPT_QUIZZES[lowerName];
    if (!quizTemplate) {
      if (lowerName.includes("variable")) quizTemplate = CONCEPT_QUIZZES.variables;
      else if (lowerName.includes("function")) quizTemplate = CONCEPT_QUIZZES.functions;
      else if (lowerName.includes("class") || lowerName.includes("object")) quizTemplate = CONCEPT_QUIZZES.classes;
      else if (lowerName.includes("inherit") || lowerName.includes("polymorphism")) quizTemplate = CONCEPT_QUIZZES.inheritance;
      else if (lowerName.includes("dependency") || lowerName.includes("injection") || lowerName.includes("ioc")) quizTemplate = CONCEPT_QUIZZES.di;
    }

    const quiz: ConceptQuiz = quizTemplate
      ? {
          conceptId: cid,
          conceptName: name,
          title: quizTemplate.title,
          description: quizTemplate.description,
          estimatedMinutes: quizTemplate.estimatedMinutes,
          passingScorePercent: quizTemplate.passingScorePercent ?? 70,
          questions: quizTemplate.questions,
        }
      : defaultQuizForConcept(cid, name);

    return {
      id: cid,
      name,
      description,
      step: index + 1,
      isGoal,
      conceptMapStatus,
      allPrerequisitesMet,
      unlocks: outgoingUnlocks,
      prerequisites: prereqList,
      mastery: pKnow,
      masteryBand: band,
      understandingStanding,
      estimatedMinutes,
      lesson: storedLesson ? { id: storedLesson.id, title: storedLesson.title, durationMinutes: storedLesson.durationMinutes } : null,
      docs,
      slides,
      quiz,
    };
  });

  const avgMastery = assessedCount > 0 ? totalMasterySum / assessedCount : 0;
  let standingLabel = "Starting Course";
  if (masteredCount === conceptItems.length && conceptItems.length > 0) {
    standingLabel = "Course Mastery Achieved";
  } else if (masteredCount > 0) {
    standingLabel = `${masteredCount}/${conceptItems.length} Concepts Mastered`;
  } else if (assessedCount > 0) {
    standingLabel = "In Progress";
  }

  // 8. Build overview for all available modules in the institute
  const allModuleLinks = await db
    .select({
      moduleId: moduleConcepts.moduleId,
      conceptId: moduleConcepts.conceptId,
    })
    .from(moduleConcepts)
    .where(eq(moduleConcepts.instituteId, actor.instituteId));

  const availableModulesData = allModules.map((m) => {
    const cIds = allModuleLinks.filter((l) => l.moduleId === m.id).map((l) => l.conceptId);
    const mCount = cIds.filter((cid) => (masteryMap.get(cid) ?? 0) >= m.threshold).length;
    const goalName = conceptNameMap.get(m.goalConceptId) ?? "Course Goal";
    return {
      id: m.id,
      name: m.name,
      threshold: m.threshold,
      goalConceptName: goalName,
      totalConcepts: cIds.length,
      masteredConcepts: mCount,
    };
  });

  const goalConceptName = conceptNameMap.get(activeModule.goalConceptId) ?? "Course Goal";

  return {
    student: { id: actor.id, name: actor.name },
    module: {
      id: activeModule.id,
      name: activeModule.name,
      threshold: activeModule.threshold,
      goalConceptId: activeModule.goalConceptId,
      goalConceptName,
    },
    availableModules: availableModulesData,
    overview: {
      totalConcepts: conceptItems.length,
      masteredConcepts: masteredCount,
      developingConcepts: developingCount,
      unassessedConcepts: unassessedCount,
      averageMastery: avgMastery,
      standingLabel,
    },
    concepts: conceptItems,
  };
}
