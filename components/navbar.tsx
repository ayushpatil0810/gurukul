"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { UserButton } from "@/components/auth/user-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

export function Navbar() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  const role = session?.user.role;
  const navLinks = [
    { href: "/", label: "Home" },
    ...(session?.user ? [{ href: "/curriculum", label: "Concept map" }] : []),
    ...(session?.user ? [{ href: "/dashboard", label: "Dashboard" }] : []),
    ...(role === "student" ? [{ href: "/practice", label: "Practice" }] : []),
    ...(role === "trainer" || role === "admin" ? [{ href: "/questions", label: "Questions" }] : []),
    ...(role === "trainer" || role === "admin" ? [{ href: "/replay", label: "Replay" }] : []),
    ...(role === "trainer" || role === "admin" ? [{ href: "/review", label: "Review" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-foreground tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              ⚡
            </span>
            <span>Adaptive Portal</span>
            {role ? (
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase font-mono">
                {role}
              </Badge>
            ) : null}
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md transition-colors",
                    isActive
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          ) : session?.user ? (
            <UserButton />
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/login?mode=signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
