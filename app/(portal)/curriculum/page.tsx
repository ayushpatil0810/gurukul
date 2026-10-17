import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-session";
import { getActor } from "@/lib/auth/actor";
import { listConceptMap } from "@/lib/services/concepts";
import { ConceptMapView } from "@/components/curriculum/concept-map";

export const metadata: Metadata = {
  title: "Concept map",
};

async function ConceptMapScreen() {
  await requireAuth();
  const actor = await getActor();
  if (!actor?.instituteId) {
    return (
      <p className="text-sm text-muted-foreground">
        Your account is not assigned to an institute yet.
      </p>
    );
  }
  const map = await listConceptMap(actor);
  return <ConceptMapView map={map} canEdit={actor.role === "trainer" || actor.role === "admin"} />;
}

export default function CurriculumPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-1 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Concept Prerequisite Graph</h1>
          <span className="rounded-md border border-border/80 bg-background/50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
            DAG Topological Sort
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Prerequisites flow from dependencies toward the goal concept. Cyclic dependencies are strictly rejected by Kahn&apos;s algorithm before persisting.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading concept map…</p>}>
        <ConceptMapScreen />
      </Suspense>
    </div>
  );
}
