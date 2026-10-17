import * as React from "react";
import { Suspense } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalTopbar } from "@/components/portal/portal-topbar";
import "@/components/portal/dashboard.css";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      defaultOpen={true}
      className="portal-dashboard h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "17.25rem",
          "--sidebar-width-icon": "4.5rem",
        } as React.CSSProperties
      }
    >
      <Suspense
        fallback={
          <div className="hidden md:block w-[17.25rem] h-svh bg-sidebar border-r border-sidebar-border shrink-0" />
        }
      >
        <PortalSidebar />
      </Suspense>

      <SidebarInset className="min-w-0 flex flex-1 flex-col overflow-hidden bg-background">
        <Suspense
          fallback={<div className="h-16 border-b border-border/70 bg-background/90" />}
        >
          <PortalTopbar />
        </Suspense>
        <div className="flex-1 overflow-y-auto no-scrollbar">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
