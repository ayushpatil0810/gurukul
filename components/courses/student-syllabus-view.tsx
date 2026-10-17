"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, ChevronRight, Layers, Network, Zap } from "lucide-react";
import type { CourseSummaryItem, CourseDetailView } from "@/lib/services/courses";
import { CourseDagGraph } from "./course-dag-graph";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export function StudentSyllabusView({
  courses,
  initialDetail,
}: {
  courses: CourseSummaryItem[];
  initialDetail?: CourseDetailView | null;
}) {
  const [selectedCourse, setSelectedCourse] = useState<CourseSummaryItem | null>(
    courses[0] ?? null,
  );
  const [viewMode, setViewMode] = useState<"syllabus" | "graph">("syllabus");

  if (!selectedCourse) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card p-6 text-center text-sm text-muted-foreground">
        <BookOpen className="size-8 text-muted-foreground/60 mb-2" />
        <h3 className="font-semibold text-foreground">No active course published yet</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Your instructor has not published a course for your batch yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Course Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground mb-2">
            <span className="size-1.5 rounded-full bg-primary" />
            Learner Syllabus · {selectedCourse.code}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {selectedCourse.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            {selectedCourse.description || "Structured learning path and prerequisite progression."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === "syllabus" ? "default" : "outline"}
            onClick={() => setViewMode("syllabus")}
            className="gap-1.5 text-xs"
          >
            <Layers className="size-4" /> Syllabus Tree
          </Button>
          <Button
            size="sm"
            variant={viewMode === "graph" ? "default" : "outline"}
            onClick={() => setViewMode("graph")}
            className="gap-1.5 text-xs"
          >
            <Network className="size-4" /> Prerequisite Graph
          </Button>
          <Link href="/practice">
            <Button size="sm" variant="secondary" className="gap-1.5 text-xs">
              <Zap className="size-4" /> Practice Now &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {viewMode === "syllabus" && initialDetail ? (
        <div className="space-y-4">
          {initialDetail.modules.map((mod, modIdx) => (
            <div key={mod.id} className="rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold font-mono">
                    M{modIdx + 1}
                  </span>
                  <h2 className="text-base font-bold text-foreground">{mod.name}</h2>
                </div>
                <span className="rounded-md border border-border/60 bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                  Mastery Target: {(mod.masteryThreshold * 100).toFixed(0)}%
                </span>
              </div>

              <div className="space-y-3">
                {mod.sections.map((sec, secIdx) => (
                  <div key={sec.id} className="rounded-lg border border-border/50 bg-background/60 p-3.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">§ {secIdx + 1}</span>
                      <h3 className="text-sm font-semibold text-foreground">{sec.title}</h3>
                    </div>
                    {sec.description ? (
                      <p className="text-xs text-muted-foreground">{sec.description}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                      {sec.concepts.map((c) => (
                        <span
                          key={c.id}
                          className="rounded-md border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-foreground font-medium"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {viewMode === "graph" && initialDetail ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Concepts connect directed from left to right. Complete earlier prerequisite concepts to unlock downstream challenges.
          </p>
          <CourseDagGraph
            courseConcepts={initialDetail.courseConcepts}
            coursePrerequisites={initialDetail.coursePrerequisites}
            allConcepts={initialDetail.availableConcepts}
            allPrerequisites={initialDetail.prerequisites}
            goalConceptId={initialDetail.course.goalConceptId}
            courseName={selectedCourse.name}
            canEdit={false}
          />
        </div>
      ) : null}
    </div>
  );
}
