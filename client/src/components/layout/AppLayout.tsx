import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";

import AppSidebar from "@/components/AppSidebar";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [location] = useLocation();

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
    setIsSidebarOpen(false);
  }, [location]);

  const renderSidebar = () => (
    <AppSidebar onNavigate={() => setIsSidebarOpen(false)} />
  );

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-60 flex-col border-r border-border bg-card md:flex xl:w-64">
        {renderSidebar()}
      </aside>
      <main className="flex min-h-screen flex-1 flex-col">
        {children}
      </main>

      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 sm:w-80 md:hidden">
          {renderSidebar()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default AppLayout;
