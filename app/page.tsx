import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  Cpu,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Terminal,
  Lock,
  Layers,
} from "lucide-react";
import { getServerSession } from "@/lib/auth-session";
import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

async function HeroActions() {
  const session = await getServerSession();

  if (session?.user) {
    return (
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button asChild size="lg" className="h-11 px-6 text-sm font-semibold shadow-md">
          <Link href="/dashboard" className="gap-2">
            <span>Enter Portal</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 px-5 text-sm font-medium">
          <Link href="/curriculum">View Concept Map</Link>
        </Button>
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground border rounded-lg bg-muted/40">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Signed in as <strong className="text-foreground">{session.user.name}</strong> ({session.user.role})</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <Button asChild size="lg" className="h-11 px-6 text-sm font-semibold shadow-md">
        <Link href="/login" className="gap-2">
          <span>Sign In to Portal</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" size="lg" className="h-11 px-5 text-sm font-medium">
        <Link href="/login?mode=signup">Create Account</Link>
      </Button>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LandingHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border/50 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Headline & Value Prop */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-muted/50 px-3 py-1 text-xs font-mono font-medium text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Engineering Mastery &amp; Telemetry Platform</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground text-balance">
                  Mastery measured by code, not clicks.
                </h1>

                <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed text-pretty">
                  An engineering-grade learning portal powered by concept prerequisite graphs,
                  isolated Linux sandbox validation, and Bayesian Knowledge Tracing.
                </p>

                <Suspense
                  fallback={<div className="h-11 w-48 animate-pulse rounded-md bg-muted" />}
                >
                  <HeroActions />
                </Suspense>

                {/* Key Spec Badges */}
                <div className="grid grid-cols-3 gap-3 pt-6 border-t border-border/60">
                  <div>
                    <p className="text-xs text-muted-foreground">Evaluation</p>
                    <p className="text-sm font-semibold text-foreground">Isolated Sandboxes</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mastery Engine</p>
                    <p className="text-sm font-semibold text-foreground">Bayesian BKT</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Integrity</p>
                    <p className="text-sm font-semibold text-foreground">Keystroke Replay</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Architectural UI Preview */}
              <div className="lg:col-span-5">
                <div className="rounded-xl border border-border bg-card p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-primary" />
                      <span className="text-xs font-mono font-semibold">sandbox-runner.ts</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      PASSED (3/3 hidden)
                    </Badge>
                  </div>

                  {/* Terminal / Code Visual */}
                  <div className="rounded-lg bg-muted/60 p-3.5 font-mono text-xs space-y-2 border border-border/40">
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>STAGE: Docker Container Build</span>
                      <span>TIME: 142ms</span>
                    </div>
                    <p className="text-foreground">
                      <span className="text-emerald-600 dark:text-emerald-400">$</span> docker build -t learner-image .
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      &gt; [1/3] FROM node:20-alpine AS builder<br />
                      &gt; [2/3] RUN npm ci --omit=dev<br />
                      &gt; [3/3] EXPOSE 3000
                    </p>
                    <div className="border-t border-border/40 pt-2 text-[11px] text-muted-foreground flex justify-between">
                      <span>Prereq: Linux Fundamentals</span>
                      <span className="text-primary font-semibold">Mastery: 0.88 (+0.14)</span>
                    </div>
                  </div>

                  {/* Knowledge Graph Snapshot */}
                  <div className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Curriculum Dependency Graph</span>
                      <span className="text-[10px] font-mono text-muted-foreground">DAG Enforced</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">Git &amp; Shell</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="rounded bg-primary/10 text-primary font-semibold px-2 py-0.5 font-mono text-[11px]">Dockerfiles</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">Kubernetes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Architecture Matrix */}
        <section id="architecture" className="py-16 sm:py-24 border-b border-border/50 bg-muted/10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-12">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Built for technical rigor, not rote memorization.
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                LearnLoop replaces subjective grading and passive reading quizzes with an authoritative,
                evidence-based loop designed for software engineers and trainers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Feature 1 */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GitBranch className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Prerequisite DAG</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Curriculum concepts are mathematically modeled as a directed acyclic graph.
                  Cycles are strictly rejected, ensuring students never encounter concepts without prerequisite mastery.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Bayesian Knowledge Tracing</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Calculates mastery probability from verifiable execution evidence.
                  Slip and guess parameters ensure lucky guesses do not falsely trigger advancement.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Hidden Server Test Suites</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Learners test their code against public samples on demand.
                  Official mastery assessments execute against hidden server tests that never leak to the client.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Keystroke Replay &amp; Viva</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Monotonic event buffers log fine-grained editing cadence.
                  Anomalous paste bursts flag submissions for viva oral defense and trainer review.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Methodology & Dual Verification */}
        <section id="methodology" className="py-16 sm:py-24 border-b border-border/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-0.5 text-xs font-medium text-muted-foreground">
                  Dual-Stage Assessment Loop
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance">
                  Immediate feedback during practice. Authoritative judgment on submit.
                </h2>
                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <p>
                      <strong className="text-foreground">Practice Mode:</strong> Rapid iteration with sample inputs,
                      live compiler errors, and interactive diagrams in a sandboxed runtime.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <p>
                      <strong className="text-foreground">Submit Mode:</strong> Asynchronous BullMQ worker queue
                      runs complete hidden unit and integration test assertions in an isolated container.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <p>
                      <strong className="text-foreground">Mastery Routing:</strong> The next concept or remediation
                      is mathematically scheduled based on individual concept mastery state.
                    </p>
                  </div>
                </div>
              </div>

              <div id="verification" className="rounded-xl border border-border bg-card/60 p-6 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Role-Segregated Workspaces</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-border/80 bg-background/60 p-3.5 space-y-1.5">
                    <p className="font-semibold text-foreground">Learner Portal</p>
                    <p className="text-muted-foreground leading-relaxed">
                      Personalized mastery progress, concept prerequisite visualizations, and active coding assessments.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-background/60 p-3.5 space-y-1.5">
                    <p className="font-semibold text-foreground">Trainer Console</p>
                    <p className="text-muted-foreground leading-relaxed">
                      Batch cohort analytics, curriculum authoring, hidden test bank management, and viva integrity reviews.
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <Button asChild className="w-full">
                    <Link href="/login">Access Portal Workspace</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
