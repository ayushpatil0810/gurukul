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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        TechSummitTrainers
      </p>
      <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight">
        Adaptive Learning and Assessment Portal
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        The syllabus is a concept map. Trainers keep the question bank, including hidden tests that stay on the server.
        Students see only their own records.
      </p>
      <Suspense fallback={<div className="mt-6 h-10 w-40 animate-pulse rounded-md bg-muted" />}>
        <HomeActions />
      </Suspense>
      <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4">
        <Suspense fallback={<div className="h-6 w-64 animate-pulse rounded bg-muted" />}>
          <SessionBanner />
        </Suspense>
      </div>
    </div>
  );
}
