import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { listLessons } from "@/lib/services/lessons";
import { lessonModelConfigured } from "@/lib/engine/lesson-provider";

import { StudioHub } from "@/components/studio/studio-hub";

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
    <StudioHub
      lessons={rows}
      modelConfigured={lessonModelConfigured()}
    />
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
