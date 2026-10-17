import { Suspense } from "react";
import Link from "next/link";
import { getServerSession } from "@/lib/auth-session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

async function SessionBanner() {
  const session = await getServerSession();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        {session?.user ? (
          <>
            Signed in as <span className="font-medium">{session.user.name}</span>
            {session.user.role ? ` · ${session.user.role}` : ""}
          </>
        ) : (
          "Sign in with a seeded student, trainer, or admin account."
        )}
      </p>
      {session?.user ? <Badge variant="success">Session active</Badge> : <Badge variant="outline">Guest</Badge>}
    </div>
  );
}

async function HomeActions() {
  const session = await getServerSession();
  if (!session?.user) {
    return (
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Button asChild>
        <Link href="/dashboard">Open dashboard</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/curriculum">Open concept map</Link>
      </Button>
      {session.user.role === "trainer" || session.user.role === "admin" ? (
        <Button asChild variant="outline">
          <Link href="/studio">Lesson studio</Link>
        </Button>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 space-y-10">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span>TechSummitTrainers · Production Learning Platform</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl font-bold tracking-tight text-foreground text-balance">
          Adaptive Learning and Assessment Portal
        </h1>
        <p className="max-w-2xl text-muted-foreground text-base leading-relaxed">
          The syllabus is a concept map. Trainers keep the question bank, including hidden tests that stay on the server.
          Students see only their own records.
        </p>
        <Suspense fallback={<div className="mt-6 h-10 w-40 animate-pulse rounded-md bg-muted" />}>
          <HomeActions />
        </Suspense>
      </div>

      <div className="rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
        <Suspense fallback={<div className="h-6 w-64 animate-pulse rounded bg-muted" />}>
          <SessionBanner />
        </Suspense>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="rounded-xl border border-border/80 bg-card/50 p-5 shadow-xs space-y-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-foreground">Bayesian Knowledge Tracing</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Personalized mastery modeling continuously updates with authoritative assessment evidence, never from passive reading.
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/50 p-5 shadow-xs space-y-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-foreground">Interactive AI Classroom</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Multi-scene interactive lessons featuring live architecture diagrams, Docker runtimes, CI/CD gates, and Kubernetes clusters.
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/50 p-5 shadow-xs space-y-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-foreground">Contextual AI Mentor</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pedagogically grounded coaching that provides scene-aware hints, log analysis, and conceptual checks with zero answer leakage.
          </p>
        </div>
      </div>
    </div>
  );
}
