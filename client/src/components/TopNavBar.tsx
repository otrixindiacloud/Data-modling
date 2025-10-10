import React, { useEffect, useState } from "react";
import { Undo, Redo, ZoomIn, ZoomOut, Maximize, Download, Menu, ArrowLeft, PanelLeftClose, PanelLeftOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModelerStore } from "@/store/modelerStore";
import AddDataModelModal from "@/components/modals/AddDataModelModal";
import LayerNavigator from "@/components/LayerNavigator";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocation } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

export default function TopNavBar() {
  const {
    currentModel,
    setShowExportModal,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useModelerStore();
  
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [location, setLocation] = useLocation();
  const isModelerRoute = location.startsWith("/modeler");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user, organization, logout } = useAuth();

  const handleBackToModels = () => {
    setLocation("/models");
  };

  const openNavigation = () => {
    window.dispatchEvent(new CustomEvent("openNavigation"));
  };

  const handleZoomIn = () => {
    window.dispatchEvent(new CustomEvent('canvasZoomIn'));
  };

  const handleZoomOut = () => {
    window.dispatchEvent(new CustomEvent('canvasZoomOut'));
  };

  const handleFitView = () => {
    window.dispatchEvent(new CustomEvent('canvasFitView'));
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/auth/login");
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem("app-sidebar-collapsed");
      if (stored) {
        setIsSidebarCollapsed(JSON.parse(stored) === true);
      }
    } catch (error) {
      console.warn("Failed to read sidebar collapsed state", error);
    }

    const handleSidebarState = (event: Event) => {
      const detail = (event as CustomEvent<{ collapsed: boolean }>).detail;
      if (detail && typeof detail.collapsed === "boolean") {
        setIsSidebarCollapsed(detail.collapsed);
      }
    };

    window.addEventListener("sidebarCollapseChanged", handleSidebarState as EventListener);
    return () => {
      window.removeEventListener("sidebarCollapseChanged", handleSidebarState as EventListener);
    };
  }, []);

  const toggleSidebarCollapse = () => {
    window.dispatchEvent(new CustomEvent("toggleSidebarCollapse"));
  };

  return (
    <TooltipProvider>
      <header className="bg-card dark:bg-card border-b border-border dark:border-border flex items-center justify-between px-3 sm:px-4 lg:px-6 h-14 sm:h-16 shadow-soft relative z-50 min-w-0">
      <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 min-w-0 flex-1">
        {/* Mobile Navigation - integrated into responsive design */}
        <div className="flex items-center space-x-2 min-w-0">
          {isModelerRoute && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleBackToModels}
                  aria-label="Back to models list"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Back to models list</p>
              </TooltipContent>
            </Tooltip>
          )}

          <div className="md:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={openNavigation}
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open navigation</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {isModelerRoute && (
            <div className="sm:hidden max-w-[160px] truncate text-sm font-semibold text-foreground">
              {currentModel ? currentModel.name : "Not selected"}
            </div>
          )}

          <div className="hidden md:block">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={toggleSidebarCollapse}
                  aria-label={isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}</p>
              </TooltipContent>
            </Tooltip>
          </div>

        </div>

        {/* Layer Navigator - hidden on smaller screens */}
        {isModelerRoute && currentModel && (
          <div className="hidden sm:block ml-2 sm:ml-4 lg:ml-8">
            <LayerNavigator />
          </div>
        )}

        {/* Model Selector - hidden on mobile */}
        {isModelerRoute && (
          <div className="hidden sm:flex items-center gap-2 ml-2 sm:ml-4 lg:ml-8">
          <h2 className="text-2xl font-bold">{currentModel ? currentModel.name : "Not selected"}</h2>
          </div>
        )}

      </div>

      <div className="flex items-center space-x-2 lg:space-x-3 min-w-0 flex-shrink-0">
        {/* Canvas Controls - hidden on mobile */}
        <div className="hidden lg:flex items-center space-x-1 border-l border-r border-border px-2 lg:px-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={!canUndo()}
                className="h-9 w-9 p-0"
              >
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo last action</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={!canRedo()}
                className="h-9 w-9 p-0"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Redo last action</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 w-9 p-0"
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom in on canvas</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 w-9 p-0"
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom out from canvas</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 w-9 p-0"
                onClick={handleFitView}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Fit all objects to view</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Export Button */}
        {isModelerRoute && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setShowExportModal(true)}
                size="sm"
                className="font-medium touch-target gradient-primary text-white hover:opacity-90 transition-all duration-200 shadow-soft hover:shadow-medium"
              >
                <Download className="w-4 h-4 mr-1 lg:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export current model to various formats</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

        <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{user?.name ?? user?.email ?? ""}</span>
          {organization && <span>{organization.name}</span>}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sign out</p>
          </TooltipContent>
        </Tooltip>
      </div>

        {isModelerRoute && (
          <AddDataModelModal
            open={showAddModelModal}
            onOpenChange={setShowAddModelModal}
          />
        )}
      </header>
    </TooltipProvider>
  );
}
