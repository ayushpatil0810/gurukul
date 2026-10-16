"use client";

import { useState } from "react";
import type { ArchitectureDiagramData, DiagramNode } from "@/lib/engine/lesson-preview";

export function ArchitectureDiagram({
  data,
  onSelectNode,
  selectedNodeId: externalSelectedId,
}: {
  data: ArchitectureDiagramData;
  onSelectNode?: (node: DiagramNode | null) => void;
  selectedNodeId?: string | null;
}) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    data.nodes[0]?.id ?? null,
  );
  const activeId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const selectedNode = data.nodes.find((n) => n.id === activeId) ?? null;

  function handleSelect(node: DiagramNode) {
    const nextId = activeId === node.id ? null : node.id;
    setInternalSelectedId(nextId);
    onSelectNode?.(nextId ? node : null);
  }

  // Calculate coordinates for nodes in a clean flow
  const nodeWidth = 140;
  const nodeHeight = 64;
  const gapX = 48;
  const gapY = 60;
  const columns = Math.min(4, Math.max(2, data.nodes.length));
  
  const nodeCoords = new Map<string, { x: number; y: number; col: number; row: number }>();
  data.nodes.forEach((node, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = 30 + col * (nodeWidth + gapX);
    const y = 30 + row * (nodeHeight + gapY);
    nodeCoords.set(node.id, { x, y, col, row });
  });

  const totalRows = Math.ceil(data.nodes.length / columns) || 1;
  const svgWidth = 60 + columns * nodeWidth + (columns - 1) * gapX;
  const svgHeight = 60 + totalRows * nodeHeight + (totalRows - 1) * gapY;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm tracking-tight">
            {data.title ?? "Interactive Architecture Diagram"}
          </h3>
          {data.description ? (
            <p className="mt-1 text-xs text-muted-foreground">{data.description}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Select any stage or component to inspect its role and configuration.
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Interactive System Map
        </span>
      </div>

      {/* SVG Canvas */}
      <div className="relative overflow-x-auto rounded-lg border border-border/50 bg-background/50 p-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="min-w-full h-auto"
          style={{ minHeight: `${Math.max(160, svgHeight)}px` }}
          aria-label="Software Delivery Architecture Diagram"
          role="img"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-muted-foreground" />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-primary" />
            </marker>
          </defs>

          {/* Edges */}
          {data.edges.map((edge, i) => {
            const from = nodeCoords.get(edge.from);
            const to = nodeCoords.get(edge.to);
            if (!from || !to) return null;

            const isConnectedToSelected =
              activeId === edge.from || activeId === edge.to;

            const startX = from.x + nodeWidth;
            const startY = from.y + nodeHeight / 2;
            const endX = to.x;
            const endY = to.y + nodeHeight / 2;

            const isSameRow = from.row === to.row;
            let pathD = "";

            if (isSameRow) {
              pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
            } else {
              const midX = startX + (endX - startX) / 2;
              pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
            }

            return (
              <g key={`edge-${edge.from}-${edge.to}-${i}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isConnectedToSelected ? "var(--primary)" : "currentColor"}
                  strokeWidth={isConnectedToSelected ? 2 : 1.5}
                  strokeDasharray={edge.animated ? "4 3" : undefined}
                  className={`${
                    isConnectedToSelected
                      ? "text-primary"
                      : "text-border"
                  } ${edge.animated ? "animate-[dash_1.5s_linear_infinite]" : ""}`}
                  markerEnd={isConnectedToSelected ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                />
                {edge.label ? (
                  <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 - 6}
                    textAnchor="middle"
                    className="text-[10px] fill-muted-foreground font-mono"
                  >
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* Nodes */}
          {data.nodes.map((node) => {
            const coord = nodeCoords.get(node.id);
            if (!coord) return null;
            const isSelected = activeId === node.id;

            return (
              <g
                key={`node-${node.id}`}
                transform={`translate(${coord.x}, ${coord.y})`}
                className="cursor-pointer group"
                onClick={() => handleSelect(node)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(node);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${node.label} node. Status: ${node.status ?? "ready"}`}
              >
                <rect
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={8}
                  className={`transition-all duration-200 ${
                    isSelected
                      ? "fill-primary/10 stroke-primary stroke-2 shadow-md"
                      : "fill-card stroke-border hover:stroke-foreground/50 hover:fill-accent/40"
                  }`}
                />
                <circle
                  cx={16}
                  cy={18}
                  r={4}
                  className={
                    node.status === "healthy"
                      ? "fill-emerald-500"
                      : node.status === "active"
                        ? "fill-blue-500"
                        : node.status === "warning"
                          ? "fill-amber-500"
                          : "fill-muted-foreground"
                  }
                />
                <text
                  x={26}
                  y={22}
                  className={`text-[12px] font-medium tracking-tight select-none ${
                    isSelected ? "fill-primary font-semibold" : "fill-foreground"
                  }`}
                >
                  {node.label.length > 14 ? `${node.label.slice(0, 13)}…` : node.label}
                </text>
                <text
                  x={16}
                  y={46}
                  className="text-[10px] fill-muted-foreground select-none"
                >
                  {node.category
                    ? node.category.toUpperCase()
                    : node.description.slice(0, 18) + (node.description.length > 18 ? "…" : "")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Node Details Card */}
      {selectedNode ? (
        <div
          className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground animate-in fade-in slide-in-from-top-1 duration-200"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">{selectedNode.label}</span>
              {selectedNode.category ? (
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {selectedNode.category}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className={`h-2 w-2 rounded-full ${
                  selectedNode.status === "healthy"
                    ? "bg-emerald-500"
                    : selectedNode.status === "active"
                      ? "bg-blue-500"
                      : selectedNode.status === "warning"
                        ? "bg-amber-500"
                        : "bg-muted-foreground"
                }`}
              />
              <span className="capitalize">{selectedNode.status ?? "Operational"}</span>
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {selectedNode.description}
          </p>
          {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-2 pt-2 border-t border-border/40">
              {Object.entries(selectedNode.metadata).map(([key, value]) => (
                <span
                  key={key}
                  className="rounded border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[11px]"
                >
                  <span className="text-muted-foreground">{key}: </span>
                  <span className="text-foreground font-medium">{value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
