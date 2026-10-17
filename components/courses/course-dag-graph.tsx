"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { layoutConceptMap } from "@/lib/engine/concept-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Network,
  Plus,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  Info,
  Compass,
  Zap,
  Target,
  Workflow,
} from "lucide-react";
import { cn } from "cn";

// Concept Node Data Interface
export type ConceptNodeData = {
  id: string;
  name: string;
  description: string;
  isGoal: boolean;
  isRoot: boolean;
  moduleName?: string;
  sectionTitle?: string;
  prereqCount: number;
  unlocksCount: number;
  isSelected: boolean;
  isHighlighted: boolean;
  isUpstream: boolean;
  isDownstream: boolean;
};

// Custom ReactFlow Node Component
function ConceptCustomNode({ data }: NodeProps<Node<ConceptNodeData>>) {
  const {
    name,
    description,
    isGoal,
    isRoot,
    moduleName,
    sectionTitle,
    prereqCount,
    unlocksCount,
    isSelected,
    isUpstream,
    isDownstream,
  } = data;

  return (
    <div
      className={cn(
        "group relative flex w-[260px] flex-col rounded-xl border p-3.5 transition-all duration-200 select-none shadow-sm",
        isGoal
          ? "border-amber-500/80 bg-amber-500/5 shadow-[0_0_24px_rgba(245,158,11,0.22)] ring-1 ring-amber-500/40"
          : isSelected
            ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(99,102,241,0.25)] ring-1 ring-primary/50"
            : isUpstream
              ? "border-emerald-500/80 bg-emerald-500/5 ring-1 ring-emerald-500/40"
              : isDownstream
                ? "border-indigo-500/80 bg-indigo-500/5 ring-1 ring-indigo-500/40"
                : "border-border/80 bg-card/95 hover:border-primary/50 hover:shadow-md",
      )}
    >
      {/* Target Handle (Left) - Inbound Prerequisite */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !-left-1.5 !border-2 !border-background !bg-primary transition-transform hover:!scale-150"
      />

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-border/50">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {sectionTitle ? (
            <span className="truncate rounded-xs bg-muted/80 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-muted-foreground uppercase tracking-wide">
              {sectionTitle.split(":")[0] || "Section"}
            </span>
          ) : moduleName ? (
            <span className="truncate rounded-xs bg-muted/80 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-muted-foreground uppercase tracking-wide">
              {moduleName.slice(0, 16)}
            </span>
          ) : (
            <span className="rounded-xs bg-muted/60 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
              Concept
            </span>
          )}
        </div>

        {/* Stage Badge */}
        {isGoal ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            <Sparkles className="size-2.5 fill-amber-500 text-amber-500" />
            Capstone
          </span>
        ) : isRoot ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            🌱 Foundation
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-400">
            ⚡ Core
          </span>
        )}
      </div>

      {/* Concept Name */}
      <div className="pt-2">
        <h4 className="text-xs font-bold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {name}
        </h4>
        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {description || "Essential building block of this learning path."}
        </p>
      </div>

      {/* Footer Metrics Row */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground">
        <span
          className={cn(
            "rounded px-1.5 py-0.5",
            prereqCount === 0
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
              : "bg-muted text-muted-foreground",
          )}
        >
          {prereqCount === 0 ? "No Prereqs" : `← ${prereqCount} ${prereqCount === 1 ? "Prereq" : "Prereqs"}`}
        </span>

        <span
          className={cn(
            "rounded px-1.5 py-0.5",
            unlocksCount > 0 ? "bg-primary/10 text-primary font-semibold" : "bg-muted text-muted-foreground",
          )}
        >
          {unlocksCount > 0 ? `Unlocks ${unlocksCount} →` : "Terminal"}
        </span>
      </div>

      {/* Source Handle (Right) - Outbound Unlocked */}
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !-right-1.5 !border-2 !border-background !bg-primary transition-transform hover:!scale-150"
      />
    </div>
  );
}

const nodeTypes = {
  conceptNode: ConceptCustomNode,
};

function FlowInner({
  courseConcepts,
  coursePrerequisites,
  allConcepts,
  allPrerequisites,
  goalConceptId,
  courseName,
  canEdit = true,
  onAddPrerequisite,
  onCreateConcept,
}: {
  courseConcepts?: Array<{
    id: string;
    name: string;
    description: string;
    moduleId?: string;
    moduleName?: string;
    sectionId?: string;
    sectionTitle?: string;
    orderIndex?: number;
  }>;
  coursePrerequisites?: Array<{ conceptId: string; requiresId: string }>;
  allConcepts?: Array<{ id: string; name: string; description: string }>;
  allPrerequisites?: Array<{ conceptId: string; requiresId: string }>;
  concepts?: Array<{ id: string; name: string; description: string }>;
  prerequisites?: Array<{ conceptId: string; requiresId: string }>;
  goalConceptId?: string | null;
  courseName?: string;
  canEdit?: boolean;
  onAddPrerequisite?: (conceptId: string, requiresId: string) => Promise<string | null>;
  onCreateConcept?: (name: string, description: string) => Promise<string | null>;
}) {
  const { fitView } = useReactFlow();
  const [scope, setScope] = useState<"course" | "all">("course");
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [isAnimated, setIsAnimated] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formConceptId, setFormConceptId] = useState("");
  const [formRequiresId, setFormRequiresId] = useState("");
  const [newConceptName, setNewConceptName] = useState("");
  const [newConceptDesc, setNewConceptDesc] = useState("");
  const [pending, setPending] = useState(false);

  // Active dataset depending on scope
  const activeConcepts = useMemo(() => {
    if (scope === "course" && courseConcepts && courseConcepts.length > 0) {
      return courseConcepts;
    }
    return allConcepts && allConcepts.length > 0
      ? allConcepts
      : (courseConcepts ?? []);
  }, [scope, courseConcepts, allConcepts]);

  const activePrerequisites = useMemo(() => {
    if (scope === "course" && coursePrerequisites) {
      return coursePrerequisites;
    }
    return allPrerequisites && allPrerequisites.length > 0
      ? allPrerequisites
      : (coursePrerequisites ?? []);
  }, [scope, coursePrerequisites, allPrerequisites]);

  // Compute upstream (prerequisites) and downstream (unlocks) for selected node
  const { upstreamIds, downstreamIds } = useMemo(() => {
    if (!selectedConceptId) {
      return { upstreamIds: new Set<string>(), downstreamIds: new Set<string>() };
    }

    const up = new Set<string>();
    for (const e of activePrerequisites) {
      if (e.conceptId === selectedConceptId) {
        up.add(e.requiresId);
      }
    }

    const down = new Set<string>();
    for (const e of activePrerequisites) {
      if (e.requiresId === selectedConceptId) {
        down.add(e.conceptId);
      }
    }

    return { upstreamIds: up, downstreamIds: down };
  }, [selectedConceptId, activePrerequisites]);

  // Generate ReactFlow Nodes
  const nodes = useMemo<Node<ConceptNodeData>[]>(() => {
    const positions = layoutConceptMap(activeConcepts, activePrerequisites);
    const posMap = new Map(positions.map((p) => [p.id, p]));

    return activeConcepts.map((concept) => {
      const pos = posMap.get(concept.id) ?? { x: 0, y: 0 };
      const isGoal = concept.id === goalConceptId;

      const prereqCount = activePrerequisites.filter((e) => e.conceptId === concept.id).length;
      const unlocksCount = activePrerequisites.filter((e) => e.requiresId === concept.id).length;
      const isRoot = prereqCount === 0;

      // Extract module/section metadata if available
      const detailed = courseConcepts?.find((c) => c.id === concept.id);

      return {
        id: concept.id,
        type: "conceptNode",
        position: { x: pos.x, y: pos.y },
        data: {
          id: concept.id,
          name: concept.name,
          description: concept.description,
          isGoal,
          isRoot,
          moduleName: detailed?.moduleName,
          sectionTitle: detailed?.sectionTitle,
          prereqCount,
          unlocksCount,
          isSelected: concept.id === selectedConceptId,
          isHighlighted: Boolean(selectedConceptId),
          isUpstream: upstreamIds.has(concept.id),
          isDownstream: downstreamIds.has(concept.id),
        },
      };
    });
  }, [activeConcepts, activePrerequisites, goalConceptId, courseConcepts, selectedConceptId, upstreamIds, downstreamIds]);

  // Generate ReactFlow Edges
  const edges = useMemo<Edge[]>(() => {
    return activePrerequisites.map((edge) => {
      const isConnectingToGoal = edge.conceptId === goalConceptId;
      const isSelectedIncoming = edge.conceptId === selectedConceptId;
      const isSelectedOutgoing = edge.requiresId === selectedConceptId;
      const isFocused = isSelectedIncoming || isSelectedOutgoing;

      let strokeColor = "rgba(99, 102, 241, 0.5)"; // default indigo
      if (isConnectingToGoal) strokeColor = "rgba(245, 158, 11, 0.85)"; // gold for goal
      if (isSelectedIncoming) strokeColor = "#10b981"; // emerald for requirements
      if (isSelectedOutgoing) strokeColor = "#6366f1"; // indigo for unlocks

      return {
        id: `${edge.requiresId}->${edge.conceptId}`,
        source: edge.requiresId,
        target: edge.conceptId,
        type: "smoothstep",
        animated: isAnimated || isFocused || isConnectingToGoal,
        style: {
          stroke: strokeColor,
          strokeWidth: isFocused ? 2.5 : 1.75,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: strokeColor,
        },
      };
    });
  }, [activePrerequisites, goalConceptId, selectedConceptId, isAnimated]);

  const handleNodeClick = useCallback((_: any, node: Node) => {
    setSelectedConceptId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedConceptId(null);
  }, []);

  // Selected concept details for the inspector card
  const selectedConcept = useMemo(() => {
    if (!selectedConceptId) return null;
    return activeConcepts.find((c) => c.id === selectedConceptId) ?? null;
  }, [selectedConceptId, activeConcepts]);

  const selectedPrerequisites = useMemo(() => {
    if (!selectedConceptId) return [];
    const reqIds = activePrerequisites
      .filter((e) => e.conceptId === selectedConceptId)
      .map((e) => e.requiresId);
    return activeConcepts.filter((c) => reqIds.includes(c.id));
  }, [selectedConceptId, activePrerequisites, activeConcepts]);

  const selectedUnlocks = useMemo(() => {
    if (!selectedConceptId) return [];
    const unlIds = activePrerequisites
      .filter((e) => e.requiresId === selectedConceptId)
      .map((e) => e.conceptId);
    return activeConcepts.filter((c) => unlIds.includes(c.id));
  }, [selectedConceptId, activePrerequisites, activeConcepts]);

  async function handleAddPrereq(e: React.FormEvent) {
    e.preventDefault();
    if (!onAddPrerequisite) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const err = await onAddPrerequisite(formConceptId, formRequiresId);
    setPending(false);
    if (err) {
      setError(err);
    } else {
      setSuccess("Prerequisite dependency connected successfully.");
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  async function handleCreateConcept(e: React.FormEvent) {
    e.preventDefault();
    if (!onCreateConcept || !newConceptName) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const err = await onCreateConcept(newConceptName, newConceptDesc);
    setPending(false);
    if (err) {
      setError(err);
    } else {
      setSuccess(`Concept "${newConceptName}" created.`);
      setNewConceptName("");
      setNewConceptDesc("");
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  return (
    <div
      className={cn(
        "grid gap-6",
        isFullscreen ? "fixed inset-4 z-50 bg-background p-6 rounded-2xl border shadow-2xl" : "lg:grid-cols-[minmax(0,1fr)_340px]",
      )}
    >
      {/* GRAPH CANVAS WRAPPER */}
      <div className="relative flex flex-col h-[660px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
        {/* Top Floating Controls Bar */}
        <div className="absolute top-3 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Left: Scope Selector & Flow Guide */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center rounded-lg border border-border/80 bg-background/95 p-1 text-xs font-medium shadow-xs backdrop-blur-md">
              <button
                type="button"
                onClick={() => setScope("course")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                  scope === "course"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Compass className="size-3.5" />
                <span>This Course Track ({courseConcepts?.length ?? 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setScope("all")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                  scope === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Network className="size-3.5" />
                <span>Full Knowledge Pool ({allConcepts?.length ?? activeConcepts.length})</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-md">
              <Workflow className="size-3.5 text-primary" />
              <span>Progression: Left &rarr; Right</span>
            </div>
          </div>

          {/* Right: Actions (Fit View, Toggle Animation, Fullscreen) */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fitView({ padding: 0.2, duration: 400 })}
              className="h-8 gap-1.5 bg-background/90 backdrop-blur-md text-xs font-medium"
            >
              <Target className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Fit View</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAnimated(!isAnimated)}
              className="h-8 gap-1.5 bg-background/90 backdrop-blur-md text-xs font-medium"
            >
              <Zap className={cn("size-3.5", isAnimated ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
              <span className="hidden sm:inline">{isAnimated ? "Flow Active" : "Static"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="size-8 bg-background/90 backdrop-blur-md"
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>
          </div>
        </div>

        {/* ReactFlow Canvas */}
        <div className="flex-1 w-full h-full">
          {activeConcepts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
              <Network className="size-10 text-muted-foreground/50 mb-3" />
              <p className="font-semibold text-base text-foreground">No concepts defined in this track</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Add modules, sections, and concepts to view the interconnected pedagogical DAG.
              </p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.2}
              maxZoom={1.8}
            >
              <Background gap={24} size={1} color="var(--border)" />
              <Controls showInteractive={false} position="bottom-left" />
              <MiniMap
                position="bottom-right"
                nodeStrokeColor="#6366f1"
                nodeColor="#e0e7ff"
                className="!m-3 !border !border-border/80 !rounded-lg !bg-card/90 !shadow-xs"
              />
            </ReactFlow>
          )}
        </div>

        {/* Bottom Floating Legend Bar */}
        <div className="absolute bottom-3 left-14 z-10 hidden md:flex items-center gap-3 rounded-lg border border-border/80 bg-background/90 px-3.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur-md shadow-xs pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>🌱 Foundation (0 Prereqs)</span>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-indigo-500" />
            <span>⚡ Core Track</span>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" />
            <span>★ Capstone Goal</span>
          </div>
          <span className="text-border">•</span>
          <div className="flex items-center gap-1.5">
            <ArrowRight className="size-3 text-primary" />
            <span>Directed Prerequisite Edge</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: CONCEPT INSPECTOR & ACTIONS */}
      <div className="space-y-4">
        {/* Alerts */}
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{success}</span>
          </div>
        ) : null}

        {/* CONCEPT INSPECTOR CARD */}
        {selectedConcept ? (
          <div className="rounded-xl border border-primary/40 bg-card p-5 shadow-xs space-y-4 animate-in fade-in-50 duration-200">
            <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">
                  Concept Inspector
                </span>
                <h3 className="text-base font-bold text-foreground mt-0.5">
                  {selectedConcept.name}
                </h3>
              </div>
              {selectedConcept.id === goalConceptId ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  ★ Capstone
                </span>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {selectedConcept.description || "No specific learning description provided."}
            </p>

            {/* Inbound Prerequisites */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Must Complete First ({selectedPrerequisites.length}):
              </span>
              {selectedPrerequisites.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic pl-3">
                  None — this is an initial foundation concept.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pl-3">
                  {selectedPrerequisites.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedConceptId(p.id)}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Outbound Unlocked */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-indigo-500" />
                Unlocks Next ({selectedUnlocks.length}):
              </span>
              {selectedUnlocks.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic pl-3">
                  Terminal concept or capstone milestone.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pl-3">
                  {selectedUnlocks.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedConceptId(u.id)}
                      className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedConceptId(null)}
              className="w-full text-xs"
            >
              Close Inspector
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 text-center text-xs text-muted-foreground space-y-1.5">
            <Info className="size-6 text-muted-foreground/60 mx-auto" />
            <h4 className="font-semibold text-foreground">Interactive Knowledge Inspector</h4>
            <p className="text-[11px] leading-relaxed">
              Click on any concept node on the canvas to highlight its prerequisite chain and inspect learning goals.
            </p>
          </div>
        )}

        {/* EDITING FORMS (TRAINERS / ADMINS ONLY) */}
        {canEdit ? (
          <>
            {/* Prerequisite Edge Form */}
            <form
              onSubmit={handleAddPrereq}
              className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3.5"
            >
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Connect Prerequisite Edge
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Establishes directed dependency with automatic cycle validation.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="req-c" className="text-xs font-medium">1. Prerequisite Concept (Required First)</Label>
                <select
                  id="req-c"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  value={formRequiresId}
                  onChange={(e) => setFormRequiresId(e.target.value)}
                >
                  <option value="">-- Choose Prerequisite --</option>
                  {activeConcepts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="target-c" className="text-xs font-medium">2. Target Concept (Unlocked Next)</Label>
                <select
                  id="target-c"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  value={formConceptId}
                  onChange={(e) => setFormConceptId(e.target.value)}
                >
                  <option value="">-- Choose Target --</option>
                  {activeConcepts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={pending || !formConceptId || !formRequiresId || formConceptId === formRequiresId}
                className="w-full text-xs font-semibold gap-1.5"
              >
                <Workflow className="size-3.5 text-primary" />
                Connect Dependency Flow
              </Button>
            </form>

            {/* Quick Concept Adder */}
            <form
              onSubmit={handleCreateConcept}
              className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Create New Concept
              </h3>
              <div className="space-y-1.5">
                <Label htmlFor="new-c-name" className="text-xs font-medium">Concept Title *</Label>
                <Input
                  id="new-c-name"
                  placeholder="e.g. Async Stream Buffering"
                  value={newConceptName}
                  onChange={(e) => setNewConceptName(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-c-desc" className="text-xs font-medium">Learning Summary</Label>
                <Input
                  id="new-c-desc"
                  placeholder="Core objective to master"
                  value={newConceptDesc}
                  onChange={(e) => setNewConceptDesc(e.target.value)}
                  className="text-xs"
                />
              </div>

              <Button type="submit" size="sm" disabled={pending || !newConceptName} className="w-full text-xs gap-1.5">
                <Plus className="size-3.5" />
                Add to Concept Pool
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function CourseDagGraph(props: {
  courseConcepts?: Array<{
    id: string;
    name: string;
    description: string;
    moduleId?: string;
    moduleName?: string;
    sectionId?: string;
    sectionTitle?: string;
    orderIndex?: number;
  }>;
  coursePrerequisites?: Array<{ conceptId: string; requiresId: string }>;
  allConcepts?: Array<{ id: string; name: string; description: string }>;
  allPrerequisites?: Array<{ conceptId: string; requiresId: string }>;
  concepts?: Array<{ id: string; name: string; description: string }>;
  prerequisites?: Array<{ conceptId: string; requiresId: string }>;
  goalConceptId?: string | null;
  courseName?: string;
  canEdit?: boolean;
  onAddPrerequisite?: (conceptId: string, requiresId: string) => Promise<string | null>;
  onCreateConcept?: (name: string, description: string) => Promise<string | null>;
}) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  );
}
