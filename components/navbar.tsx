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
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Reset mobile menu on route change during render
  const [prevPathname, setPrevPathname] = React.useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
  }

  const role = session?.user.role;
  const navLinks = [
    { href: "/", label: "Home" },
    ...(session?.user ? [{ href: "/curriculum", label: "Concept Map" }] : []),
    ...(session?.user ? [{ href: "/dashboard", label: "Dashboard" }] : []),
    ...(role === "student" ? [{ href: "/practice", label: "Practice" }] : []),
    ...(role === "trainer" || role === "admin" ? [{ href: "/studio", label: "Lesson Studio" }] : []),
    ...(role === "trainer" || role === "admin" ? [{ href: "/questions", label: "Questions" }] : []),
    ...(role === "trainer" || role === "admin" ? [{ href: "/replay", label: "Replay" }] : []),
    ...(role === "trainer" || role === "admin" ? [{ href: "/review", label: "Review" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 min-w-0 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
          >
            {/* LearnLoop Geometric Logo Mark */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <svg
                className="h-4 w-4"
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
              <span className="text-[10px] font-medium text-muted-foreground leading-tight hidden sm:inline">
                Adaptive Assessment
              </span>
            </div>
            {role ? (
              <Badge
                variant="outline"
                className="hidden sm:inline-flex text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 border-border/80 bg-muted/30"
              >
                {role}
              </Badge>
            ) : null}
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden min-w-0 overflow-x-auto md:flex items-center gap-1 text-sm font-medium"
          >
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Action Controls & Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isPending ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          ) : session?.user ? (
            <UserButton />
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="text-xs">
                <Link href="/login?mode=signup">Sign Up</Link>
              </Button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-background text-foreground hover:bg-secondary transition-colors"
          >
            {mobileMenuOpen ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen ? (
        <div className="md:hidden border-b border-border/60 bg-background/98 px-4 pt-2 pb-4 shadow-lg backdrop-blur-md animate-in slide-in-from-top-2 duration-150">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <span>{link.label}</span>
                  {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
