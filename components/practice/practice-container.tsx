"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ChallengeCatalog } from "./challenge-catalog";
import { LeetCodeWorkspace } from "./leetcode-workspace";
import type {
  PracticeCatalogData,
  PracticeQuestionDetail,
} from "@/lib/services/practice";

interface PracticeContainerProps {
  initialCatalog: PracticeCatalogData;
  initialQuestion?: PracticeQuestionDetail | null;
}

export function PracticeContainer({
  initialCatalog,
  initialQuestion,
}: PracticeContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [catalog, setCatalog] = useState<PracticeCatalogData>(initialCatalog);
  const [activeQuestion, setActiveQuestion] = useState<PracticeQuestionDetail | null>(
    initialQuestion ?? null,
  );
  const [view, setView] = useState<"catalog" | "workspace">(
    initialQuestion ? "workspace" : "catalog",
  );
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Handle URL synchronization
  const updateUrl = (params: { q?: string; module?: string }) => {
    const current = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (params.q) {
      current.set("q", params.q);
    } else {
      current.delete("q");
    }
    if (params.module) {
      current.set("module", params.module);
    }
    const newRelativePathQuery = `${window.location.pathname}?${current.toString()}`;
    window.history.pushState(null, "", newRelativePathQuery);
  };

  async function loadQuestionDetail(questionId: string) {
    setLoadingQuestion(true);
    try {
      const res = await fetch(`/api/practice?questionId=${encodeURIComponent(questionId)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? "Could not load challenge.");
      }
      setActiveQuestion(data.data as PracticeQuestionDetail);
      setView("workspace");
      updateUrl({ q: questionId, module: catalog.activeModuleId });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuestion(false);
    }
  }

  async function loadModuleCatalog(moduleId: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/practice?moduleId=${encodeURIComponent(moduleId)}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setCatalog(data.data as PracticeCatalogData);
          updateUrl({ module: moduleId });
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  function handleBackToCatalog() {
    setView("catalog");
    updateUrl({ q: undefined, module: catalog.activeModuleId });
  }

  return (
    <div className="relative min-h-[500px]">
      {/* Loading Overlay */}
      {loadingQuestion || isPending ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/50 backdrop-blur-2xs">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold shadow-lg">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Loading coding challenge environment...</span>
          </div>
        </div>
      ) : null}

      {view === "workspace" && activeQuestion ? (
        <LeetCodeWorkspace
          question={activeQuestion}
          onSelectQuestion={(id) => void loadQuestionDetail(id)}
          onBackToCatalog={handleBackToCatalog}
        />
      ) : (
        <ChallengeCatalog
          catalog={catalog}
          onSelectChallenge={(id) => void loadQuestionDetail(id)}
          onSelectModule={(id) => void loadModuleCatalog(id)}
        />
      )}
    </div>
  );
}
