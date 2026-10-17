"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function LandingHeader() {
  const { data: session, isPending } = useSession();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <svg
              className="h-4.5 w-4.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-none tracking-tight">LearnLoop</span>
            <span className="text-[11px] font-medium text-muted-foreground leading-tight hidden sm:inline">
              Adaptive Mastery Platform
            </span>
          </div>
        </Link>

        {/* Minimal Navigation Anchors */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
          <a href="#architecture" className="transition-colors hover:text-foreground">
            Architecture
          </a>
          <a href="#methodology" className="transition-colors hover:text-foreground">
            Methodology
          </a>
          <a href="#verification" className="transition-colors hover:text-foreground">
            Sandbox Verification
          </a>
        </nav>

        {/* Auth CTAs */}
        <div className="flex items-center gap-2.5">
          {isPending ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          ) : session?.user ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase font-mono tracking-wider">
                {session.user.role}
              </Badge>
              <Button asChild size="sm" className="gap-1.5 text-xs font-medium shadow-xs">
                <Link href="/dashboard">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Enter Portal</span>
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="text-xs font-medium">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5 text-xs font-medium shadow-xs">
                <Link href="/login?mode=signup">
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
