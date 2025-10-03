import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";

import AppSidebar from "@/components/AppSidebar";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [location] = useLocation();
  const hideSidebar = location.startsWith("/modeler");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      const stored = window.localStorage.getItem("app-sidebar-collapsed");
      return stored ? JSON.parse(stored) === true : false;
    } catch (error) {
      console.warn("Failed to read sidebar collapsed state", error);
      return false;
    }
  });

  useEffect(() => {
    const handleOpen = () => setIsSidebarOpen(true);
    const handleClose = () => setIsSidebarOpen(false);

    window.addEventListener("openNavigation", handleOpen);
    window.addEventListener("closeNavigation", handleClose);

    return () => {
      window.removeEventListener("openNavigation", handleOpen);
      window.removeEventListener("closeNavigation", handleClose);
    };
  }, []);

  useEffect(() => {
    const handleToggle = () => setIsSidebarCollapsed((prev) => !prev);
    const handleCollapse = () => setIsSidebarCollapsed(true);
    const handleExpand = () => setIsSidebarCollapsed(false);

    window.addEventListener("toggleSidebarCollapse", handleToggle);
    window.addEventListener("collapseSidebar", handleCollapse);
    window.addEventListener("expandSidebar", handleExpand);

    return () => {
      window.removeEventListener("toggleSidebarCollapse", handleToggle);
      window.removeEventListener("collapseSidebar", handleCollapse);
      window.removeEventListener("expandSidebar", handleExpand);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem("app-sidebar-collapsed", JSON.stringify(isSidebarCollapsed));
    } catch (error) {
      console.warn("Failed to persist sidebar collapsed state", error);
    }

    window.dispatchEvent(new CustomEvent("sidebarCollapseChanged", {
      detail: { collapsed: isSidebarCollapsed },
    }));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  const renderSidebar = (collapsed = isSidebarCollapsed) => (
    <AppSidebar
      collapsed={collapsed}
      onNavigate={() => setIsSidebarOpen(false)}
    />
  );

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {!hideSidebar && (
        <aside
          className={cn(
            "sticky top-0 hidden h-screen flex-col border-r border-border bg-card md:flex transition-[width] duration-300 ease-in-out",
            isSidebarCollapsed ? "w-16" : "w-60 xl:w-64"
          )}
          data-collapsed={isSidebarCollapsed ? "true" : "false"}
        >
          {renderSidebar()}
        </aside>
      )}
      <main className="flex min-h-screen flex-1 flex-col">
        {children}
      </main>
      {!hideSidebar && (
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent side="left" className="w-72 p-0 sm:w-80 md:hidden">
            {renderSidebar(false)}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

export default AppLayout;
