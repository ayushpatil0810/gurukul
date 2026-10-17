"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Network,
  Code2,
  BookOpen,
  HelpCircle,
  History,
  ShieldAlert,
  LogOut,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const { state } = useSidebar();

  const role = session?.user?.role;
  const isTrainerOrAdmin = role === "trainer" || role === "admin";
  const isStudent = role === "student";

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "LL";

  const coreNav = [
    {
      title: "Mastery Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      match: (path: string) => path === "/dashboard" || path.startsWith("/dashboard/"),
    },
    {
      title: "Concept Map",
      href: "/curriculum",
      icon: Network,
      match: (path: string) => path === "/curriculum" || path.startsWith("/curriculum/"),
    },
  ];

  const studentNav = [
    {
      title: "Practice & Run",
      href: "/practice",
      icon: Code2,
      match: (path: string) => path === "/practice" || path.startsWith("/practice/"),
    },
  ];

  const trainerNav = [
    {
      title: "Lesson Studio",
      href: "/studio",
      icon: BookOpen,
      match: (path: string) => path === "/studio" || path.startsWith("/studio/"),
    },
    {
      title: "Question Bank",
      href: "/questions",
      icon: HelpCircle,
      match: (path: string) => path === "/questions" || path.startsWith("/questions/"),
    },
    {
      title: "Session Replay",
      href: "/replay",
      icon: History,
      match: (path: string) => path === "/replay" || path.startsWith("/replay/"),
    },
    {
      title: "Integrity Review",
      href: "/review",
      icon: ShieldAlert,
      match: (path: string) => path === "/review" || path.startsWith("/review/"),
    },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/70 bg-sidebar">
      {/* Header / Brand */}
      <SidebarHeader className="h-16 justify-center px-3 border-b border-sidebar-border/60">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
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
          <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
              LearnLoop
            </span>
            <span className="text-[11px] font-medium text-sidebar-foreground/60 leading-tight">
              Adaptive Portal
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Core Workspace */}
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreNav.map((item) => {
                const isActive = item.match(pathname);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Student Section */}
        {isStudent ? (
          <SidebarGroup>
            <SidebarGroupLabel>Assessment</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {studentNav.map((item) => {
                  const isActive = item.match(pathname);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {/* Trainer / Admin Section */}
        {isTrainerOrAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel>Instruction & Audit</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {trainerNav.map((item) => {
                  const isActive = item.match(pathname);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      {/* Footer / Account Controls */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        {session?.user ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5 p-1.5 rounded-lg bg-sidebar-accent/50 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold">
                {initials}
              </div>
              <div className="flex flex-col min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
                <p className="text-xs font-semibold text-sidebar-foreground truncate leading-none">
                  {session.user.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge
                    variant="outline"
                    className="text-[9px] uppercase px-1.5 py-0 font-mono tracking-wider h-4 border-sidebar-border text-sidebar-foreground/70"
                  >
                    {session.user.role || "User"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1 group-data-[collapsible=icon]:items-center">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    tooltip="Exit to Landing Page"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Link href="/">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Landing Page</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    size="sm"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    tooltip={isSigningOut ? "Signing out..." : "Sign Out"}
                    className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </div>
        ) : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
