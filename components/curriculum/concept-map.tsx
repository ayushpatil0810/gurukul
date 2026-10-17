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

      <div className="space-y-4">
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Course Modules</h2>
            <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              {map.modules.length} active
            </span>
          </div>
          {map.modules.length === 0 ? (
            <p className="text-xs text-muted-foreground">No modules yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {map.modules.map((module) => {
                const goal = map.concepts.find((concept) => concept.id === module.goalConceptId);
                return (
                  <li key={module.id} className="rounded-lg border border-border/70 bg-background/50 p-3 shadow-2xs space-y-1">
                    <p className="font-semibold text-foreground text-sm">{module.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Target Goal: <span className="text-foreground font-medium">{goal?.name ?? "Goal Concept"}</span>
                    </p>
                    <p className="text-muted-foreground font-mono text-[11px]">
                      Mastery Threshold: <span className="font-semibold text-primary">{module.masteryThreshold.toFixed(2)}</span>
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
              <h2 className="text-sm font-semibold tracking-tight text-foreground border-b border-border/60 pb-2">
                Add Concept
              </h2>
              <div className="space-y-1.5">
                <Label htmlFor="concept-name" className="text-xs font-medium">Name</Label>
                <Input
                  id="concept-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Memory Management"
                  className="h-8 text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="concept-description" className="text-xs font-medium">Description</Label>
                <Input
                  id="concept-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Summary of concept requirements"
                  className="h-8 text-xs"
                />
              </div>
              <Button type="submit" size="sm" disabled={pending} className="w-full text-xs font-medium">
                Create Concept
              </Button>
            </form>

            <form onSubmit={createEdge} className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3">
              <h2 className="text-sm font-semibold tracking-tight text-foreground border-b border-border/60 pb-2">
                Add Prerequisite Edge
              </h2>
              <div className="space-y-1.5">
                <Label htmlFor="concept-id" className="text-xs font-medium">Target Concept</Label>
                <select
                  id="concept-id"
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-2xs"
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
                <Label htmlFor="requires-id" className="text-xs font-medium">Requires (Prerequisite)</Label>
                <select
                  id="requires-id"
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-2xs"
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
              <Button type="submit" variant="outline" size="sm" disabled={pending || map.concepts.length < 2} className="w-full text-xs font-medium">
                Connect Prerequisite
              </Button>
            </form>
          </>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
