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
    <div className="px-4 md:px-6 py-6 pb-16 space-y-6">
      <header className="border-b border-border/60 pb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground mb-2">
          <span className="size-1.5 rounded-full bg-primary" />
          Prerequisite DAG & Structure
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Curriculum Concept Map</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prerequisite relationships run directed from left to right. Cycle prevention is verified by the backend engine.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading concept map…</p>}>
        <ConceptMapScreen />
      </Suspense>
    </div>
  );
}
