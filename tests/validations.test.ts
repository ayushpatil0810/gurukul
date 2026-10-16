import { describe, it, expect } from "vitest";
import { signInSchema, signUpSchema } from "@/lib/validations/auth";
import { validateInput, formatZodErrors } from "@/lib/validations/validate";

describe("Validation Strategy (Zod)", () => {
  describe("signInSchema", () => {
    it("accepts valid email and password", () => {
      const result = validateInput(signInSchema, {
        email: "founder@hackathon.dev",
        password: "securepassword123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("founder@hackathon.dev");
      }
    });

    it("rejects malformed email", () => {
      const result = validateInput(signInSchema, {
        email: "not-an-email",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.email).toBeDefined();
        expect(result.error.email[0]).toMatch(/valid email/i);
      }
    });

    it("rejects empty password", () => {
      const result = validateInput(signInSchema, {
        email: "founder@hackathon.dev",
        password: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.password).toBeDefined();
      }
    });
  });

  describe("signUpSchema", () => {
    it("accepts valid sign up data", () => {
      const result = validateInput(signUpSchema, {
        name: "Alan Turing",
        email: "turing@hackathon.dev",
        password: "mypassword123",
      });

      expect(result.success).toBe(true);
    });

    it("rejects passwords shorter than 8 characters", () => {
      const result = validateInput(signUpSchema, {
        name: "Alan Turing",
        email: "turing@hackathon.dev",
        password: "short",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.password).toBeDefined();
        expect(result.error.password[0]).toMatch(/at least 8 characters/i);
      }
    });

    it("rejects names shorter than 2 characters", () => {
      const result = validateInput(signUpSchema, {
        name: "A",
        email: "turing@hackathon.dev",
        password: "password123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBeDefined();
      }
    });
  });

  describe("formatZodErrors helper", () => {
    it("formats raw Zod issues into field-indexed error record", () => {
      const parsed = signInSchema.safeParse({ email: "invalid", password: "" });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const formatted = formatZodErrors(parsed.error);
        expect(formatted.email).toBeDefined();
        expect(formatted.password).toBeDefined();
      }
    });
  });
});
