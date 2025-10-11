import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Plus,
  Filter,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useModelerStore } from "@/store/modelerStore";
import { useToast } from "@/hooks/use-toast";
import type { DataDomain, DataObject, DataArea } from "@shared/schema";
import { getSystemColor, getSystemColorBg, getSystemColorText } from "@/lib/systemColors";

type ExplorerDataObject = DataObject & Record<string, any>;

interface DataObjectExplorerProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void;
}

export default function DataObjectExplorer({ 
  isCollapsed, 
  onToggleCollapse, 
  onClose 
}: DataObjectExplorerProps) {
  const { currentModel, currentLayer, selectedObjectId, selectObject, selectNode } = useModelerStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [selectedDataArea, setSelectedDataArea] = useState("all");
  const [selectedSystem, setSelectedSystem] = useState("all");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50); // Show 50 items per page
  
  // UI states
  const [filtersOpen, setFiltersOpen] = useState(true);
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
    queryKey: ["/api/areas"],
    queryFn: async () => {
      const response = await fetch("/api/areas");

      if (!response.ok) {
        throw new Error(`Failed to fetch data areas: ${response.status}`);
      }

      return response.json();
    }
  });

  // Fetch all data objects with enhanced data and deduplication
  const { data: allDataObjects = [], refetch: refetchObjects, isLoading: objectsLoading } = useQuery({
    queryKey: ["/api/objects", "enhanced", lastRefresh.getTime()],
    queryFn: async () => {
      const [objectsResponse, systemsResponse] = await Promise.all([
        fetch("/api/objects"),
        fetch("/api/systems")
      ]);

      const objects = await objectsResponse.json();
      const systemsData = await systemsResponse.json();

      // Create system lookup map with proper type safety
      const systemsMap = new Map(systemsData.map((sys: any) => [sys.id, sys]));

      // Remove duplicates and enhance with system data
      const uniqueObjects = new Map();
      objects.forEach((obj: DataObject) => {
        if (!uniqueObjects.has(obj.id)) {
          const sourceSystemData = obj.sourceSystemId ? systemsMap.get(obj.sourceSystemId) : null;
          const targetSystemData = obj.targetSystemId ? systemsMap.get(obj.targetSystemId) : null;

          uniqueObjects.set(obj.id, {
            ...obj,
            sourceSystem: (sourceSystemData as any)?.name || null,
            targetSystem: (targetSystemData as any)?.name || null,
            sourceSystemData,
            targetSystemData
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
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((obj: any) =>
        obj.name.toLowerCase().includes(searchLower) ||
        (obj.sourceSystem && obj.sourceSystem.toLowerCase().includes(searchLower)) ||
        (obj.targetSystem && obj.targetSystem.toLowerCase().includes(searchLower)) ||
        (obj.description && obj.description.toLowerCase().includes(searchLower))
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

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [allDataObjects, searchTerm, selectedDomain, selectedDataArea, selectedSystem]);

  // Paginated objects
  const paginatedObjects = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredObjects.slice(startIndex, endIndex);
  }, [filteredObjects, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredObjects.length / pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDomain, selectedDataArea, selectedSystem]);

  // System options for filtering
  const uniqueSystems = useMemo(() => {
    const systemsSet = new Set<string>();
    allDataObjects.forEach((obj: any) => {
      if (obj.sourceSystem) systemsSet.add(obj.sourceSystem);
      if (obj.targetSystem) systemsSet.add(obj.targetSystem);
    });
    return Array.from(systemsSet).sort();
  }, [allDataObjects]);

  const availableDataAreas = useMemo(() => {
    if (selectedDomain === "all") {
      return allDataAreas;
    }

    const domainId = parseInt(selectedDomain);
    return allDataAreas.filter((area: DataArea) => area.domainId === domainId);
  }, [allDataAreas, selectedDomain]);

  useEffect(() => {
    if (selectedDataArea === "all") {
      return;
    }

    const areaId = parseInt(selectedDataArea);
    if (!availableDataAreas.some((area: DataArea) => area.id === areaId)) {
      setSelectedDataArea("all");
    }
  }, [availableDataAreas, selectedDataArea]);

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
    setCurrentPage(1);
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

  // Remove auto-refresh on model change to prevent multiple reloads
  // Users can manually refresh using the refresh button

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

  const renderObjectCard = (obj: ExplorerDataObject) => {
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
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "text-sm font-medium truncate mb-1",
                isSelected ? "text-primary" : "text-foreground"
              )}
              title={obj.name}
            >
              {obj.name}
            </h3>
            <div className="text-xs text-muted-foreground">
              <span
                className={cn(
                  "px-2 py-1 rounded",
                  attributeCount > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                )}
              >
                {attributeCount} attribute{attributeCount !== 1 ? "s" : ""}
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
                    title: "Select a model first",
                    variant: "destructive"
                  });
                  return;
                }

                const canvasElement = document.querySelector('[data-reactflow-wrapper]');
                if (canvasElement) {
                  const rect = canvasElement.getBoundingClientRect();
                  const dropEvent = new CustomEvent('touchDrop', {
                    detail: {
                      data: JSON.stringify({
                        type: 'data-object',
                        object: {
                          ...obj,
                          attributes: [],
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

        <div className="flex flex-wrap gap-1 mb-2">
          <Badge variant="outline" className="text-[11px] px-1.5 py-0.5">
            {getDomainName(obj.domainId)}
          </Badge>
          <Badge variant="outline" className="text-[11px] px-1.5 py-0.5">
            {getAreaName(obj.dataAreaId)}
          </Badge>
          {obj.sourceSystem && (
            <Badge style={{ backgroundColor: systemBgColor, color: systemTextColor }} className="text-[11px] border-none px-1.5 py-0.5">
              {obj.sourceSystem}
            </Badge>
          )}
          {obj.targetSystem && (
            <Badge style={{ backgroundColor: systemBgColor, color: systemTextColor }} className="text-[11px] border-none px-1.5 py-0.5">
              {obj.targetSystem}
            </Badge>
          )}
        </div>

        {obj.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{obj.description}</p>
        )}
      </div>
    );
  };

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

  const totalFilteredObjects = filteredObjects.length;
  const hasActiveFilters = Boolean(
    searchTerm ||
    selectedDomain !== "all" ||
    selectedDataArea !== "all" ||
    selectedSystem !== "all"
  );

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 bg-sidebar border-r border-sidebar-border w-full min-w-[18rem] max-w-full">
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 p-3 border-b border-sidebar-border bg-sidebar-header">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-sidebar-foreground flex items-center">
              <Database className="h-4 w-4 mr-2" />
              Data Objects Explorer
            </h2>
          </div>
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
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {totalFilteredObjects} of {allDataObjects.length} objects
          </span>
          <span className={cn(
            "px-2 py-1 rounded",
            currentModel ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {currentModel ? "Model Active" : "No Model"}
          </span>
        </div>
      </div>
      
      {/* Scrollable Content Section */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-3 space-y-3">
          <Collapsible className="bg-sidebar-header/30 border border-sidebar-border/50 rounded-lg p-3" open={filtersOpen} onOpenChange={setFiltersOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground hover:text-primary"
                >
                  <Filter className="h-3 w-3" />
                  Filters
                  <ChevronDown className={cn("h-3 w-3 transition-transform", filtersOpen && "rotate-180")}/>
                </button>
              </CollapsibleTrigger>
              {hasActiveFilters && (
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
            <CollapsibleContent className="mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search objects, systems, descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-xs pl-7"
                  data-testid="input-search-objects"
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-domain-filter">
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
                  <SelectTrigger className="h-8 text-xs" data-testid="select-data-area-filter">
                    <SelectValue placeholder="All Data Areas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Data Areas</SelectItem>
                    {availableDataAreas.map((area: DataArea) => (
                      <SelectItem key={area.id} value={area.id.toString()}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedSystem} onValueChange={setSelectedSystem}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-system-filter">
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
            </CollapsibleContent>
          </Collapsible>

          {(objectsLoading || attributesLoading) ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
          ) : filteredObjects.length > 0 ? (
            <>
              <div className="space-y-2">
                {paginatedObjects.map(renderObjectCard)}
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 pb-2 px-2 border-t border-sidebar-border mt-4">
                  <div className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                    <span className="ml-2">
                      ({((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredObjects.length)} of {filteredObjects.length})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-7 px-2 text-xs"
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-3 w-3 mr-1" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-7 px-2 text-xs"
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-1">No objects found</p>
              <p className="text-xs opacity-75">
                Adjust your filters or create a new data object to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}