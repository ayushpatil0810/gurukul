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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Concept map</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Prerequisites run from left to right. A cycle is rejected before it is stored.
      </p>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading concept map…</p>}>
        <ConceptMapScreen />
      </Suspense>
    </div>
  );
}
