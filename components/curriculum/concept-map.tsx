"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { layoutConceptMap } from "@/lib/engine/concept-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ConceptMapData = {
  concepts: { id: string; name: string; description: string }[];
  prerequisites: { conceptId: string; requiresId: string }[];
  modules: {
    id: string;
    name: string;
    goalConceptId: string;
    masteryThreshold: number;
    conceptIds: string[];
  }[];
};

async function postJson(url: string, body: unknown): Promise<string | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    success: boolean;
    error?: { message?: string };
  };
  if (!response.ok || !payload.success) {
    return payload.error?.message ?? "The request failed";
  }
  return null;
}

export function ConceptMapView({
  map,
  canEdit,
}: {
  map: ConceptMapData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [conceptId, setConceptId] = useState(map.concepts[0]?.id ?? "");
  const [requiresId, setRequiresId] = useState(map.concepts[1]?.id ?? map.concepts[0]?.id ?? "");
  const [pending, setPending] = useState(false);

  const nodes = useMemo<Node[]>(() => {
    return layoutConceptMap(map.concepts, map.prerequisites).map((concept) => ({
      id: concept.id,
      position: { x: concept.x, y: concept.y },
      data: { label: concept.name },
      style: {
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 8,
        background: "var(--card)",
        color: "var(--card-foreground)",
        width: 180,
        fontSize: 13,
      },
    }));
  }, [map.concepts, map.prerequisites]);

  const edges = useMemo<Edge[]>(
    () =>
      map.prerequisites.map((edge) => ({
        id: `${edge.requiresId}-${edge.conceptId}`,
        source: edge.requiresId,
        target: edge.conceptId,
        animated: false,
      })),
    [map.prerequisites],
  );

  async function createConcept(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const message = await postJson("/api/concepts", { name, description });
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    setName("");
    setDescription("");
    router.refresh();
  }

  async function createEdge(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const message = await postJson(`/api/concepts/${conceptId}/prerequisites`, { requiresId });
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="h-[580px] overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
        {map.concepts.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No concepts defined in this institute yet.</p>
        ) : (
          <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}>
            <Background />
            <Controls />
          </ReactFlow>
        )}
      </div>

      <div className="space-y-6">
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-foreground">Curriculum Modules</h2>
          {map.modules.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No modules published yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs">
              {map.modules.map((module) => {
                const goal = map.concepts.find((concept) => concept.id === module.goalConceptId);
                return (
                  <li key={module.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="font-semibold text-foreground">{module.name}</p>
                    <p className="text-muted-foreground mt-0.5">
                      Goal: <span className="font-medium text-foreground">{goal?.name ?? "Unknown"}</span> · Threshold {module.masteryThreshold.toFixed(2)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canEdit ? (
          <>
            <form onSubmit={createConcept} className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Add Concept</h2>
              <div className="space-y-1.5">
                <Label htmlFor="concept-name" className="text-xs">Concept Name</Label>
                <Input id="concept-name" placeholder="e.g. Docker Volumes" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="concept-description" className="text-xs">Description</Label>
                <Input
                  id="concept-description"
                  placeholder="Summary of concept requirements"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={pending} className="w-full">
                Create Concept
              </Button>
            </form>

            <form onSubmit={createEdge} className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Add Prerequisite Edge</h2>
              <div className="space-y-1.5">
                <Label htmlFor="concept-id" className="text-xs">Target Concept</Label>
                <select
                  id="concept-id"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  value={conceptId}
                  onChange={(event) => setConceptId(event.target.value)}
                >
                  {map.concepts.map((concept) => (
                    <option key={concept.id} value={concept.id}>
                      {concept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requires-id" className="text-xs">Requires Prerequisite</Label>
                <select
                  id="requires-id"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  value={requiresId}
                  onChange={(event) => setRequiresId(event.target.value)}
                >
                  {map.concepts.map((concept) => (
                    <option key={concept.id} value={concept.id}>
                      {concept.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="secondary" size="sm" disabled={pending || map.concepts.length < 2} className="w-full">
                Connect Prerequisite
              </Button>
            </form>
          </>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
