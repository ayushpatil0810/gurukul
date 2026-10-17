"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Network, Code2, BookOpen, HelpCircle, History, ShieldAlert } from "lucide-react";
import { CloseIcon, CommandIcon, SearchIcon } from "./portal-icons";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SidebarTrigger } from "@/components/ui/sidebar";

const NAV_ITEMS: { href: string; name: string; icon: typeof LayoutDashboard }[] = [
  { href: "/dashboard", name: "Mastery Dashboard", icon: LayoutDashboard },
  { href: "/curriculum", name: "Course Management", icon: BookOpen },
  { href: "/practice", name: "Practice Lab", icon: Code2 },
  { href: "/studio", name: "Lesson Studio", icon: BookOpen },
  { href: "/questions", name: "Question Bank", icon: HelpCircle },
  { href: "/replay", name: "Session Replay", icon: History },
  { href: "/review", name: "Integrity Review", icon: ShieldAlert },
];

export function PortalTopbar() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const currentPage =
    NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ??
    NAV_ITEMS[0];
  const CurrentPageIcon = currentPage.icon;

  const openMobileSearch = () => {
    setIsMobileSearchOpen(true);
    requestAnimationFrame(() => {
      mobileSearchInputRef.current?.focus();
    });
  };

  const closeMobileSearch = () => {
    setIsMobileSearchOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();

        if (window.matchMedia("(max-width: 767px)").matches) {
          setIsMobileSearchOpen(true);
          requestAnimationFrame(() => {
            mobileSearchInputRef.current?.focus();
          });
          return;
        }

        searchInputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setIsMobileSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/90 px-4 backdrop-blur-md md:px-6">
      {isMobileSearchOpen ? (
        <div className="flex w-full items-center gap-2 md:hidden">
          <InputGroup className="h-9 flex-1 rounded-lg border-none bg-secondary py-1 pr-2 pl-3">
            <InputGroupAddon className="pl-0 text-muted-foreground">
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              ref={mobileSearchInputRef}
              className="h-full p-0 px-1.5 text-sm leading-5 tracking-tight placeholder:text-muted-foreground"
              aria-label="Find assessment, concept, student..."
              placeholder="Find assessment, concept..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </InputGroup>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-lg"
            aria-label="Close search"
            onClick={closeMobileSearch}
          >
            <CloseIcon />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger
              size="icon-sm"
              className="shrink-0 [&_svg]:size-4!"
            />
            <div className="hidden items-center gap-4 sm:flex">
              <div className="flex items-center gap-2">
                <CurrentPageIcon className="size-4 text-primary" />
                <span className="text-base font-semibold leading-none tracking-tight">
                  {currentPage.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-muted-foreground font-mono">
                  Telemetry <span className="text-foreground/80 font-medium">Live</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <InputGroup className="hidden h-9 w-64 shrink-0 rounded-lg border border-border/80 bg-secondary/50 py-1 pr-2 pl-2.5 md:flex">
              <InputGroupAddon className="gap-1.5 p-0 text-muted-foreground">
                <SearchIcon className="size-3" />
              </InputGroupAddon>
              <InputGroupInput
                ref={searchInputRef}
                className="h-full p-0 px-1 text-xs placeholder:text-muted-foreground"
                aria-label="Search syllabus, questions, students"
                placeholder="Search concepts, questions... (Ctrl+K)"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery === "" ? (
                <InputGroupAddon
                  align="inline-end"
                  className="p-0 text-muted-foreground"
                >
                  <div className="flex h-5 w-6 items-center justify-center gap-1 rounded bg-background/80 px-1 border border-border/60">
                    <CommandIcon className="size-2.5" />
                    <span className="text-[10px] leading-none font-mono">K</span>
                  </div>
                </InputGroupAddon>
              ) : null}
            </InputGroup>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              aria-label="Open search"
              onClick={openMobileSearch}
            >
              <SearchIcon className="size-4" />
            </Button>
          </div>
        </>
      )}
    </header>
  );
}
