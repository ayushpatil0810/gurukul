import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { listLessons } from "@/lib/services/lessons";
import { lessonModelConfigured } from "@/lib/engine/lesson-provider";

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
  if (denied) return <p className="text-sm">{denied}</p>;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Lesson studio</h1>
        <p className="mt-2 max-w-[65ch] text-sm text-pretty">
          Write an outline, then generate the lesson. Drafts stay private. Publishing does not change mastery or a coding score.
        </p>
      </header>
      {lessonModelConfigured() ? null : (
        <p className="max-w-[65ch] text-sm">
          Outline generation needs OPENAI_API_KEY. Saved lessons on this page can still be opened. The rest of the portal works without it.
        </p>
      )}
      <p>
        <Link className="text-sm underline-offset-4 hover:underline" href="/studio/new">
          New lesson
        </Link>
      </p>
      {rows.length === 0 ? (
        <p className="text-sm">No lessons yet.</p>
      ) : (
        <ul className="max-w-[65ch] divide-y divide-border text-sm">
          {rows.map((lesson) => (
            <li key={lesson.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
              <Link className="underline-offset-4 hover:underline" href={`/studio/${lesson.id}`}>
                {lesson.title}
              </Link>
              <span>
                {lesson.status === "published" ? "Published" : "Draft"} · {lesson.conceptName} · {lesson.updatedAt}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StudioPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm">Loading lessons…</p>}>
        <StudioList />
      </Suspense>
    </div>
  );
}
