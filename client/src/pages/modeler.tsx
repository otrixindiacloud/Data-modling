import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useModelerStore } from "@/store/modelerStore";
import TopNavBar from "@/components/TopNavBar";
import ImprovedCollapsibleDataExplorer from "@/components/ImprovedCollapsibleDataExplorer";
import Canvas from "@/components/Canvas";
import EnhancedPropertiesPanel from "@/components/EnhancedPropertiesPanel";
import UXFixesManager from "@/components/UXFixesManager";
import ExportModal from "@/components/modals/ExportModal";
import AddDataSourceModal from "@/components/modals/AddDataSourceModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings, Menu, Database, ChevronRight } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { usePanelWidths } from "@/hooks/usePanelWidths";

export default function ModelerPage() {
  const { 
    setDomains, 
    setDataSources, 
    currentModel, 
    setCurrentModel, 
    currentLayer, 
    setCurrentLayer 
  } = useModelerStore();
  const [showMobileProperties, setShowMobileProperties] = useState(false);
  const [showMobileDataSources, setShowMobileDataSources] = useState(false);
  const [dataExplorerCollapsed, setDataExplorerCollapsed] = useState(false);
  const { widths, updateWidths } = usePanelWidths();

  // Load domains
  const { data: domains } = useQuery({
    queryKey: ["/api/domains"],
  });

  // Load data sources
  const { data: dataSources } = useQuery({
    queryKey: ["/api/sources"],
  });

  // Load models and set the first one as current if none selected
  const { data: models } = useQuery({
    queryKey: ["/api/models"],
  });

  useEffect(() => {
    if (domains && Array.isArray(domains)) {
      setDomains(domains);
    }
  }, [domains, setDomains]);

  useEffect(() => {
    if (dataSources && Array.isArray(dataSources)) {
      setDataSources(dataSources);
    }
  }, [dataSources, setDataSources]);

  useEffect(() => {
    if (models && Array.isArray(models) && models.length > 0 && !currentModel) {
      // Find the first conceptual model (parent model) to set as current
      const conceptualModels = models.filter((model: any) => 
        model.layer === "conceptual" && (model.parentModelId === null || model.parentModelId === undefined)
      );
      
      if (conceptualModels.length > 0) {
        setCurrentModel(conceptualModels[0]);
      } else {
        setCurrentModel(models[0]);
      }
    }
  }, [models, currentModel, setCurrentModel]);

  // Listen for double-click events to open properties panel
  useEffect(() => {
    const handleOpenMobileProperties = (event: CustomEvent) => {
      if (event.detail?.nodeId) {
        // On screens smaller than xl (1280px), use the slide-out sheet
        if (window.innerWidth < 1280) {
          setShowMobileProperties(true);
        }
        // On desktop xl+ screens, properties panel is always visible (no action needed)
      }
    };

    window.addEventListener('openMobileProperties', handleOpenMobileProperties as EventListener);
    return () => {
      window.removeEventListener('openMobileProperties', handleOpenMobileProperties as EventListener);
    };
  }, []);

  const handleToggleDataExplorer = () => {
    setDataExplorerCollapsed(!dataExplorerCollapsed);
  };

  const handleLayerChange = (layer: "conceptual" | "logical" | "physical") => {
    setCurrentLayer(layer);
    console.log("Layer changed to:", layer);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <TopNavBar />
      
      
      <div className="flex-1 min-h-0 relative">
        {/* Desktop layout with resizable panels - xl screens (3 panels) */}
        <div className="hidden xl:flex h-full">
          <PanelGroup direction="horizontal" onLayout={(sizes) => {
            const [dataExplorer, canvas, properties] = sizes;
            updateWidths({ 
              dataExplorer: dataExplorer || (dataExplorerCollapsed ? 4 : 25), 
              canvas: canvas || 50, 
              properties: properties || 25 
            });
          }}>
            {/* Data Explorer Panel */}
            <Panel 
              defaultSize={dataExplorerCollapsed ? 4 : widths.dataExplorer} 
              minSize={dataExplorerCollapsed ? 4 : 15} 
              maxSize={dataExplorerCollapsed ? 6 : 40}
            >
              <ImprovedCollapsibleDataExplorer 
                isCollapsed={dataExplorerCollapsed}
                onToggleCollapse={handleToggleDataExplorer}
              />
            </Panel>
            
            {/* Resize Handle */}
            {!dataExplorerCollapsed && (
              <PanelResizeHandle className="w-1 bg-border hover:bg-border/80 transition-colors cursor-col-resize flex items-center justify-center group">
                <div className="w-0.5 h-8 bg-border/60 group-hover:bg-border transition-colors rounded-full" />
              </PanelResizeHandle>
            )}
            
            {/* Main Canvas Panel */}
            <Panel defaultSize={widths.canvas} minSize={30}>
              <div className="relative h-full w-full overflow-hidden">
                <div className="h-full w-full">
                  <Canvas />
                </div>
              </div>
            </Panel>
            
            {/* Resize Handle */}
            <PanelResizeHandle className="w-1 bg-border hover:bg-border/80 transition-colors cursor-col-resize flex items-center justify-center group">
              <div className="w-0.5 h-8 bg-border/60 group-hover:bg-border transition-colors rounded-full" />
            </PanelResizeHandle>
            
            {/* Properties Panel */}
            <Panel defaultSize={widths.properties} minSize={15} maxSize={35}>
              <EnhancedPropertiesPanel />
            </Panel>
          </PanelGroup>
        </div>

        {/* Desktop layout with resizable panels - lg to xl screens (2 panels + collapsible data explorer) */}
        <div className="hidden lg:flex xl:hidden h-full">
          <PanelGroup direction="horizontal" onLayout={(sizes) => {
            const [dataExplorer, canvas] = sizes;
            updateWidths({ 
              dataExplorer: dataExplorer || (dataExplorerCollapsed ? 4 : 30), 
              canvas: canvas || 70, 
              properties: widths.properties 
            });
          }}>
            {/* Data Explorer Panel */}
            <Panel 
              defaultSize={dataExplorerCollapsed ? 4 : 30} 
              minSize={dataExplorerCollapsed ? 4 : 15} 
              maxSize={dataExplorerCollapsed ? 6 : 40}
            >
              <ImprovedCollapsibleDataExplorer 
                isCollapsed={dataExplorerCollapsed}
                onToggleCollapse={handleToggleDataExplorer}
              />
            </Panel>
            
            {/* Resize Handle */}
            {!dataExplorerCollapsed && (
              <PanelResizeHandle className="w-1 bg-border hover:bg-border/80 transition-colors cursor-col-resize flex items-center justify-center group">
                <div className="w-0.5 h-8 bg-border/60 group-hover:bg-border transition-colors rounded-full" />
              </PanelResizeHandle>
            )}
            
            {/* Main Canvas Panel */}
            <Panel defaultSize={70} minSize={60}>
              <div className="relative h-full w-full overflow-hidden">
                <div className="h-full w-full">
                  <Canvas />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {/* Mobile layout - smaller than lg breakpoint */}
        <div className="lg:hidden h-full flex flex-col">
          {/* Mobile Quick Actions Bar */}
          <div className="bg-card border-b border-border p-2 flex items-center justify-between shadow-soft">
            <div className="flex items-center space-x-2">
              <Sheet open={showMobileDataSources} onOpenChange={setShowMobileDataSources}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="touch-target"
                  onClick={() => setShowMobileDataSources(true)}
                  data-testid="button-mobile-data-sources"
                >
                  <Database className="w-4 h-4 mr-1" />
                  <span className="text-xs">Data</span>
                </Button>
                <SheetContent side="left" className="w-80 p-0 bg-background">
                  <SheetHeader className="p-4 border-b border-border bg-card">
                    <SheetTitle className="text-left">Data Sources</SheetTitle>
                  </SheetHeader>
                  <div className="h-full overflow-y-auto">
                    <ImprovedCollapsibleDataExplorer 
                      isCollapsed={false}
                      onToggleCollapse={() => {}}
                      onClose={() => setShowMobileDataSources(false)}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="touch-target"
                onClick={() => setShowMobileProperties(true)}
                data-testid="button-mobile-properties"
              >
                <Settings className="w-4 h-4 mr-1" />
                <span className="text-xs">Props</span>
              </Button>
            </div>
            
            {/* Layer indicator for mobile */}
            <div className="flex items-center space-x-1">
              <div className="bg-primary/10 px-2 py-1 rounded text-xs font-medium text-primary capitalize">
                {currentLayer}
              </div>
              {currentModel && (
                <div className="bg-secondary px-2 py-1 rounded text-xs font-medium text-secondary-foreground">
                  {currentModel.name}
                </div>
              )}
            </div>
          </div>
          
          
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full w-full">
              <Canvas />
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile properties panel - opened via double-click */}
      <div className="xl:hidden">
        <Sheet open={showMobileProperties} onOpenChange={setShowMobileProperties}>
          <SheetContent side="right" className="w-80 p-0 max-w-[90vw] sm:max-w-[400px] bg-background">
            <SheetHeader className="p-4 border-b border-border bg-card shadow-soft">
              <SheetTitle className="text-left">Properties</SheetTitle>
            </SheetHeader>
            <div className="h-full overflow-y-auto">
              <EnhancedPropertiesPanel onClose={() => setShowMobileProperties(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Modals */}
      <ExportModal />
      <AddDataSourceModal />
    </div>
  );
}