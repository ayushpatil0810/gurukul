import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { readLessonForStudent } from "@/lib/services/lessons";
import { LessonView } from "@/components/lessons/lesson-view";

export const metadata: Metadata = { title: "Lesson" };

async function LessonScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sessionId?: string }>;
}) {
  const { id } = await params;
  const { sessionId } = (await searchParams) ?? {};
  await requireAuth();
  const actor = await getActor();
  if (!actor) return null;
  let denied: string | null = null;
  let lesson: Awaited<ReturnType<typeof readLessonForStudent>> | null = null;
  try {
    lesson = await readLessonForStudent(actor, id);
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 403 || error.statusCode === 404)) denied = error.message;
    else throw error;
  }
  if (denied) return <p className="text-sm">{denied}</p>;
  if (!lesson) return null;
  return (
    <article className="space-y-6">
      <p className="text-sm">
        <Link className="underline-offset-4 hover:underline" href="/dashboard">
          Dashboard
        </Link>
      </p>
      <header>
        <p className="text-sm">{lesson.conceptName}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance">{lesson.title}</h1>
        <p className="mt-2 max-w-[65ch] text-sm text-pretty">
          This is a published lesson. Reading it does not change your mastery score. Knowledge checks here are not graded coding assessments.
        </p>
      </header>
      <LessonView
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        conceptName={lesson.conceptName}
        scenes={lesson.scenes}
        showAnswers={false}
        codeLanguage={lesson.codeLanguage}
        sessionId={sessionId}
      />
    </article>
  );
}

export default function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sessionId?: string }>;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm">Loading the lesson…</p>}>
        <LessonScreen params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

