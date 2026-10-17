import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { portalUserFields } from "@/lib/auth-fields";

/**
 * Client-side Better Auth SDK.
 * Role and institute are displayed from the session, then enforced again on the server.
 */
const authClient = createAuthClient({
  plugins: [inferAdditionalFields({ user: portalUserFields })],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
