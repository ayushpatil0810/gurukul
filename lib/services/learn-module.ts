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
  questions: ConceptQuizQuestion[];
};

export type CourseConceptItem = {
  id: string;
  name: string;
  description: string;
  prerequisites: { id: string; name: string; met: boolean; mastery: number | null }[];
  mastery: number | null;
  masteryBand: MasteryBand;
  understandingStanding: "Mastered" | "Proficient" | "Developing" | "Foundational" | "Not Assessed";
  lesson: { id: string; title: string } | null;
  quiz: ConceptQuiz;
};

export type LearnCourseData = {
  student: { id: string; name: string };
  module: {
    id: string;
    name: string;
    threshold: number;
    goalConceptName: string;
  } | null;
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

// Fallback generator for any custom or dynamically created concepts
function defaultQuizForConcept(conceptId: string, conceptName: string): ConceptQuiz {
  return {
    conceptId,
    conceptName,
    title: `${conceptName} Diagnostic Quiz`,
    description: `Evaluate your core understanding, syntax patterns, and best practices for ${conceptName}.`,
    estimatedMinutes: 5,
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

export async function getCourseLearnData(actor: Actor, moduleId?: string): Promise<LearnCourseData> {
  if (actor.role !== "student") {
    throw AppError.forbidden("The Learn module is available for enrolled students.");
  }
  if (!actor.instituteId) {
    throw AppError.forbidden("Your account is not assigned to an institute.");
  }

  // 1. Load active course module
  const [activeModule] = await db
    .select({
      id: modules.id,
      name: modules.name,
      threshold: modules.masteryThreshold,
      goalConceptId: modules.goalConceptId,
    })
    .from(modules)
    .where(
      moduleId
        ? and(eq(modules.id, moduleId), eq(modules.instituteId, actor.instituteId))
        : eq(modules.instituteId, actor.instituteId),
    )
    .limit(1);

  if (!activeModule) {
    return {
      student: { id: actor.id, name: actor.name },
      module: null,
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

  // 2. Fetch all concepts in this module
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

  // 5. Fetch published lessons for these concepts
  const publishedLessons = conceptIds.length > 0
    ? await db
        .select({
          id: lessons.id,
          title: lessons.title,
          conceptId: lessons.conceptId,
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

  const lessonMap = new Map<string, { id: string; title: string }>();
  for (const lesson of publishedLessons) {
    if (!lessonMap.has(lesson.conceptId)) {
      lessonMap.set(lesson.conceptId, { id: lesson.id, title: lesson.title });
    }
  }

  // 6. Build concept lookup maps & prerequisite sequence order
  const conceptNameMap = new Map(conceptLinks.map((c) => [c.conceptId, c.name]));
  const conceptDescMap = new Map(conceptLinks.map((c) => [c.conceptId, c.description]));

  const prereqsByConcept = new Map<string, string[]>();
  for (const edge of edgeRows) {
    const list = prereqsByConcept.get(edge.conceptId) ?? [];
    list.push(edge.requiresId);
    prereqsByConcept.set(edge.conceptId, list);
  }

  const orderedConceptIds = orderByPrerequisite(
    conceptIds,
    edgeRows.map((e) => ({ conceptId: e.conceptId, requiresId: e.requiresId })),
  );

  // 7. Assemble Course Concepts with Quizzes and Mastery Standing
  let masteredCount = 0;
  let developingCount = 0;
  let unassessedCount = 0;
  let totalMasterySum = 0;
  let assessedCount = 0;

  const conceptItems: CourseConceptItem[] = orderedConceptIds.map((cid) => {
    const name = conceptNameMap.get(cid) ?? cid;
    const description = conceptDescMap.get(cid) ?? "";
    const pKnow = masteryMap.get(cid) ?? null;
    const band = masteryBand(pKnow, activeModule.threshold);

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
          questions: quizTemplate.questions,
        }
      : defaultQuizForConcept(cid, name);

    return {
      id: cid,
      name,
      description,
      prerequisites: prereqList,
      mastery: pKnow,
      masteryBand: band,
      understandingStanding,
      lesson: lessonMap.get(cid) ?? null,
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

  const goalConceptName = conceptNameMap.get(activeModule.goalConceptId) ?? "Course Goal";

  return {
    student: { id: actor.id, name: actor.name },
    module: {
      id: activeModule.id,
      name: activeModule.name,
      threshold: activeModule.threshold,
      goalConceptName,
    },
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
