import React, { useState } from "react";
import { Undo, Redo, ZoomIn, ZoomOut, Maximize, Download, Plus, Settings, Layers3, Server, Menu, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModelerStore } from "@/store/modelerStore";
import AddDataModelModal from "@/components/modals/AddDataModelModal";
import ModelSelector from "@/components/ModelSelector";
import LayerNavigator from "@/components/LayerNavigator";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocation } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  const handleConfigurationClick = () => {
    setLocation("/configuration");
  };

  const handleSystemsClick = () => {
    setLocation("/systems");
  };

  const handleModelsClick = () => {
    setLocation("/models");
  };

  const handleReportsClick = () => {
    setLocation("/reports");
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

  return (
    <TooltipProvider>
      <header className="bg-card dark:bg-card border-b border-border dark:border-border flex items-center justify-between px-3 sm:px-4 lg:px-6 h-14 sm:h-16 shadow-soft relative z-50 min-w-0">
      <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 min-w-0 flex-1">
        {/* Mobile Navigation - integrated into responsive design */}
        <div className="flex items-center space-x-2 min-w-0">
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

          {/* DArk Modeler Logo */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg ring-1 sm:ring-2 ring-white/20 dark:ring-white/10">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" className="text-white sm:w-5 sm:h-5">
              {/* Stylized "D" with data visualization elements */}
              <path
                d="M4 4 L4 28 L16 28 Q24 28 28 20 Q28 16 28 12 Q24 4 16 4 Z"
                fill="currentColor"
                fillOpacity="0.9"
              />
              <circle cx="20" cy="12" r="2" fill="currentColor" fillOpacity="0.7" />
              <circle cx="16" cy="16" r="1.5" fill="currentColor" fillOpacity="0.6" />
              <circle cx="12" cy="20" r="1" fill="currentColor" fillOpacity="0.5" />
              {/* Network connections */}
              <path
                d="M20 12 L16 16 L12 20"
                stroke="currentColor"
                strokeWidth="1"
                strokeOpacity="0.4"
              />
            </svg>
          </div>
          <div className="flex flex-col -space-y-1">
            <h1 className="text-sm sm:text-lg font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
              <span className="hidden sm:inline">DArk Modeler</span>
              <span className="sm:hidden">DArk</span>
            </h1>
            <p className="text-xs text-muted-foreground font-medium hidden md:block">
              AI-Powered Data Architecture
            </p>
          </div>
        </div>

        {/* Model Selector - hidden on mobile */}
        <div className="hidden sm:block ml-2 sm:ml-4 lg:ml-8">
          <ModelSelector />
        </div>

        {/* Layer Navigator - hidden on smaller screens */}
        {currentModel && (
          <div className="hidden sm:block ml-2 sm:ml-4 lg:ml-8">
            <LayerNavigator />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1 lg:space-x-3 min-w-0 flex-shrink-0">
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

        {/* Add Model Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setShowAddModelModal(true)}
              variant="outline"
              size="sm"
              className="font-medium touch-target shadow-soft hover:shadow-medium transition-all duration-200"
            >
              <Plus className="w-4 h-4 mr-1 lg:mr-2" />
              <span className="hidden sm:inline">New Model</span>
              <span className="sm:hidden">New</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Create a new data model</p>
          </TooltipContent>
        </Tooltip>

        {/* Export Button */}
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

        {/* Data Models List Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleModelsClick}
              variant="outline"
              size="sm"
              className="font-medium touch-target shadow-soft hover:shadow-medium transition-all duration-200"
            >
              <Layers3 className="w-4 h-4 mr-1 lg:mr-2" />
              <span className="hidden lg:inline">Models</span>
              <span className="lg:hidden">List</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Go to data models list</p>
          </TooltipContent>
        </Tooltip>

        {/* Systems Management Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleSystemsClick}
              variant="outline"
              size="sm"
              className="font-medium touch-target shadow-soft hover:shadow-medium transition-all duration-200"
            >
              <Server className="w-4 h-4 mr-1 lg:mr-2" />
              <span className="hidden lg:inline">Systems</span>
              <span className="lg:hidden">Sys</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Manage systems and sync objects</p>
          </TooltipContent>
        </Tooltip>

        {/* Configuration Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleConfigurationClick}
              variant="outline"
              size="sm"
              className="font-medium touch-target shadow-soft hover:shadow-medium transition-all duration-200 flex-shrink-0"
            >
              <Settings className="w-4 h-4 mr-1 lg:mr-2" />
              <span className="hidden sm:inline">Config</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>System configuration and settings</p>
          </TooltipContent>
        </Tooltip>

        {/* Reports Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleReportsClick}
              variant="outline"
              size="sm"
              className="font-medium touch-target shadow-soft hover:shadow-medium transition-all duration-200 flex-shrink-0"
            >
              <BarChart3 className="w-4 h-4 mr-1 lg:mr-2" />
              <span className="hidden sm:inline">Reports</span>
              <span className="sm:hidden">Reports</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View generated insights and reports</p>
          </TooltipContent>
        </Tooltip>

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>

        <AddDataModelModal
          open={showAddModelModal}
          onOpenChange={setShowAddModelModal}
        />
      </header>
    </TooltipProvider>
  );
}
