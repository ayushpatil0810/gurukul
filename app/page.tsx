import { Suspense } from "react";
import Link from "next/link";
import { getServerSession } from "@/lib/auth-session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

async function SessionBanner() {
  const session = await getServerSession();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Current Session Status
        </span>
        <p className="text-base font-medium text-foreground">
          {session?.user ? (
            <>
              Authenticated as{" "}
              <span className="font-semibold text-primary">{session.user.name}</span> (
              {session.user.email})
            </>
          ) : (
            "Unauthenticated • Using guest mode"
          )}
        </p>
      </div>
      <div>
        {session?.user ? (
          <Badge variant="success">Session Active</Badge>
        ) : (
          <Badge variant="outline">Guest Session</Badge>
        )}
      </div>
    </div>
  );
}

function SessionBannerSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-28 bg-muted rounded" />
        <div className="h-5 w-64 bg-muted rounded" />
      </div>
      <div className="h-6 w-24 bg-muted rounded" />
    </div>
  );
}

async function HeroActions() {
  const session = await getServerSession();

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      {session?.user ? (
        <Button asChild size="lg" className="h-11 px-6">
          <Link href="/protected">Go to Protected Area &rarr;</Link>
        </Button>
      ) : (
        <>
          <Button asChild size="lg" className="h-11 px-6">
            <Link href="/login?mode=signup">Sign Up & Test Auth</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-6">
            <Link href="/login">Sign In</Link>
          </Button>
        </>
      )}

      <Button asChild variant="secondary" size="lg" className="h-11 px-6">
        <Link href="/api/health" target="_blank">
          Check Health API
        </Link>
      </Button>
    </div>
  );
}

export default function HomePage() {
  const stackFeatures = [
    {
      title: "Authentication",
      tech: "Better Auth 1.7",
      desc: "Type-safe email & password authentication, session management, and server guards.",
      status: "Integrated",
    },
    {
      title: "Database Layer",
      tech: "Neon PostgreSQL + Drizzle ORM",
      desc: "Serverless HTTP driver client with Drizzle Kit schema migrations generated.",
      status: "Configured",
    },
    {
      title: "Runtime Validation",
      tech: "Zod v4",
      desc: "Strict environment variable checking and request input validation with error formatting.",
      status: "Enforced",
    },
    {
      title: "Developer Utilities",
      tech: "AppError, Result, Logger",
      desc: "Standardized error handling, typed Result monad, and structured sensitive-data redactor.",
      status: "Ready",
    },
    {
      title: "Testing Framework",
      tech: "Vitest 5",
      desc: "Fast unit and integration test runner configured with path aliases.",
      status: "Passing",
    },
    {
      title: "Design System",
      tech: "Tailwind v4 + Radix UI",
      desc: "Modern OKLCH color palettes, dark mode tokens, and accessible interactive primitives.",
      status: "Styled",
    },
  ];

  const projectLayers = [
    { dir: "app/", desc: "Next.js routes, server components, layouts, and API route handlers" },
    { dir: "components/", desc: "Reusable UI primitives (buttons, cards, badges) and feature-agnostic elements" },
    { dir: "db/", desc: "Neon PostgreSQL client, Drizzle schema registry, and connection helpers" },
    { dir: "features/", desc: "Domain-specific hackathon modules (add your ideas here once decided)" },
    { dir: "lib/", desc: "Better Auth config, session helpers, Zod validation, logger, and AppError" },
    { dir: "types/", desc: "Shared high-value TypeScript interfaces (ApiResponse, ActionResponse)" },
    { dir: "tests/", desc: "Unit and integration tests for utilities, validations, and environment" },
    { dir: "drizzle/", desc: "Generated SQL migrations ready for deployment" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Hero Section */}
      <section className="mb-16 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-xs">
          <span>🚀 Hackathon Starter Kit</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Ready to Build</span>
        </div>

        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
          Production-Ready, <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-zinc-900 via-zinc-600 to-zinc-400 bg-clip-text text-transparent dark:from-white dark:via-zinc-200 dark:to-zinc-500">
            Feature-Agnostic Foundation
          </span>
        </h1>

        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          A secure, modular starter with Better Auth, Neon PostgreSQL, Drizzle ORM, Zod, and Vitest.
          Jump straight into building your product idea without spending hours setting up boilerplate.
        </p>

        <Suspense
          fallback={
            <div className="mt-8 flex gap-3 animate-pulse">
              <div className="h-11 w-32 bg-muted rounded-md" />
              <div className="h-11 w-32 bg-muted rounded-md" />
            </div>
          }
        >
          <HeroActions />
        </Suspense>
      </section>

      {/* Auth Status Notification */}
      <div className="mb-12 rounded-xl border border-border/60 bg-muted/40 p-4 sm:p-6 backdrop-blur-xs">
        <Suspense fallback={<SessionBannerSkeleton />}>
          <SessionBanner />
        </Suspense>
      </div>

      {/* Core Foundation Capabilities */}
      <section className="mb-16">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Core Foundation Stack
          </h2>
          <p className="text-sm text-muted-foreground">
            Strictly typed, decoupled layers ready for any business model
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stackFeatures.map((feat) => (
            <Card key={feat.title} className="transition-all hover:border-foreground/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {feat.tech}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {feat.status}
                  </Badge>
                </div>
                <CardTitle className="text-base font-semibold pt-2">
                  {feat.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs leading-relaxed">
                  {feat.desc}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Clean Directory Structure */}
      <section className="mb-16">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Architecture & Folder Conventions
          </h2>
          <p className="text-sm text-muted-foreground">
            Clearly separated responsibilities for smooth hackathon team collaboration
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {projectLayers.map((layer) => (
            <div
              key={layer.dir}
              className="flex items-start gap-3 rounded-lg border border-border/70 bg-card p-3.5 shadow-xs"
            >
              <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-primary shrink-0">
                {layer.dir}
              </code>
              <p className="text-xs text-muted-foreground leading-snug">
                {layer.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Start Next Steps */}
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
        <h3 className="text-xl font-bold tracking-tight text-foreground">
          Ready to implement your idea?
        </h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          1. Configure your Neon PostgreSQL database in <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.env</code>.<br />
          2. Add your database models in <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">db/schema/</code> and run <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">bun run db:generate</code>.<br />
          3. Colocate domain features inside <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">features/&lt;your-feature&gt;/</code>.<br />
          4. Run <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">bun test</code> or <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">npm test</code> to ensure all checks pass.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild size="sm">
            <Link href="/login">Test Auth Now</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/protected">Visit Protected Route</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
