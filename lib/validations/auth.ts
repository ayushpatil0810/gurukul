import { z } from "zod";
import { emailSchema, nameSchema, passwordSchema } from "./common";

/**
 * Sign In Request Schema & Type
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Sign Up Request Schema & Type
 */
export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
