import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { listLessons } from "@/lib/services/lessons";
import { lessonModelConfigured } from "@/lib/engine/lesson-provider";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Lesson studio" };

async function StudioList() {
  await requireAuth();
  const actor = await getActor();
  if (!actor) return null;
  let denied: string | null = null;
  let rows: Awaited<ReturnType<typeof listLessons>> = [];
  try {
    rows = await listLessons(actor);
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 403 || error.statusCode === 404)) denied = error.message;
    else throw error;
  }
  if (denied) return <p className="text-sm text-destructive">{denied}</p>;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Lesson Studio</h1>
            <span className="rounded-md border border-border/80 bg-background/50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Instructional Authoring
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Author curriculum outlines, generate interactive multi-scene classrooms, and publish lessons to the student Learn Module.
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5 text-xs font-semibold shadow-xs">
          <Link href="/studio/new">
            <span>+ Create New Lesson</span>
          </Link>
        </Button>
      </div>

      {lessonModelConfigured() ? null : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200">
          AI Outline generation requires OPENAI_API_KEY. Saved and seeded lessons remain fully viewable.
        </div>
      )}

      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Course Lessons</h2>
          <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            {rows.length} total
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No lessons authored yet. Click &apos;Create New Lesson&apos; to begin.</p>
        ) : (
          <ul className="divide-y divide-border/60 text-xs">
            {rows.map((lesson) => (
              <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-muted/10 transition-colors">
                <div className="space-y-0.5">
                  <Link className="font-semibold text-sm text-foreground hover:text-primary transition-colors hover:underline underline-offset-4" href={`/studio/${lesson.id}`}>
                    {lesson.title}
                  </Link>
                  <p className="text-muted-foreground font-mono text-[11px]">
                    Concept: <span className="font-medium text-foreground">{lesson.conceptName}</span> · Updated {lesson.updatedAt}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                      lesson.status === "published"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-border/60 bg-muted text-muted-foreground"
                    }`}
                  >
                    {lesson.status === "published" ? "Published" : "Draft"}
                  </span>
                  <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                    <Link href={`/studio/${lesson.id}`}>Edit Outline</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function StudioPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading lesson studio…</p>}>
        <StudioList />
      </Suspense>
    </div>
  );
}
