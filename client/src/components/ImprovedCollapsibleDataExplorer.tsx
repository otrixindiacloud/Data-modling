import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Table,
  Folder,
  Plus,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Server,
  FileText,
  Search,
  Maximize2,
  Minimize2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useModelerStore } from "@/store/modelerStore";
import { useToast } from "@/hooks/use-toast";
import type { DataDomain, DataObject, DataArea, DataModel } from "@shared/schema";
import { getSystemColor, getSystemColorBg, getSystemColorText } from "@/lib/systemColors";

interface ImprovedCollapsibleDataExplorerProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void;
}

export default function ImprovedCollapsibleDataExplorer({ 
  isCollapsed, 
  onToggleCollapse, 
  onClose 
}: ImprovedCollapsibleDataExplorerProps) {
  const { currentModel, currentLayer, selectedObjectId, selectObject, selectNode } = useModelerStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("objects");
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [selectedDataArea, setSelectedDataArea] = useState("all");
  const [selectedSystem, setSelectedSystem] = useState("all");
  const [selectedLayer, setSelectedLayer] = useState("all");
  
  // UI states
  const [expandedDomains, setExpandedDomains] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch domains
  const { data: domains = [] } = useQuery({
    queryKey: ["/api/domains"],
    queryFn: async () => {
      const response = await fetch("/api/domains");
      return response.json();
    }
  });

  // Fetch data areas
  const { data: allDataAreas = [] } = useQuery({
    queryKey: ["/api/data-areas"],
    queryFn: async () => {
      const response = await fetch("/api/data-areas");
      return response.json();
    }
  });

  // Fetch all data objects with enhanced data and deduplication
  const { data: allDataObjects = [], refetch: refetchObjects, isLoading: objectsLoading } = useQuery({
    queryKey: ["/api/objects", "enhanced", lastRefresh.getTime()],
    queryFn: async () => {
      const [objectsResponse, systemsResponse, modelsResponse] = await Promise.all([
        fetch("/api/objects"),
        fetch("/api/systems"),
        fetch("/api/models")
      ]);
      
      const objects = await objectsResponse.json();
      const systemsData = await systemsResponse.json();
      const modelsData = await modelsResponse.json();
      
      // Create system lookup map with proper type safety
      const systemsMap = new Map(systemsData.map((sys: any) => [sys.id, sys]));
      
      // Create model lookup map
      const modelsMap = new Map(modelsData.map((model: any) => [model.id, model]));
      
      // Remove duplicates and enhance with system data
      const uniqueObjects = new Map();
      objects.forEach((obj: DataObject) => {
        if (!uniqueObjects.has(obj.id)) {
          const sourceSystemData = obj.sourceSystemId ? systemsMap.get(obj.sourceSystemId) : null;
          const targetSystemData = obj.targetSystemId ? systemsMap.get(obj.targetSystemId) : null;
          const modelData = obj.modelId ? modelsMap.get(obj.modelId) : null;
          
          uniqueObjects.set(obj.id, {
            ...obj,
            sourceSystem: (sourceSystemData as any)?.name || null,
            targetSystem: (targetSystemData as any)?.name || null,
            sourceSystemData,
            targetSystemData,
            modelData,
            layer: (modelData as any)?.layer || "unknown"
          });
        }
      });
      
      return Array.from(uniqueObjects.values());
    },
    staleTime: 5000, // Cache for 5 seconds to reduce duplicate requests
    refetchInterval: false
  });

  // Fetch attributes with real-time counts
  const { data: allAttributes = [], refetch: refetchAttributes, isLoading: attributesLoading } = useQuery({
    queryKey: ["/api/attributes", lastRefresh.getTime()],
    queryFn: async () => {
      try {
        const response = await fetch("/api/attributes");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Ensure we always return an array
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching attributes:', error);
        return []; // Return empty array on error
      }
    },
    staleTime: 5000, // Cache for 5 seconds to reduce duplicate requests
    refetchInterval: false
  });

  // Create accurate attribute count map
  const attributeCounts = useMemo(() => {
    const counts = new Map<number, number>();
    
    // Ensure allAttributes is an array before calling forEach
    if (Array.isArray(allAttributes)) {
      allAttributes.forEach((attr: any) => {
        const count = counts.get(attr.objectId) || 0;
        counts.set(attr.objectId, count + 1);
      });
    } else {
      console.warn('allAttributes is not an array:', allAttributes);
    }
    
    return counts;
  }, [allAttributes]);

  // Filtered objects with improved filtering and layer awareness
  const filteredObjects = useMemo(() => {
    let filtered = allDataObjects;

    // Filter by selected layer if specified
    if (selectedLayer && selectedLayer !== "all") {
      filtered = filtered.filter((obj: any) => obj.layer === selectedLayer);
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((obj: any) =>
        obj.name.toLowerCase().includes(searchLower) ||
        (obj.sourceSystem && obj.sourceSystem.toLowerCase().includes(searchLower)) ||
        (obj.targetSystem && obj.targetSystem.toLowerCase().includes(searchLower)) ||
        (obj.description && obj.description.toLowerCase().includes(searchLower)) ||
        (obj.layer && obj.layer.toLowerCase().includes(searchLower))
      );
    }

    if (selectedDomain && selectedDomain !== "all") {
      const domainId = parseInt(selectedDomain);
      filtered = filtered.filter((obj: DataObject) => obj.domainId === domainId);
    }

    if (selectedDataArea && selectedDataArea !== "all") {
      const areaId = parseInt(selectedDataArea);
      filtered = filtered.filter((obj: DataObject) => obj.dataAreaId === areaId);
    }

    if (selectedSystem && selectedSystem !== "all") {
      filtered = filtered.filter((obj: any) =>
        (obj.sourceSystem && obj.sourceSystem.toLowerCase().includes(selectedSystem.toLowerCase())) ||
        (obj.targetSystem && obj.targetSystem.toLowerCase().includes(selectedSystem.toLowerCase()))
      );
    }

    return filtered.sort((a, b) => {
      // Sort by layer first, then by name
      if (a.layer !== b.layer) {
        const layerOrder = { conceptual: 0, logical: 1, physical: 2 };
        return (layerOrder[a.layer as keyof typeof layerOrder] || 3) - (layerOrder[b.layer as keyof typeof layerOrder] || 3);
      }
      return a.name.localeCompare(b.name);
    });
  }, [allDataObjects, searchTerm, selectedDomain, selectedDataArea, selectedSystem, selectedLayer]);

  // System options for filtering
  const uniqueSystems = useMemo(() => {
    const systemsSet = new Set<string>();
    allDataObjects.forEach((obj: any) => {
      if (obj.sourceSystem) systemsSet.add(obj.sourceSystem);
      if (obj.targetSystem) systemsSet.add(obj.targetSystem);
    });
    return Array.from(systemsSet).sort();
  }, [allDataObjects]);

  // Helper functions
  const getDomainName = (domainId: number | null) => {
    if (!domainId) return "Unknown";
    return domains.find((d: DataDomain) => d.id === domainId)?.name || "Unknown";
  };

  const getAreaName = (areaId: number | null) => {
    if (!areaId) return "Unknown";
    return allDataAreas.find((a: DataArea) => a.id === areaId)?.name || "Unknown";
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDomain("all");
    setSelectedDataArea("all");
    setSelectedSystem("all");
    setSelectedLayer("all");
  };

  const toggleDomain = (domainId: number) => {
    setExpandedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(domainId)) {
        newSet.delete(domainId);
      } else {
        newSet.add(domainId);
      }
      return newSet;
    });
  };

  // Manual refresh function with forced cache invalidation
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      // Force complete cache invalidation
      await queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/attributes"] });
      
      // Wait a moment then trigger fresh fetches
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setLastRefresh(new Date());
      
      // Trigger fresh data fetches
      await Promise.all([
        refetchObjects(),
        refetchAttributes()
      ]);
      
      console.log('Data Explorer refreshed with fresh data');
    } finally {
      setRefreshing(false);
    }
  }, [refetchObjects, refetchAttributes, queryClient]);

  // Auto-refresh when model changes and listen for object creation/updates
  useEffect(() => {
    if (currentModel) {
      handleRefresh();
    }
  }, [currentModel, handleRefresh]);

  // Listen for object creation and updates to auto-refresh
  useEffect(() => {
    const handleObjectCreated = (event: CustomEvent) => {
      console.log('Object created, refreshing Data Explorer:', event.detail);
      setTimeout(() => {
        handleRefresh();
      }, 500); // Small delay to ensure DB update is complete
    };

    const handleObjectUpdated = (event: CustomEvent) => {
      console.log('Object updated, refreshing Data Explorer:', event.detail);
      setTimeout(() => {
        handleRefresh();
      }, 300);
    };

    const handleAttributeChanged = (event: CustomEvent) => {
      console.log('Attribute changed, refreshing counts:', event.detail);
      setTimeout(() => {
        refetchAttributes();
      }, 200);
    };

    window.addEventListener('objectCreated', handleObjectCreated as EventListener);
    window.addEventListener('objectUpdated', handleObjectUpdated as EventListener);
    window.addEventListener('attributeCreated', handleAttributeChanged as EventListener);
    window.addEventListener('attributeUpdated', handleAttributeChanged as EventListener);
    window.addEventListener('attributeDeleted', handleAttributeChanged as EventListener);
    
    return () => {
      window.removeEventListener('objectCreated', handleObjectCreated as EventListener);
      window.removeEventListener('objectUpdated', handleObjectUpdated as EventListener);
      window.removeEventListener('attributeCreated', handleAttributeChanged as EventListener);
      window.removeEventListener('attributeUpdated', handleAttributeChanged as EventListener);
      window.removeEventListener('attributeDeleted', handleAttributeChanged as EventListener);
    };
  }, [handleRefresh, refetchAttributes]);

  // Enhanced object selection with immediate feedback
  const handleObjectSelect = useCallback((obj: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Visual feedback
    const target = e.currentTarget as HTMLElement;
    target.style.transform = 'scale(0.98)';
    setTimeout(() => {
      target.style.transform = '';
    }, 100);

    // Clear previous selections first
    selectNode(null);
    selectObject(null);
    
    // Set new selection with proper state sync
    setTimeout(() => {
      selectObject(obj.id);
      
      // Force properties panel update
      window.dispatchEvent(new CustomEvent('objectSelected', {
        detail: { objectId: obj.id, forceUpdate: true }
      }));
      
      console.log(`Explorer object selected: ${obj.name} (ID: ${obj.id})`);
    }, 10);
  }, [selectObject, selectNode]);

  // Enhanced drag start with model validation and layer awareness
  const handleDragStart = useCallback((e: React.DragEvent, obj: any) => {
    if (!currentModel) {
      e.preventDefault();
      // Visual feedback for no model
      const target = e.currentTarget as HTMLElement;
      target.style.borderColor = '#ef4444';
      setTimeout(() => {
        target.style.borderColor = '';
      }, 1000);
      return;
    }

    // Get all models to find the correct layer model
    const allModels = (window as any).__allModels || [];
    const modelFamily = allModels.filter((model: any) => 
      model.parentModelId === currentModel.id || model.id === currentModel.id
    );
    
    const layerModel = modelFamily.find((m: any) => m.layer === currentLayer) || currentModel;

    const dragData = JSON.stringify({
      type: 'data-object',
      object: {
        ...obj,
        currentLayer: currentLayer,
        layerModelId: layerModel?.id,
        domainName: getDomainName(obj.domainId),
        dataAreaName: getAreaName(obj.dataAreaId)
      }
    });
    e.dataTransfer.setData('application/json', dragData);
    e.dataTransfer.effectAllowed = 'copy';
  }, [currentModel, currentLayer, getDomainName, getAreaName]);

  // Group areas by domain for the domains tab
  const areasByDomain = useMemo(() => {
    const groups: Record<number, { domain: DataDomain; areas: DataArea[] }> = {};
    
    allDataAreas.forEach((area: DataArea) => {
      const domain = domains.find((d: DataDomain) => d.id === area.domainId);
      if (domain) {
        if (!groups[domain.id]) {
          groups[domain.id] = { domain, areas: [] };
        }
        groups[domain.id].areas.push(area);
      }
    });
    
    return groups;
  }, [allDataAreas, domains]);

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-2 border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="w-full h-8 p-0"
            title="Expand Data Explorer"
            data-testid="button-expand-data-explorer"
          >
            <Database className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center space-y-2 p-1">
          <div className="text-xs text-muted-foreground text-center">
            {filteredObjects.length}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-8 h-8 p-0"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header with improved controls */}
      <div className="p-3 border-b border-sidebar-border bg-sidebar-header">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-sidebar-foreground flex items-center">
            <Database className="h-4 w-4 mr-2" />
            Data Explorer
          </h2>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-6 w-6 p-0"
              title="Refresh data"
              data-testid="button-refresh-data"
            >
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-6 w-6 p-0"
              title="Collapse"
              data-testid="button-collapse-data-explorer"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0"
                title="Close"
                data-testid="button-close-data-explorer"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filteredObjects.length} of {allDataObjects.length} objects
          </span>
          <span className={cn(
            "px-2 py-1 rounded",
            currentModel ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {currentModel ? "Model Active" : "No Model"}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 m-3 mb-0">
            <TabsTrigger value="objects" className="text-xs" data-testid="tab-objects">
              <Table className="h-3 w-3 mr-1" />
              Objects
            </TabsTrigger>
            <TabsTrigger value="domains" className="text-xs" data-testid="tab-domains">
              <Folder className="h-3 w-3 mr-1" />
              Domains
            </TabsTrigger>
          </TabsList>

          <TabsContent value="objects" className="flex-1 flex flex-col min-h-0 px-3">
            {/* Enhanced Filters */}
            <div className="space-y-2 p-3 bg-sidebar-header/30 rounded-lg border border-sidebar-border/50 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-sidebar-foreground">Filters</span>
                </div>
                {(searchTerm || selectedDomain !== "all" || selectedDataArea !== "all" || selectedSystem !== "all" || selectedLayer !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="h-6 px-2 text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    data-testid="button-clear-filters"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {/* Enhanced Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search objects, systems, descriptions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-7 text-xs pl-7"
                    data-testid="input-search-objects"
                  />
                </div>

                {/* Improved Filter Selects */}
                <div className="grid grid-cols-1 gap-2">
                  <Select value={selectedLayer} onValueChange={setSelectedLayer}>
                    <SelectTrigger className="h-7 text-xs" data-testid="select-layer-filter">
                      <SelectValue placeholder="All Layers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Layers</SelectItem>
                      <SelectItem value="conceptual">Conceptual</SelectItem>
                      <SelectItem value="logical">Logical</SelectItem>
                      <SelectItem value="physical">Physical</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                    <SelectTrigger className="h-7 text-xs" data-testid="select-domain-filter">
                      <SelectValue placeholder="All Domains" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Domains</SelectItem>
                      {domains.map((domain: DataDomain) => (
                        <SelectItem key={domain.id} value={domain.id.toString()}>
                          {domain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedDataArea} onValueChange={setSelectedDataArea}>
                    <SelectTrigger className="h-7 text-xs" data-testid="select-area-filter">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {allDataAreas.map((area: DataArea) => (
                        <SelectItem key={area.id} value={area.id.toString()}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedSystem} onValueChange={setSelectedSystem}>
                    <SelectTrigger className="h-7 text-xs" data-testid="select-system-filter">
                      <SelectValue placeholder="All Systems" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Systems</SelectItem>
                      {uniqueSystems.map((system) => (
                        <SelectItem key={system} value={system}>
                          {system}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Objects List with improved UX */}
            <div className="flex-1 flex flex-col min-h-0">
              {(objectsLoading || attributesLoading) ? (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-xs text-muted-foreground">Loading...</span>
                </div>
              ) : filteredObjects.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="space-y-2 pb-4">
                    {filteredObjects.map((obj: any) => {
                      const systemBorderColor = getSystemColor(obj.sourceSystem || obj.targetSystem);
                      const systemBgColor = getSystemColorBg(obj.sourceSystem || obj.targetSystem);
                      const systemTextColor = getSystemColorText(obj.sourceSystem || obj.targetSystem);
                      const attributeCount = attributeCounts.get(obj.id) || 0;
                      const isSelected = selectedObjectId === obj.id;
                      
                      return (
                        <div 
                          key={obj.id} 
                          className={cn(
                            "relative bg-white dark:bg-card border rounded-lg p-3 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md border-l-4 touch-manipulation",
                            systemBorderColor,
                            isSelected && "ring-2 ring-primary ring-offset-1 bg-primary/5",
                            !currentModel && "opacity-60 cursor-not-allowed",
                            "hover:bg-gray-50 dark:hover:bg-sidebar-accent"
                          )}
                          draggable={!!currentModel}
                          onDragStart={(e) => handleDragStart(e, obj)}
                          onClick={(e) => handleObjectSelect(obj, e)}
                          data-testid={`card-object-${obj.id}`}
                        >
                          {/* Object Header with improved selection indication */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className={cn(
                                "text-sm font-medium truncate mb-1",
                                isSelected ? "text-primary" : "text-foreground"
                              )} title={obj.name}>
                                {obj.name}
                              </h3>
                              <div className="text-xs text-muted-foreground">
                                <span className={cn(
                                  "px-2 py-1 rounded",
                                  attributeCount > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                )}>
                                  {attributeCount} attribute{attributeCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                              {obj.isNew && (
                                <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200 px-1.5 py-0.5">
                                  New
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 w-6 p-0 text-xs border-primary/20 hover:bg-primary/5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!currentModel) {
                                    toast({
                                      title: "No Active Model",
                                      description: "Please select a data model first.",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                  
                                  console.log(`Adding object ${obj.name} to canvas via + button`);
                                  
                                  // Dispatch to canvas with proper coordinates
                                  const canvasElement = document.querySelector('[data-reactflow-wrapper]');
                                  if (canvasElement) {
                                    const rect = canvasElement.getBoundingClientRect();
                                    const dropEvent = new CustomEvent('touchDrop', {
                                      detail: {
                                        data: JSON.stringify({
                                          type: 'data-object',
                                          object: {
                                            ...obj,
                                            attributes: [], // Will be fetched from API
                                            domainName: getDomainName(obj.domainId),
                                            dataAreaName: getAreaName(obj.dataAreaId)
                                          }
                                        }),
                                        clientX: rect.left + rect.width / 2,
                                        clientY: rect.top + rect.height / 2,
                                        canvasX: rect.width / 2,
                                        canvasY: rect.height / 2
                                      }
                                    });
                                    canvasElement.dispatchEvent(dropEvent);
                                  }
                                }}
                                title={currentModel ? "Add to canvas" : "Select a model first"}
                                disabled={!currentModel}
                                data-testid={`button-add-object-${obj.id}`}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Layer, Domain and Area badges */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "text-xs px-1.5 py-0.5",
                                obj.layer === "conceptual" && "bg-blue-50 text-blue-700 border-blue-200",
                                obj.layer === "logical" && "bg-green-50 text-green-700 border-green-200",
                                obj.layer === "physical" && "bg-purple-50 text-purple-700 border-purple-200",
                                !obj.layer && "bg-gray-50 text-gray-700 border-gray-200"
                              )}
                            >
                              {obj.layer === "conceptual" && "📊"}
                              {obj.layer === "logical" && "🔗"}
                              {obj.layer === "physical" && "⚙️"}
                              {!obj.layer && "❓"}
                              <span className="ml-1 capitalize">{obj.layer || "Unknown"}</span>
                            </Badge>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 border-purple-200">
                              <Folder className="h-2.5 w-2.5 mr-0.5" />
                              {getDomainName(obj.domainId)}
                            </Badge>
                            {obj.dataAreaId && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-orange-50 text-orange-700 border-orange-200">
                                {getAreaName(obj.dataAreaId)}
                              </Badge>
                            )}
                          </div>
                          
                          {/* System Information */}
                          {(obj.sourceSystem || obj.targetSystem) && (
                            <div className="flex items-center text-xs" data-testid={`system-info-${obj.id}`}>
                              <Server className="h-2.5 w-2.5 mr-1 text-muted-foreground" />
                              <span className="text-muted-foreground mr-1">System:</span>
                              <span className={cn("font-medium px-1 py-0.5 rounded text-xs", systemTextColor, systemBgColor)}>
                                {obj.targetSystem || obj.sourceSystem}
                              </span>
                            </div>
                          )}

                          {/* Visual feedback for selection */}
                          {isSelected && (
                            <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none animate-pulse" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm mb-1">No objects found</p>
                  <p className="text-xs opacity-75">
                    {searchTerm || selectedDomain !== "all" || selectedDataArea !== "all" || selectedSystem !== "all"
                      ? "Try adjusting your filters"
                      : "No objects available in the current model"
                    }
                  </p>
                  {(searchTerm || selectedDomain !== "all" || selectedDataArea !== "all" || selectedSystem !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="mt-3 text-xs"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="domains" className="flex-1 px-3">
            <ScrollArea className="flex-1">
              <div className="space-y-3 pb-4">
                {Object.keys(areasByDomain).length > 0 ? (
                  Object.values(areasByDomain).map(({ domain, areas }) => (
                    <Collapsible key={domain.id} open={expandedDomains.has(domain.id)} onOpenChange={() => toggleDomain(domain.id)}>
                      <div className="bg-white dark:bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-muted/50 rounded-t-lg" data-testid={`domain-header-${domain.id}`}>
                            <div className="flex items-center space-x-2">
                              <div className="p-1.5 bg-green-50 dark:bg-green-950 rounded">
                                <Folder className="h-3 w-3 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <span className="font-semibold text-xs text-foreground">{domain.name}</span>
                                <div className="text-xs text-muted-foreground">Domain - {areas.length} areas</div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0.5">
                                {allDataObjects.filter((obj: DataObject) => obj.domainId === domain.id).length}
                              </Badge>
                              {expandedDomains.has(domain.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <Separator />
                          <div>
                            {areas.map((area) => {
                              const areaObjects = allDataObjects.filter((obj: DataObject) => obj.dataAreaId === area.id);
                              return (
                                <div 
                                  key={area.id}
                                  className="p-3 border-b border-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-muted/50 cursor-grab transition-colors last:rounded-b-lg touch-manipulation"
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('application/json', JSON.stringify({
                                      type: 'data-area',
                                      area: area,
                                      objects: areaObjects
                                    }));
                                    e.dataTransfer.effectAllowed = 'copy';
                                  }}
                                  data-testid={`area-item-${area.id}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-sm text-foreground">{area.name}</div>
                                      <div className="text-xs text-muted-foreground">{areaObjects.length} objects</div>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      Area
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm mb-1">No domains available</p>
                    <p className="text-xs opacity-75">Create domains to organize your data</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}