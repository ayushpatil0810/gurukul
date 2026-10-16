import { Suspense } from "react";
import { type Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { UserButton } from "@/components/auth/user-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Protected Area | Hackathon Starter",
  description: "Server-side protected page demonstrating Better Auth session validation",
};

async function ProtectedContent() {
  // Server-side session guard: redirects to /login if unauthenticated
  const { session, user } = await requireAuth("/login");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Protected Area
            </h1>
            <Badge variant="success">Authenticated</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            This route is protected on the server using Better Auth and Next.js App Router.
          </p>
        </div>
        <UserButton />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Profile</CardTitle>
            <CardDescription>Server-rendered session identity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                Full Name
              </span>
              <span className="font-medium text-foreground">{user.name}</span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                Email Address
              </span>
              <span className="font-mono text-xs text-foreground">{user.email}</span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                User ID
              </span>
              <span className="font-mono text-xs text-muted-foreground break-all">
                {user.id}
              </span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                Email Verified
              </span>
              <span className="text-foreground">
                {user.emailVerified ? "Verified ✅" : "Unverified (Default)"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Session Metadata Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session Metadata</CardTitle>
            <CardDescription>Cryptographic session token information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                Session ID
              </span>
              <span className="font-mono text-xs text-muted-foreground break-all">
                {session.id}
              </span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                Expires At
              </span>
              <span className="font-mono text-xs text-foreground">
                {new Date(session.expiresAt).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                Created At
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(session.createdAt).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Developer Integration Note */}
      <Card className="mt-8 border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span>💡</span> Developer Integration Guide
          </CardTitle>
          <CardDescription>
            How to protect your future hackathon pages and server actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            To protect any Server Component, simply call{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              const &#123; user &#125; = await requireAuth();
            </code>{" "}
            at the top of your page. If the user is unauthenticated, they will automatically be redirected to{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">/login</code>.
          </p>
          <div className="flex gap-3 pt-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to Home</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/api/health" target="_blank">
                Check Health API
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProtectedPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 animate-pulse">
      <div className="mb-8 h-10 w-48 bg-muted rounded" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-64 bg-card border border-border rounded-xl" />
        <div className="h-64 bg-card border border-border rounded-xl" />
      </div>
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <Suspense fallback={<ProtectedPageSkeleton />}>
      <ProtectedContent />
    </Suspense>
  );
}
