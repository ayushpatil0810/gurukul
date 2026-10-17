"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenIcon,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  LogOutIcon,
  MoonIcon,
  Network,
  Code2,
  HelpCircle,
  History,
  ShieldAlert,
  SunIcon,
} from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { LearnLoopLogo } from "./app-logo";
import { SidebarCollapseIcon } from "./portal-icons";
import { cn } from "cn";

export function PortalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

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

  const navGroups = [
    {
      label: "Workspace",
      collapsible: false,
      items: [
        {
          name: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          name: "Concept Map",
          href: "/curriculum",
          icon: Network,
        },
      ],
    },
    ...(isStudent
      ? [
          {
            label: "Assessment",
            collapsible: true,
            items: [
              {
                name: "Practice & Run",
                href: "/practice",
                icon: Code2,
                badge: "Active",
              },
            ],
          },
        ]
      : []),
    ...(isTrainerOrAdmin
      ? [
          {
            label: "Authoring & Audit",
            collapsible: true,
            items: [
              {
                name: "Lesson Studio",
                href: "/studio",
                icon: BookOpenIcon,
              },
              {
                name: "Question Bank",
                href: "/questions",
                icon: HelpCircle,
              },
              {
                name: "Session Replay",
                href: "/replay",
                icon: History,
              },
              {
                name: "Integrity Review",
                href: "/review",
                icon: ShieldAlert,
                badge: "Queue",
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/70 bg-sidebar">
      {/* Header */}
      <SidebarHeader className="relative h-18 flex-row items-center justify-between gap-3 px-4 border-b border-sidebar-border/60 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <div className="flex min-w-0 items-center gap-2.5 transition-opacity group-data-[collapsible=icon]:hidden">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <LearnLoopLogo className="size-4.5 text-primary-foreground" />
          </div>
          <div className="flex flex-col truncate">
            <span className="truncate text-base font-bold tracking-tight text-sidebar-foreground">
              LearnLoop
            </span>
            <span className="text-[10px] font-medium text-sidebar-foreground/60 leading-none">
              Adaptive Portal
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebar}
          aria-label={state === "expanded" ? "Collapse sidebar" : "Expand sidebar"}
          className="size-8 text-sidebar-foreground/70 hover:text-sidebar-foreground"
        >
          <SidebarCollapseIcon className="size-4 transition-transform group-data-[collapsible=icon]:rotate-180" />
        </Button>
      </SidebarHeader>

      {/* Nav Content */}
      <SidebarContent className="gap-4 px-3 py-4 group-data-[collapsible=icon]:overflow-auto!">
        {navGroups.map((group) => {
          if (group.collapsible) {
            return (
              <Collapsible key={group.label} defaultOpen className="group/collapsible">
                <SidebarGroup className="gap-1 p-0">
                  <SidebarGroupLabel asChild className="h-auto px-1 py-1 text-xs font-semibold text-sidebar-foreground/70 transition-colors uppercase tracking-wider">
                    <CollapsibleTrigger className="flex w-full items-center justify-between hover:text-sidebar-foreground">
                      <span>{group.label}</span>
                      <ChevronRight className="ml-auto size-3.5 transition-transform group-data-[state=open]/collapsible:rotate-90 text-sidebar-foreground/50" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-1 pt-1">
                        {group.items.map((item) => {
                          const isActive =
                            item.href === "/dashboard"
                              ? pathname === "/dashboard"
                              : pathname === item.href || pathname.startsWith(`${item.href}/`);
                          return (
                            <SidebarMenuItem key={item.name}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                tooltip={item.name}
                                className="h-9 gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors"
                              >
                                <Link
                                  href={item.href}
                                  onClick={() => {
                                    if (isMobile) setOpenMobile(false);
                                  }}
                                >
                                  <item.icon className="size-4 shrink-0" />
                                  <span className="truncate">{item.name}</span>
                                  {item.badge ? (
                                    <SidebarMenuBadge className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded">
                                      {item.badge}
                                    </SidebarMenuBadge>
                                  ) : null}
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          }

          return (
            <SidebarGroup key={group.label} className="gap-1 p-0">
              <SidebarGroupLabel className="h-auto px-1 py-1 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1 pt-1">
                  {group.items.map((item) => {
                    const isActive =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.name}
                          className="h-9 gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors"
                        >
                          <Link
                            href={item.href}
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <item.icon className="size-4 shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Footer / Account */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="peer/menu-button flex w-full items-center gap-2.5 overflow-hidden rounded-lg p-1.5 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
                aria-label="User account menu"
              >
                <Avatar size="sm" className="border border-border/60 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary font-semibold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col leading-tight truncate group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-xs text-sidebar-foreground">
                    {session?.user?.name || "Learner"}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground capitalize">
                    {session?.user?.role || "Student"}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">{session?.user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={toggleTheme}>
                    {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
                    <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/">
                      <ExternalLink className="size-4" />
                      <span>Landing Page</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/curriculum">
                      <Network className="size-4" />
                      <span>Concept Map</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  <LogOutIcon className="size-4" />
                  <span>{isSigningOut ? "Signing out..." : "Log out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
