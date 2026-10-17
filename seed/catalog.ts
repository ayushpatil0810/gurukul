export const DEMO_PASSWORD = "PortalDemo!2026";

export const DEMO_INSTITUTE = "TechSummitTrainers";
export const DEMO_BATCH = "October 2026";

export const DEMO_USERS = [
  { email: "admin@techsummit.example", name: "Avery Admin", role: "admin" },
  { email: "trainer@techsummit.example", name: "Taylor Trainer", role: "trainer" },
  { email: "ada@techsummit.example", name: "Ada Student", role: "student" },
  { email: "ben@techsummit.example", name: "Ben Student", role: "student" },
  { email: "cara@techsummit.example", name: "Cara Student", role: "student" },
] as const;

export const DEMO_CONCEPTS = [
  { key: "variables", name: "Variables", description: "Names, values, and assignment." },
  { key: "functions", name: "Functions", description: "Parameters, return values, and call sites." },
  { key: "classes", name: "Classes and Objects", description: "State and behavior grouped on an object." },
  { key: "inheritance", name: "Inheritance", description: "Specializing an existing type." },
  { key: "di", name: "Dependency Injection", description: "Supplying collaborators instead of constructing them." },
] as const;

export const DEMO_EDGES = [
  { concept: "functions", requires: "variables" },
  { concept: "classes", requires: "functions" },
  { concept: "inheritance", requires: "classes" },
  { concept: "di", requires: "inheritance" },
] as const;

export const DEVOPS_CONCEPTS = [
  { key: "namespaces", name: "Linux Namespaces & Isolation", description: "Kernel-level PID, mount, and network namespace process boundaries." },
  { key: "chroot", name: "POSIX Chroot Jails", description: "Root filesystem virtualization, jail escapes prevention, and unprivileged sandboxes." },
  { key: "docker-build", name: "Docker Multi-Stage BuildKit", description: "Layer caching, lean image packaging, and container daemon runtime architecture." },
  { key: "container-net", name: "Container Virtual Networking", description: "Bridge interfaces, veth virtual pairs, and inter-container DNS resolution." },
  { key: "k8s-pods", name: "Kubernetes Pods & ReplicaSets", description: "Declarative pod specifications, sidecars, replica controllers, and health probes." },
  { key: "k8s-rollouts", name: "Zero-Downtime Rolling Deployments", description: "Rolling update strategies, surge quotas, traffic draining, and automated rollbacks." },
] as const;

export const DEVOPS_EDGES = [
  { concept: "chroot", requires: "namespaces" },
  { concept: "docker-build", requires: "chroot" },
  { concept: "container-net", requires: "docker-build" },
  { concept: "k8s-pods", requires: "container-net" },
  { concept: "k8s-rollouts", requires: "k8s-pods" },
] as const;

export const ASYNC_CONCEPTS = [
  { key: "event-loop", name: "Event Loop & Execution Stack", description: "V8 single-threaded call stack, macrotasks, and microtask queues." },
  { key: "promises", name: "Promises & Microtask Resolution", description: "Promise state machines, thenable chaining, async/await transforms, and error catch trees." },
  { key: "event-emitters", name: "EventEmitters & Reactive Signals", description: "Event-driven publish/subscribe channels and lifecycle listeners." },
  { key: "async-iterators", name: "Async Iterators & Generators", description: "Symbol.asyncIterator protocol, chunk pull semantics, and for-await loops." },
  { key: "node-streams", name: "Node.js Stream Transform Pipelines", description: "Readable, Writable, and Transform stream pipelines with chunk buffering." },
  { key: "stream-backpressure", name: "Backpressure Flow Control", description: "HighWaterMark limits, drain events, and memory-safe stream backpressure." },
] as const;

export const ASYNC_EDGES = [
  { concept: "promises", requires: "event-loop" },
  { concept: "event-emitters", requires: "event-loop" },
  { concept: "async-iterators", requires: "promises" },
  { concept: "async-iterators", requires: "event-emitters" },
  { concept: "node-streams", requires: "async-iterators" },
  { concept: "stream-backpressure", requires: "node-streams" },
] as const;

export type TestCase = { input: string; expectedOutput: string };

export type SeedQuestion = {
  statement: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  concept: (typeof DEMO_CONCEPTS)[number]["key"];
  starter: string;
  visibleTests: TestCase[];
  hiddenTests: TestCase[];
  visible: TestCase;
  hidden: TestCase;
};

export const DEMO_QUESTIONS: SeedQuestion[] = [
  {
    statement: "Read two integers and print their sum.",
    difficulty: 1,
    concept: "variables",
    starter: `/**
 * Calculate the sum of two integers.
 * @param {number} a
 * @param {number} b
 * @return {number}
 */
function sum(a, b) {
  // Write your code here
  return a + b;
}
`,
    visibleTests: [
      { input: "2 3\n", expectedOutput: "5\n" },
      { input: "0 0\n", expectedOutput: "0\n" },
      { input: "-5 12\n", expectedOutput: "7\n" },
    ],
    hiddenTests: [
      { input: "10 -4\n", expectedOutput: "6\n" },
      { input: "-20 -30\n", expectedOutput: "-50\n" },
      { input: "1000000 2000000\n", expectedOutput: "3000000\n" },
      { input: "999 -999\n", expectedOutput: "0\n" },
    ],
    visible: { input: "2 3\n", expectedOutput: "5\n" },
    hidden: { input: "10 -4\n", expectedOutput: "6\n" },
  },
  {
    statement: "Read one integer and print its double.",
    difficulty: 1,
    concept: "variables",
    starter: `/**
 * Return the double of the given integer.
 * @param {number} n
 * @return {number}
 */
function doubleInteger(n) {
  // Write your code here
  return n * 2;
}
`,
    visibleTests: [
      { input: "4\n", expectedOutput: "8\n" },
      { input: "0\n", expectedOutput: "0\n" },
      { input: "-3\n", expectedOutput: "-6\n" },
    ],
    hiddenTests: [
      { input: "15\n", expectedOutput: "30\n" },
      { input: "-50\n", expectedOutput: "-100\n" },
      { input: "500000\n", expectedOutput: "1000000\n" },
      { input: "1\n", expectedOutput: "2\n" },
    ],
    visible: { input: "4\n", expectedOutput: "8\n" },
    hidden: { input: "-3\n", expectedOutput: "-6\n" },
  },
  {
    statement: "Read three integers and print the largest.",
    difficulty: 2,
    concept: "variables",
    starter: `/**
 * Return the largest of three integers.
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @return {number}
 */
function findLargest(a, b, c) {
  // Write your code here
  return Math.max(a, b, c);
}
`,
    visibleTests: [
      { input: "1 9 4\n", expectedOutput: "9\n" },
      { input: "5 2 3\n", expectedOutput: "5\n" },
      { input: "1 2 8\n", expectedOutput: "8\n" },
    ],
    hiddenTests: [
      { input: "-2 -8 -1\n", expectedOutput: "-1\n" },
      { input: "7 7 7\n", expectedOutput: "7\n" },
      { input: "0 -10 5\n", expectedOutput: "5\n" },
      { input: "100 500 250\n", expectedOutput: "500\n" },
    ],
    visible: { input: "1 9 4\n", expectedOutput: "9\n" },
    hidden: { input: "-2 -8 -1\n", expectedOutput: "-1\n" },
  },
  {
    statement: "Write a function that returns the product of two integers read from stdin.",
    difficulty: 2,
    concept: "functions",
    starter: `/**
 * Return the product of two integers.
 * @param {number} a
 * @param {number} b
 * @return {number}
 */
function product(a, b) {
  // Write your code here
  return a * b;
}
`,
    visibleTests: [
      { input: "3 5\n", expectedOutput: "15\n" },
      { input: "7 0\n", expectedOutput: "0\n" },
      { input: "-4 6\n", expectedOutput: "-24\n" },
    ],
    hiddenTests: [
      { input: "-8 -5\n", expectedOutput: "40\n" },
      { input: "12 12\n", expectedOutput: "144\n" },
      { input: "1 9999\n", expectedOutput: "9999\n" },
      { input: "-1 100\n", expectedOutput: "-100\n" },
    ],
    visible: { input: "3 5\n", expectedOutput: "15\n" },
    hidden: { input: "7 0\n", expectedOutput: "0\n" },
  },
  {
    statement: "Write a function that returns the factorial of n for n up to 10.",
    difficulty: 3,
    concept: "functions",
    starter: `/**
 * Return the factorial of n (0 <= n <= 10).
 * @param {number} n
 * @return {number}
 */
function factorial(n) {
  // Write your code here
  if (n <= 1) return 1;
  let ans = 1;
  for (let i = 2; i <= n; i++) ans *= i;
  return ans;
}
`,
    visibleTests: [
      { input: "5\n", expectedOutput: "120\n" },
      { input: "0\n", expectedOutput: "1\n" },
      { input: "1\n", expectedOutput: "1\n" },
    ],
    hiddenTests: [
      { input: "3\n", expectedOutput: "6\n" },
      { input: "6\n", expectedOutput: "720\n" },
      { input: "7\n", expectedOutput: "5040\n" },
      { input: "10\n", expectedOutput: "3628800\n" },
    ],
    visible: { input: "5\n", expectedOutput: "120\n" },
    hidden: { input: "0\n", expectedOutput: "1\n" },
  },
  {
    statement: "Write a function that returns the minimum of three integers.",
    difficulty: 2,
    concept: "functions",
    starter: `/**
 * Return the minimum of three integers.
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @return {number}
 */
function minimum(a, b, c) {
  // Write your code here
  return Math.min(a, b, c);
}
`,
    visibleTests: [
      { input: "8 3 5\n", expectedOutput: "3\n" },
      { input: "1 4 9\n", expectedOutput: "1\n" },
      { input: "10 20 2\n", expectedOutput: "2\n" },
    ],
    hiddenTests: [
      { input: "4 4 9\n", expectedOutput: "4\n" },
      { input: "-5 -2 -10\n", expectedOutput: "-10\n" },
      { input: "0 0 0\n", expectedOutput: "0\n" },
      { input: "-15 0 15\n", expectedOutput: "-15\n" },
    ],
    visible: { input: "8 3 5\n", expectedOutput: "3\n" },
    hidden: { input: "4 4 9\n", expectedOutput: "4\n" },
  },
  {
    statement: "Implement Rectangle.area and print the area of the width and height read from stdin.",
    difficulty: 3,
    concept: "classes",
    starter: `class Rectangle {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  area() {
    // Write your code here
    return this.width * this.height;
  }
}
`,
    visibleTests: [
      { input: "3 4\n", expectedOutput: "12\n" },
      { input: "5 5\n", expectedOutput: "25\n" },
      { input: "1 10\n", expectedOutput: "10\n" },
    ],
    hiddenTests: [
      { input: "7 8\n", expectedOutput: "56\n" },
      { input: "20 30\n", expectedOutput: "600\n" },
      { input: "12 9\n", expectedOutput: "108\n" },
      { input: "100 2\n", expectedOutput: "200\n" },
    ],
    visible: { input: "3 4\n", expectedOutput: "12\n" },
    hidden: { input: "7 8\n", expectedOutput: "56\n" },
  },
  {
    statement: "Implement Counter.increment so it prints the value after one increment, starting from the integer on stdin.",
    difficulty: 3,
    concept: "classes",
    starter: `class Counter {
  constructor(value) {
    this.value = value;
  }

  increment() {
    // Write your code here
    return this.value + 1;
  }
}
`,
    visibleTests: [
      { input: "10\n", expectedOutput: "11\n" },
      { input: "0\n", expectedOutput: "1\n" },
      { input: "-5\n", expectedOutput: "-4\n" },
    ],
    hiddenTests: [
      { input: "99\n", expectedOutput: "100\n" },
      { input: "-1\n", expectedOutput: "0\n" },
      { input: "42\n", expectedOutput: "43\n" },
      { input: "999\n", expectedOutput: "1000\n" },
    ],
    visible: { input: "10\n", expectedOutput: "11\n" },
    hidden: { input: "0\n", expectedOutput: "1\n" },
  },
  {
    statement: "Extend Shape with Square.area and print the area of the side length on stdin.",
    difficulty: 4,
    concept: "inheritance",
    starter: `class Shape {}

class Square extends Shape {
  constructor(side) {
    super();
    this.side = side;
  }

  area() {
    // Write your code here
    return this.side * this.side;
  }
}
`,
    visibleTests: [
      { input: "6\n", expectedOutput: "36\n" },
      { input: "1\n", expectedOutput: "1\n" },
      { input: "4\n", expectedOutput: "16\n" },
    ],
    hiddenTests: [
      { input: "10\n", expectedOutput: "100\n" },
      { input: "12\n", expectedOutput: "144\n" },
      { input: "25\n", expectedOutput: "625\n" },
      { input: "8\n", expectedOutput: "64\n" },
    ],
    visible: { input: "6\n", expectedOutput: "36\n" },
    hidden: { input: "1\n", expectedOutput: "1\n" },
  },
  {
    statement: "Dog extends Animal. Print the sound for the name read from stdin as 'name: woof'.",
    difficulty: 3,
    concept: "inheritance",
    starter: `class Animal {
  constructor(name) {
    this.name = name;
  }
}

class Dog extends Animal {
  speak() {
    // Write your code here
    return this.name + ": woof";
  }
}
`,
    visibleTests: [
      { input: "Rex\n", expectedOutput: "Rex: woof\n" },
      { input: "Buddy\n", expectedOutput: "Buddy: woof\n" },
      { input: "Max\n", expectedOutput: "Max: woof\n" },
    ],
    hiddenTests: [
      { input: "Nia\n", expectedOutput: "Nia: woof\n" },
      { input: "Charlie\n", expectedOutput: "Charlie: woof\n" },
      { input: "Luna\n", expectedOutput: "Luna: woof\n" },
      { input: "Rocky\n", expectedOutput: "Rocky: woof\n" },
    ],
    visible: { input: "Rex\n", expectedOutput: "Rex: woof\n" },
    hidden: { input: "Nia\n", expectedOutput: "Nia: woof\n" },
  },
  {
    statement: "A subclass DiscountedPrice overrides price. Print the discounted price for the base price on stdin, using 10 percent off.",
    difficulty: 4,
    concept: "inheritance",
    starter: `class Price {
  constructor(amount) {
    this.amount = amount;
  }

  value() {
    return this.amount;
  }
}

class DiscountedPrice extends Price {
  value() {
    // Write your code here (apply 10% discount)
    return Math.round(this.amount * 0.9);
  }
}
`,
    visibleTests: [
      { input: "100\n", expectedOutput: "90\n" },
      { input: "50\n", expectedOutput: "45\n" },
      { input: "20\n", expectedOutput: "18\n" },
    ],
    hiddenTests: [
      { input: "200\n", expectedOutput: "180\n" },
      { input: "10\n", expectedOutput: "9\n" },
      { input: "350\n", expectedOutput: "315\n" },
      { input: "0\n", expectedOutput: "0\n" },
    ],
    visible: { input: "100\n", expectedOutput: "90\n" },
    hidden: { input: "50\n", expectedOutput: "45\n" },
  },
  {
    statement: "Greeter receives a formatter. Print the formatted hello for the name on stdin.",
    difficulty: 4,
    concept: "di",
    starter: `class PlainFormatter {
  format(name) {
    // Write your code here
    return "Hello, " + name;
  }
}

class Greeter {
  constructor(formatter) {
    this.formatter = formatter;
  }

  hello(name) {
    return this.formatter.format(name);
  }
}
`,
    visibleTests: [
      { input: "Ada\n", expectedOutput: "Hello, Ada\n" },
      { input: "World\n", expectedOutput: "Hello, World\n" },
      { input: "Gurukul\n", expectedOutput: "Hello, Gurukul\n" },
    ],
    hiddenTests: [
      { input: "Ben\n", expectedOutput: "Hello, Ben\n" },
      { input: "Developer\n", expectedOutput: "Hello, Developer\n" },
      { input: "Alice\n", expectedOutput: "Hello, Alice\n" },
      { input: "Taylor\n", expectedOutput: "Hello, Taylor\n" },
    ],
    visible: { input: "Ada\n", expectedOutput: "Hello, Ada\n" },
    hidden: { input: "Ben\n", expectedOutput: "Hello, Ben\n" },
  },
  {
    statement: "A reporter depends on a clock. Print 'tick ' plus the number on stdin.",
    difficulty: 3,
    concept: "di",
    starter: `class Clock {
  constructor(value) {
    this.value = value;
  }

  now() {
    // Write your code here
    return this.value;
  }
}

class Reporter {
  constructor(clock) {
    this.clock = clock;
  }

  line() {
    return "tick " + this.clock.now();
  }
}
`,
    visibleTests: [
      { input: "3\n", expectedOutput: "tick 3\n" },
      { input: "0\n", expectedOutput: "tick 0\n" },
      { input: "1\n", expectedOutput: "tick 1\n" },
    ],
    hiddenTests: [
      { input: "12\n", expectedOutput: "tick 12\n" },
      { input: "55\n", expectedOutput: "tick 55\n" },
      { input: "100\n", expectedOutput: "tick 100\n" },
      { input: "999\n", expectedOutput: "tick 999\n" },
    ],
    visible: { input: "3\n", expectedOutput: "tick 3\n" },
    hidden: { input: "12\n", expectedOutput: "tick 12\n" },
  },
  {
    statement: "Mailer depends on a transport. Print 'sent:' plus the body read from stdin.",
    difficulty: 5,
    concept: "di",
    starter: `class Transport {
  send(body) {
    // Write your code here
    return "sent:" + body;
  }
}

class Mailer {
  constructor(transport) {
    this.transport = transport;
  }

  deliver(body) {
    return this.transport.send(body);
  }
}
`,
    visibleTests: [
      { input: "ready\n", expectedOutput: "sent:ready\n" },
      { input: "hello\n", expectedOutput: "sent:hello\n" },
      { input: "welcome\n", expectedOutput: "sent:welcome\n" },
    ],
    hiddenTests: [
      { input: "done\n", expectedOutput: "sent:done\n" },
      { input: "invoice_42\n", expectedOutput: "sent:invoice_42\n" },
      { input: "packet_ok\n", expectedOutput: "sent:packet_ok\n" },
      { input: "confirmed\n", expectedOutput: "sent:confirmed\n" },
    ],
    visible: { input: "ready\n", expectedOutput: "sent:ready\n" },
    hidden: { input: "done\n", expectedOutput: "sent:done\n" },
  },
];

