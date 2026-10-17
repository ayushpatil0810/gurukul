import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { listConceptMap } from "@/lib/services/concepts";
import { NewLessonForm } from "@/components/studio/new-lesson-form";
import { lessonModelConfigured } from "@/lib/engine/lesson-provider";

export const metadata: Metadata = { title: "New lesson" };

async function NewLesson() {
  await requireAuth();
  const actor = await getActor();
  if (!actor) return null;
  if (actor.role === "student") return <p className="text-sm">You do not have access to this action</p>;
  let denied: string | null = null;
  let map: Awaited<ReturnType<typeof listConceptMap>> | null = null;
  try {
    map = await listConceptMap(actor);
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 403 || error.statusCode === 404)) denied = error.message;
    else throw error;
  }
  if (denied) return <p className="text-sm">{denied}</p>;
  if (!map) return null;
  return (
    <div className="space-y-6">
      <header className="border-b border-border/60 pb-5">
        <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link href="/studio" className="hover:text-foreground transition-colors">
            Lesson Studio
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">New Lesson</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Author New Interactive Lesson
        </h1>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          Configure curriculum alignment, learning objectives, and calibration. The first step synthesizes a pedagogical outline you can review and refine.
        </p>
      </header>

      {!lessonModelConfigured() ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
          <span className="font-semibold">Notice:</span> OPENAI_API_KEY is not configured in this environment. Outlines and scenes will run in offline draft mode.
        </div>
      ) : null}

      <NewLessonForm modules={map.modules} concepts={map.concepts} />
    </div>
  );
}

export default function NewLessonPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm">Loading the concept map…</p>}>
        <NewLesson />
      </Suspense>
    </div>
  );
}
