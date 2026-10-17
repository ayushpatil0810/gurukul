"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const ROUTE_TITLES: Record<string, { section: string; title: string }> = {
  "/dashboard": { section: "Workspace", title: "Mastery Dashboard" },
  "/curriculum": { section: "Curriculum", title: "Concept Map" },
  "/practice": { section: "Assessment", title: "Practice Workspace" },
  "/studio": { section: "Authoring", title: "Lesson Studio" },
  "/questions": { section: "Authoring", title: "Question Bank" },
  "/replay": { section: "Integrity", title: "Session Replay" },
  "/review": { section: "Integrity", title: "Integrity Review" },
};

export function PortalHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Determine current section and title
  const activeRoute = Object.entries(ROUTE_TITLES).find(([route]) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  const section = activeRoute?.[1]?.section || "Portal";
  const title = activeRoute?.[1]?.title || (pathname.includes("learn") ? "Interactive Lesson" : "Workspace");

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/70 bg-background/95 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-muted-foreground">{section}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="font-semibold text-foreground">{title}</span>
        </nav>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">Sandbox Verified</span>
        </div>

        {session?.user?.role ? (
          <Badge
            variant="outline"
            className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 border-border/80 bg-muted/40"
          >
            {session.user.role}
          </Badge>
        ) : null}
      </div>
    </header>
  );
}
