import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { readLessonForAuthor } from "@/lib/services/lessons";
import { LessonEditor } from "@/components/studio/lesson-editor";

export const metadata: Metadata = { title: "Edit lesson" };

async function EditorScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const actor = await getActor();
  if (!actor) return null;
  let denied: string | null = null;
  let lesson: Awaited<ReturnType<typeof readLessonForAuthor>> | null = null;
  try {
    lesson = await readLessonForAuthor(actor, id);
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 403 || error.statusCode === 404)) denied = error.message;
    else throw error;
  }
  if (denied) return <p className="text-sm">{denied}</p>;
  if (!lesson) return null;
  return <LessonEditor lesson={lesson} />;
}

export default function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm">Loading the lesson…</p>}>
        <EditorScreen params={params} />
      </Suspense>
    </div>
  );
}
