import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session, type User } from "./auth";

/**
 * Server-side Authentication & Session Helpers
 *
 * For use in React Server Components, Server Actions, and Route Handlers.
 */

/**
 * Retrieves the current Better Auth session from incoming request headers.
 * Safe to call in any Server Component or Server Action.
 */
export async function getServerSession(): Promise<Session | null> {
  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });
    return session;
  } catch {
    return null;
  }
}

/**
 * Convenience helper to get the currently authenticated user.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getServerSession();
  return session?.user ?? null;
}

/**
 * Guard helper for protected Server Components and Server Actions.
 * If unauthenticated, automatically redirects to the specified route (default: /login).
 */
export async function requireAuth(
  redirectTo = "/login"
): Promise<{ session: Session["session"]; user: Session["user"] }> {
  const session = await getServerSession();

  if (!session || !session.user || !session.session) {
    redirect(redirectTo);
  }

  return {
    session: session.session,
    user: session.user,
  };
}
