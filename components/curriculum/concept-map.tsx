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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="h-[560px] overflow-hidden rounded-xl border border-border bg-card">
        {map.concepts.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No concepts yet.</p>
        ) : (
          <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}>
            <Background />
            <Controls />
          </ReactFlow>
        )}
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold">Modules</h2>
          {map.modules.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No modules yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {map.modules.map((module) => {
                const goal = map.concepts.find((concept) => concept.id === module.goalConceptId);
                return (
                  <li key={module.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{module.name}</p>
                    <p className="text-muted-foreground">
                      Goal: {goal?.name ?? "Unknown"} · threshold {module.masteryThreshold}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canEdit ? (
          <>
            <form onSubmit={createConcept} className="space-y-3">
              <h2 className="text-sm font-semibold">Add concept</h2>
              <div className="space-y-1.5">
                <Label htmlFor="concept-name">Name</Label>
                <Input id="concept-name" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="concept-description">Description</Label>
                <Input
                  id="concept-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={pending}>
                Create concept
              </Button>
            </form>

            <form onSubmit={createEdge} className="space-y-3">
              <h2 className="text-sm font-semibold">Add prerequisite</h2>
              <div className="space-y-1.5">
                <Label htmlFor="concept-id">Concept</Label>
                <select
                  id="concept-id"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                <Label htmlFor="requires-id">Requires</Label>
                <select
                  id="requires-id"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
              <Button type="submit" variant="outline" disabled={pending || map.concepts.length < 2}>
                Add edge
              </Button>
            </form>
          </>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
