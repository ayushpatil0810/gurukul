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
      <header>
        <p className="text-sm">
          <Link className="underline-offset-4 hover:underline" href="/studio">
            Lesson studio
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance">New lesson</h1>
        <p className="mt-2 max-w-[65ch] text-sm text-pretty">
          The first step writes an outline you can edit. Content is generated only after you approve that outline.
        </p>
      </header>
      {lessonModelConfigured() ? null : (
        <p className="max-w-[65ch] text-sm">Set OPENAI_API_KEY before generating an outline. Nothing is saved if the model is not configured.</p>
      )}
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
