import React, { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useModelerStore } from "@/store/modelerStore";
import TopNavBar from "@/components/TopNavBar";
import DataObjectExplorer from "@/components/DataObjectExplorer";
import Canvas from "@/components/Canvas";
import EnhancedPropertiesPanel from "@/components/EnhancedPropertiesPanel";
import UXFixesManager from "@/components/UXFixesManager";
import ExportModal from "@/components/modals/ExportModal";
import AddDataSourceModal from "@/components/modals/AddDataSourceModal";
import AddDataObjectModal from "@/components/modals/AddDataObjectModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings, Menu, Database, ChevronRight } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { usePanelWidths } from "@/hooks/usePanelWidths";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ImprovedModelPicker from "@/components/ImprovedModelPicker";
import { Badge } from "@/components/ui/badge";
import { useRoute } from "wouter";
import type { DataModel } from "@shared/schema";
import type { ModelLayer } from "@/types/modeler";

const modelSharesRoot = (
  model: DataModel | null,
  rootCandidate: DataModel,
  allModels: DataModel[]
) => {
  if (!model) return false;
  if (model.id === rootCandidate.id) return true;

  const visited = new Set<number>();
  let pointer: DataModel | null | undefined = model;

  while (pointer?.parentModelId) {
    if (visited.has(pointer.parentModelId)) {
      break;
    }

    visited.add(pointer.parentModelId);
    const parent = allModels.find((m) => m.id === pointer?.parentModelId) ?? null;

    if (!parent) {
      break;
    }

    if (parent.id === rootCandidate.id) {
      return true;
    }

    pointer = parent;
  }

  return false;
};

export default function ModelerPage() {
  const {
    setDomains,
    setDataAreas,
    setDataSources,
    setAllModels,
    currentModel,
    setCurrentModel,
    currentLayer,
    setCurrentLayer
  } = useModelerStore();
  const [matchModelRoute, routeParams] = useRoute<{ modelId: string }>("/modeler/:modelId");
  const [showMobileProperties, setShowMobileProperties] = useState(false);
  const [showMobileDataSources, setShowMobileDataSources] = useState(false);
  const [dataExplorerCollapsed, setDataExplorerCollapsed] = useState(false);
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false);
  const [showAddObjectModal, setShowAddObjectModal] = useState(false);
  const { widths, updateWidths } = usePanelWidths();
  const [showModelRequiredModal, setShowModelRequiredModal] = useState(false);
  const [modelRequiredMessage, setModelRequiredMessage] = useState<string | null>(null);

  // Load domains
  const { data: domains } = useQuery({
    queryKey: ["/api/domains"],
  });

  // Load data sources
  const { data: dataSources } = useQuery({
    queryKey: ["/api/sources"],
  });

  // Load data areas
  const { data: dataAreas } = useQuery({
    queryKey: ["/api/areas"],
    queryFn: async () => {
      const response = await fetch("/api/areas");
      if (!response.ok) {
        throw new Error("Failed to load data areas");
      }
      const areas = await response.json();
      return Array.isArray(areas) ? areas : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Load models and set the first one as current if none selected
  const { data: models } = useQuery({
    queryKey: ["/api/models"],
  });

  const conceptualModels = useMemo(() => {
    if (!Array.isArray(models)) return [];
    return models.filter((model: any) =>
      model.layer === "conceptual" &&
      (model.parentModelId === null || model.parentModelId === undefined)
    );
  }, [models]);

  const hasAppliedPendingLayer = useRef(false);

  useEffect(() => {
    if (hasAppliedPendingLayer.current) return;
    if (typeof window === "undefined") return;
    if (!Array.isArray(models) || models.length === 0) return;

    const pendingLayer = window.sessionStorage.getItem("modeler:pendingLayer") as ModelLayer | null;
    if (!pendingLayer) {
      hasAppliedPendingLayer.current = true;
      return;
    }

    const validLayers: ModelLayer[] = ["conceptual", "logical", "physical"];
    if (!validLayers.includes(pendingLayer)) {
      window.sessionStorage.removeItem("modeler:pendingLayer");
      window.sessionStorage.removeItem("modeler:pendingModelId");
      hasAppliedPendingLayer.current = true;
      return;
    }

    const pendingModelId = window.sessionStorage.getItem("modeler:pendingModelId");
    window.sessionStorage.removeItem("modeler:pendingLayer");
    window.sessionStorage.removeItem("modeler:pendingModelId");

    const typedModels = models as DataModel[];
    const targetModel = pendingModelId ? typedModels.find((model) => model.id === Number(pendingModelId)) ?? null : null;

    if (targetModel) {
      setCurrentModel(targetModel);
    }

    setCurrentLayer(pendingLayer);

    hasAppliedPendingLayer.current = true;
  }, [models, setCurrentLayer, setCurrentModel]);

  useEffect(() => {
    if (!matchModelRoute || !routeParams?.modelId || !Array.isArray(models) || models.length === 0) {
      return;
    }

    const decodedParam = decodeURIComponent(routeParams.modelId);
    const numericId = Number(decodedParam);
    const typedModels = models as DataModel[];

    let targetModel: DataModel | undefined;

    if (!Number.isNaN(numericId)) {
      targetModel = typedModels.find((model) => model.id === numericId);
    }

    if (!targetModel) {
      targetModel = typedModels.find(
        (model) => model.name.toLowerCase() === decodedParam.toLowerCase()
      );
    }

    if (targetModel) {
      const typedModelsList = typedModels;
      const isSameFamily = modelSharesRoot(currentModel, targetModel, typedModelsList);

      if (!currentModel || !isSameFamily) {
        setCurrentModel(targetModel);
      }
    }
  }, [matchModelRoute, routeParams, models, currentModel, setCurrentModel]);

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
    if (models && Array.isArray(models) && models.length > 0) {
      setAllModels(models);

      // Find the first conceptual model (parent model) to set as current
      if (!currentModel) {
        if (conceptualModels.length > 0) {
          setCurrentModel(conceptualModels[0]);
        }
      }
    }
  }, [models, conceptualModels, currentModel, setCurrentModel, setAllModels]);

  useEffect(() => {
    if (dataAreas && Array.isArray(dataAreas)) {
      setDataAreas(dataAreas);
    }
  }, [dataAreas, setDataAreas]);

  useEffect(() => {
    if (Array.isArray(models) && models.length > 0) {
      setShowModelRequiredModal(!currentModel);
    }
  }, [models, currentModel]);

  useEffect(() => {
    const handleModelRequired = (event: CustomEvent) => {
      setModelRequiredMessage(event.detail?.message ?? null);
      setShowModelRequiredModal(true);
    };

    window.addEventListener("modelRequired", handleModelRequired as EventListener);
    return () => {
      window.removeEventListener("modelRequired", handleModelRequired as EventListener);
    };
  }, []);

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

  // Listen for Add Data Object modal trigger from Canvas
  useEffect(() => {
    const handleOpenAddObjectModal = () => {
      setShowAddObjectModal(true);
    };

    window.addEventListener('openAddObjectModalConfirmed', handleOpenAddObjectModal);
    return () => {
      window.removeEventListener('openAddObjectModalConfirmed', handleOpenAddObjectModal);
    };
  }, []);

  const handleToggleDataExplorer = () => {
    setDataExplorerCollapsed(!dataExplorerCollapsed);
  };

  const handleToggleProperties = () => {
    setPropertiesCollapsed((prev) => !prev);
  };

  const handleLayerChange = (layer: "conceptual" | "logical" | "physical") => {
    setCurrentLayer(layer);
    console.log("Layer changed to:", layer);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background min-h-0">
      <TopNavBar />
      
      
      <div className="flex-1 min-h-0 relative">
  <Dialog open={showModelRequiredModal} onOpenChange={setShowModelRequiredModal} modal>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Select a model to get started</DialogTitle>
              <DialogDescription>
                {modelRequiredMessage || "Choose a conceptual model to unlock canvas editing. You can switch layers later."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Available models
                </p>
                {conceptualModels.length === 0 ? (
                  <div className="rounded-md border bg-muted/10 p-4 text-sm text-muted-foreground">
                    No conceptual models found. Create one from the top bar.
                  </div>
                ) : (
                  <ImprovedModelPicker
                    compact={false}
                    onCreateNew={() => window.dispatchEvent(new CustomEvent("openAddModelModal"))}
                  />
                )}
              </div>
              <div className="rounded-md border bg-muted/10 p-4 text-xs text-muted-foreground">
                <p className="font-medium flex items-center gap-2 text-sm">
                  <Badge variant="secondary">Why required?</Badge>
                  Layers share a conceptual parent and depend on it for context.
                </p>
                <p className="mt-2">
                  Selecting a conceptual model ensures objects are saved to the correct logical and physical layers.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

    {/* Desktop layout with resizable panels - xl screens (3 panels) */}
    <div className="hidden xl:flex h-full w-full">
          <PanelGroup
            direction="horizontal"
            className="flex-1 min-h-0"
            onLayout={(sizes) => {
              const [dataExplorer, canvas, properties] = sizes;
              updateWidths({
                dataExplorer: dataExplorer || (dataExplorerCollapsed ? 4 : 25),
                canvas: canvas || 50,
                properties: propertiesCollapsed
                  ? widths.properties
                  : properties || widths.properties || 25
              });
            }}
          >
            {/* Data Explorer Panel */}
            <Panel 
              id="desktop-data-explorer"
              order={1}
              defaultSize={dataExplorerCollapsed ? 4 : widths.dataExplorer} 
              minSize={dataExplorerCollapsed ? 4 : 15} 
              maxSize={dataExplorerCollapsed ? 6 : 40}
              className="flex min-h-0 h-full max-h-screen"
            >
              <div className="flex-1 min-h-0 flex h-full max-h-screen">
                <DataObjectExplorer 
                  isCollapsed={dataExplorerCollapsed}
                  onToggleCollapse={handleToggleDataExplorer}
                />
              </div>
            </Panel>
            
            {/* Resize Handle */}
            {!dataExplorerCollapsed && (
              <PanelResizeHandle className="w-1 bg-border hover:bg-border/80 transition-colors cursor-col-resize flex items-center justify-center group">
                <div className="w-0.5 h-8 bg-border/60 group-hover:bg-border transition-colors rounded-full" />
              </PanelResizeHandle>
            )}
            
            {/* Main Canvas Panel */}
            <Panel id="desktop-modeler-canvas" order={2} defaultSize={widths.canvas} minSize={30} className="h-full overflow-hidden">
                <Canvas />
            </Panel>
            
            {/* Resize Handle */}
            {!propertiesCollapsed && (
              <PanelResizeHandle className="w-1 bg-border hover:bg-border/80 transition-colors cursor-col-resize flex items-center justify-center group">
                <div className="w-0.5 h-8 bg-border/60 group-hover:bg-border transition-colors rounded-full" />
              </PanelResizeHandle>
            )}

            {/* Properties Panel */}
            <Panel
              id="desktop-properties-panel"
              order={3}
              defaultSize={propertiesCollapsed ? 4 : widths.properties}
              minSize={propertiesCollapsed ? 4 : 15}
              maxSize={propertiesCollapsed ? 6 : 35}
              className="min-h-0"
            >
              <div className="h-full w-full min-h-0 flex flex-col overflow-hidden">
                <EnhancedPropertiesPanel
                  isCollapsed={propertiesCollapsed}
                  onToggleCollapse={handleToggleProperties}
                />
              </div>
            </Panel>
          </PanelGroup>
        </div>

    {/* Desktop layout with resizable panels - lg to xl screens (2 panels + collapsible data explorer) */}
    <div className="hidden lg:flex xl:hidden h-full w-full">
          <PanelGroup direction="horizontal" className="flex-1 min-h-0" onLayout={(sizes) => {
            const [dataExplorer, canvas] = sizes;
            updateWidths({ 
              dataExplorer: dataExplorer || (dataExplorerCollapsed ? 4 : 30), 
              canvas: canvas || 70, 
              properties: widths.properties 
            });
          }}>
            {/* Data Explorer Panel */}
            <Panel 
              id="compact-data-explorer"
              order={1}
              defaultSize={dataExplorerCollapsed ? 4 : 30} 
              minSize={dataExplorerCollapsed ? 4 : 15} 
              maxSize={dataExplorerCollapsed ? 6 : 40}
              className="flex min-h-0"
            >
              <div className="flex-1 min-h-0 flex">
                <DataObjectExplorer 
                  isCollapsed={dataExplorerCollapsed}
                  onToggleCollapse={handleToggleDataExplorer}
                />
              </div>
            </Panel>
            
            {/* Resize Handle */}
            {!dataExplorerCollapsed && (
              <PanelResizeHandle className="w-1 bg-border hover:bg-border/80 transition-colors cursor-col-resize flex items-center justify-center group">
                <div className="w-0.5 h-8 bg-border/60 group-hover:bg-border transition-colors rounded-full" />
              </PanelResizeHandle>
            )}
            
            {/* Main Canvas Panel */}
            <Panel id="compact-modeler-canvas" order={2} defaultSize={70} minSize={60} className="min-h-0 flex">
              <div className="relative flex-1 h-full overflow-hidden">
                <Canvas />
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
                  <div className="h-full overflow-hidden">
                    <DataObjectExplorer 
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
            <div className="h-full overflow-hidden">
              <EnhancedPropertiesPanel onClose={() => setShowMobileProperties(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Modals */}
      <ExportModal />
      <AddDataSourceModal />
      <AddDataObjectModal 
        open={showAddObjectModal} 
        onOpenChange={setShowAddObjectModal}
      />
    </div>
  );
}