import type { SubmissionLanguage } from "@/sandbox/types";

/**
 * Maps known question statements to automated test runner drivers for JavaScript.
 * The driver reads from stdin, parses tokens into appropriate argument types,
 * invokes the student's function or class, and writes the return value to stdout.
 */
const JS_DRIVERS: Record<string, string> = {
  // 1. Sum of Two Integers
  "Read two integers and print their sum.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const [_a, _b] = _raw.split(/\\s+/).map(Number);
  if (typeof sum === 'function') {
    const _res = sum(_a, _b);
    if (_res !== undefined) console.log(_res);
  }
}
`,

  // 2. Double Integer
  "Read one integer and print its double.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const _n = Number(_raw);
  if (typeof doubleInteger === 'function') {
    const _res = doubleInteger(_n);
    if (_res !== undefined) console.log(_res);
  }
}
`,

  // 3. Maximum of Three Numbers
  "Read three integers and print the largest.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const [_a, _b, _c] = _raw.split(/\\s+/).map(Number);
  if (typeof findLargest === 'function') {
    const _res = findLargest(_a, _b, _c);
    if (_res !== undefined) console.log(_res);
  }
}
`,

  // 4. Product of Two Integers
  "Write a function that returns the product of two integers read from stdin.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const [_a, _b] = _raw.split(/\\s+/).map(Number);
  if (typeof product === 'function') {
    const _res = product(_a, _b);
    if (_res !== undefined) console.log(_res);
  }
}
`,

  // 5. Factorial of N
  "Write a function that returns the factorial of n for n up to 10.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const _n = Number(_raw);
  if (typeof factorial === 'function') {
    const _res = factorial(_n);
    if (_res !== undefined) console.log(_res);
  }
}
`,

  // 6. Minimum of Three Numbers
  "Write a function that returns the minimum of three integers.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const [_a, _b, _c] = _raw.split(/\\s+/).map(Number);
  if (typeof minimum === 'function') {
    const _res = minimum(_a, _b, _c);
    if (_res !== undefined) console.log(_res);
  }
}
`,

  // 7. Rectangle Area
  "Implement Rectangle.area and print the area of the width and height read from stdin.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const [_w, _h] = _raw.split(/\\s+/).map(Number);
  if (typeof Rectangle === 'function') {
    const _obj = new Rectangle(_w, _h);
    if (typeof _obj.area === 'function') {
      const _res = _obj.area();
      if (_res !== undefined) console.log(_res);
    }
  }
}
`,

  // 8. Counter Increment
  "Implement Counter.increment so it prints the value after one increment, starting from the integer on stdin.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const _start = Number(_raw);
  if (typeof Counter === 'function') {
    const _obj = new Counter(_start);
    if (typeof _obj.increment === 'function') {
      const _res = _obj.increment();
      if (_res !== undefined) console.log(_res);
    }
  }
}
`,

  // 9. Square Area Inheritance
  "Extend Shape with Square.area and print the area of the side length on stdin.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const _side = Number(_raw);
  if (typeof Square === 'function') {
    const _obj = new Square(_side);
    if (typeof _obj.area === 'function') {
      const _res = _obj.area();
      if (_res !== undefined) console.log(_res);
    }
  }
}
`,

  // 10. Animal Dog Speak
  "Dog extends Animal. Print the sound for the name read from stdin as 'name: woof'.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  if (typeof Dog === 'function') {
    const _obj = new Dog(_raw);
    if (typeof _obj.speak === 'function') {
      const _res = _obj.speak();
      if (_res !== undefined) console.log(_res);
    }
  }
}
`,

  // 11. Discounted Price Override
  "A subclass DiscountedPrice overrides price. Print the discounted price for the base price on stdin, using 10 percent off.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const _amount = Number(_raw);
  if (typeof DiscountedPrice === 'function') {
    const _obj = new DiscountedPrice(_amount);
    if (typeof _obj.value === 'function') {
      const _res = _obj.value();
      if (_res !== undefined) console.log(_res);
    }
  }
}
`,

  // 12. Greeter Dependency Injection
  "Greeter receives a formatter. Print the formatted hello for the name on stdin.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  if (typeof Greeter === 'function') {
    const _fmt = typeof PlainFormatter === 'function' ? new PlainFormatter() : undefined;
    const _obj = new Greeter(_fmt);
    if (typeof _obj.hello === 'function') {
      const _res = _obj.hello(_raw);
      if (_res !== undefined) console.log(_res);
    }
  }
}
`,

  // 13. Clock Reporter Dependency Injection
  "A reporter depends on a clock. Print 'tick ' plus the number on stdin.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  const _val = Number(_raw);
  if (typeof Reporter === 'function') {
    const _clk = typeof Clock === 'function' ? new Clock(_val) : undefined;
    const _obj = new Reporter(_clk);
    if (typeof _obj.line === 'function') {
      const _res = _obj.line();
      if (_res !== undefined) console.log(_res);
    }
  }
}
`,

  // 14. Mailer Transport Dependency Injection
  "Mailer depends on a transport. Print 'sent:' plus the body read from stdin.": `
const fs = require('fs');
const _raw = fs.readFileSync(0, 'utf8').trim();
if (_raw.length > 0) {
  if (typeof Mailer === 'function') {
    const _trn = typeof Transport === 'function' ? new Transport() : undefined;
    const _obj = new Mailer(_trn);
    if (typeof _obj.deliver === 'function') {
      const _res = _obj.deliver(_raw);
      if (_res !== undefined) console.log(_res);
    }
  }
}
`,
};

/**
 * Prepares the executable code by augmenting the participant's function block
 * with a runtime test driver for standard I/O communication.
 *
 * If the participant's code already contains explicit I/O reading (e.g. readFileSync),
 * it executes unchanged for backwards compatibility.
 */
export function prepareExecutionCode(
  statement: string,
  language: SubmissionLanguage,
  userCode: string,
): string {
  // If the user already handled I/O or the language is not JS, keep it untouched
  if (language !== "javascript") {
    return userCode;
  }

  // If user code manually handles stdin reading, don't double-wrap
  if (
    userCode.includes("readFileSync") ||
    userCode.includes("process.stdin") ||
    userCode.includes("readline")
  ) {
    return userCode;
  }

  const trimmedStatement = statement.trim();
  const driver = JS_DRIVERS[trimmedStatement];

  if (driver) {
    return `${userCode}\n\n// --- Gurukul LeetCode Auto-Test Harness ---\n${driver}`;
  }

  // Generic fallback: check if any function is declared (e.g., solve or solution)
  return `${userCode}

// --- Gurukul Generic Driver ---
try {
  const fs = require('fs');
  const _raw = fs.readFileSync(0, 'utf8').trim();
  if (_raw.length > 0) {
    const _tokens = _raw.split(/\\s+/);
    const _numTokens = _tokens.map(t => (!isNaN(Number(t)) ? Number(t) : t));
    
    // Check if solve or solution exists
    if (typeof solve === 'function') {
      const _res = solve(..._numTokens);
      if (_res !== undefined) console.log(_res);
    } else if (typeof solution === 'function') {
      const _res = solution(..._numTokens);
      if (_res !== undefined) console.log(_res);
    }
  }
} catch (_e) {
  // Let errors propagate
  throw _e;
}
`;
}
