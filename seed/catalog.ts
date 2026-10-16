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

type SeedQuestion = {
  statement: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  concept: (typeof DEMO_CONCEPTS)[number]["key"];
  starter: string;
  visible: { input: string; expectedOutput: string };
  hidden: { input: string; expectedOutput: string };
};

export const DEMO_QUESTIONS: SeedQuestion[] = [
  {
    statement: "Read two integers and print their sum.",
    difficulty: 1,
    concept: "variables",
    starter: "const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\n",
    visible: { input: "2 3\n", expectedOutput: "5\n" },
    hidden: { input: "10 -4\n", expectedOutput: "6\n" },
  },
  {
    statement: "Read one integer and print its double.",
    difficulty: 1,
    concept: "variables",
    starter: "const fs = require('fs');\nconst n = Number(fs.readFileSync(0, 'utf8').trim());\n",
    visible: { input: "4\n", expectedOutput: "8\n" },
    hidden: { input: "-3\n", expectedOutput: "-6\n" },
  },
  {
    statement: "Read three integers and print the largest.",
    difficulty: 2,
    concept: "variables",
    starter: "const fs = require('fs');\nconst nums = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\n",
    visible: { input: "1 9 4\n", expectedOutput: "9\n" },
    hidden: { input: "-2 -8 -1\n", expectedOutput: "-1\n" },
  },
  {
    statement: "Write a function that returns the product of two integers read from stdin.",
    difficulty: 2,
    concept: "functions",
    starter: "function product(a, b) {\n  return 0;\n}\nconst fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(product(a, b));\n",
    visible: { input: "3 5\n", expectedOutput: "15\n" },
    hidden: { input: "7 0\n", expectedOutput: "0\n" },
  },
  {
    statement: "Write a function that returns the factorial of n for n up to 10.",
    difficulty: 3,
    concept: "functions",
    starter: "function factorial(n) {\n  return 0;\n}\nconst fs = require('fs');\nconst n = Number(fs.readFileSync(0, 'utf8').trim());\nconsole.log(factorial(n));\n",
    visible: { input: "5\n", expectedOutput: "120\n" },
    hidden: { input: "0\n", expectedOutput: "1\n" },
  },
  {
    statement: "Write a function that returns the minimum of three integers.",
    difficulty: 2,
    concept: "functions",
    starter: "function minimum(a, b, c) {\n  return 0;\n}\nconst fs = require('fs');\nconst [a, b, c] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(minimum(a, b, c));\n",
    visible: { input: "8 3 5\n", expectedOutput: "3\n" },
    hidden: { input: "4 4 9\n", expectedOutput: "4\n" },
  },
  {
    statement: "Implement Rectangle.area and print the area of the width and height read from stdin.",
    difficulty: 3,
    concept: "classes",
    starter: "class Rectangle {\n  constructor(width, height) {\n    this.width = width;\n    this.height = height;\n  }\n  area() {\n    return 0;\n  }\n}\nconst fs = require('fs');\nconst [w, h] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(new Rectangle(w, h).area());\n",
    visible: { input: "3 4\n", expectedOutput: "12\n" },
    hidden: { input: "7 8\n", expectedOutput: "56\n" },
  },
  {
    statement: "Implement Counter.increment so it prints the value after one increment, starting from the integer on stdin.",
    difficulty: 3,
    concept: "classes",
    starter: "class Counter {\n  constructor(value) {\n    this.value = value;\n  }\n  increment() {\n    return this.value;\n  }\n}\nconst fs = require('fs');\nconst start = Number(fs.readFileSync(0, 'utf8').trim());\nconsole.log(new Counter(start).increment());\n",
    visible: { input: "10\n", expectedOutput: "11\n" },
    hidden: { input: "0\n", expectedOutput: "1\n" },
  },
  {
    statement: "Extend Shape with Square.area and print the area of the side length on stdin.",
    difficulty: 4,
    concept: "inheritance",
    starter: "class Shape {}\nclass Square extends Shape {\n  constructor(side) {\n    super();\n    this.side = side;\n  }\n  area() {\n    return 0;\n  }\n}\nconst fs = require('fs');\nconst side = Number(fs.readFileSync(0, 'utf8').trim());\nconsole.log(new Square(side).area());\n",
    visible: { input: "6\n", expectedOutput: "36\n" },
    hidden: { input: "1\n", expectedOutput: "1\n" },
  },
  {
    statement: "Dog extends Animal. Print the sound for the name read from stdin as 'name: woof'.",
    difficulty: 3,
    concept: "inheritance",
    starter: "class Animal {\n  constructor(name) { this.name = name; }\n}\nclass Dog extends Animal {\n  speak() { return ''; }\n}\nconst fs = require('fs');\nconst name = fs.readFileSync(0, 'utf8').trim();\nconsole.log(new Dog(name).speak());\n",
    visible: { input: "Rex\n", expectedOutput: "Rex: woof\n" },
    hidden: { input: "Nia\n", expectedOutput: "Nia: woof\n" },
  },
  {
    statement: "A subclass DiscountedPrice overrides price. Print the discounted price for the base price on stdin, using 10 percent off.",
    difficulty: 4,
    concept: "inheritance",
    starter: "class Price {\n  constructor(amount) { this.amount = amount; }\n  value() { return this.amount; }\n}\nclass DiscountedPrice extends Price {\n  value() { return this.amount; }\n}\nconst fs = require('fs');\nconst amount = Number(fs.readFileSync(0, 'utf8').trim());\nconsole.log(new DiscountedPrice(amount).value());\n",
    visible: { input: "100\n", expectedOutput: "90\n" },
    hidden: { input: "50\n", expectedOutput: "45\n" },
  },
  {
    statement: "Greeter receives a formatter. Print the formatted hello for the name on stdin.",
    difficulty: 4,
    concept: "di",
    starter: "class PlainFormatter {\n  format(name) { return ''; }\n}\nclass Greeter {\n  constructor(formatter) { this.formatter = formatter; }\n  hello(name) { return this.formatter.format(name); }\n}\nconst fs = require('fs');\nconst name = fs.readFileSync(0, 'utf8').trim();\nconsole.log(new Greeter(new PlainFormatter()).hello(name));\n",
    visible: { input: "Ada\n", expectedOutput: "Hello, Ada\n" },
    hidden: { input: "Ben\n", expectedOutput: "Hello, Ben\n" },
  },
  {
    statement: "A reporter depends on a clock. Print 'tick ' plus the number on stdin.",
    difficulty: 3,
    concept: "di",
    starter: "class Clock {\n  constructor(value) { this.value = value; }\n  now() { return 0; }\n}\nclass Reporter {\n  constructor(clock) { this.clock = clock; }\n  line() { return 'tick ' + this.clock.now(); }\n}\nconst fs = require('fs');\nconst value = Number(fs.readFileSync(0, 'utf8').trim());\nconsole.log(new Reporter(new Clock(value)).line());\n",
    visible: { input: "3\n", expectedOutput: "tick 3\n" },
    hidden: { input: "12\n", expectedOutput: "tick 12\n" },
  },
  {
    statement: "Mailer depends on a transport. Print 'sent:' plus the body read from stdin.",
    difficulty: 5,
    concept: "di",
    starter: "class Transport {\n  send(body) { return ''; }\n}\nclass Mailer {\n  constructor(transport) { this.transport = transport; }\n  deliver(body) { return this.transport.send(body); }\n}\nconst fs = require('fs');\nconst body = fs.readFileSync(0, 'utf8').trim();\nconsole.log(new Mailer(new Transport()).deliver(body));\n",
    visible: { input: "ready\n", expectedOutput: "sent:ready\n" },
    hidden: { input: "done\n", expectedOutput: "sent:done\n" },
  },
];
