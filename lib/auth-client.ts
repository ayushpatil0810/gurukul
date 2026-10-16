import { createAuthClient } from "better-auth/react";

/**
 * Client-side Better Auth SDK
 *
 * Provides reactive React hooks (`useSession`) and authentication methods
 * (`signIn`, `signUp`, `signOut`, `getSession`) for client components.
 */
export const authClient = createAuthClient();

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
