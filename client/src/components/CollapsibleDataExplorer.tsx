import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Database, 
  Lightbulb, 
  Folder, 
  Table, 
  Filter, 
  X, 
  FileText, 
  Server, 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Minimize2, 
  Maximize2,
  ChevronLeft,
 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useModelerStore } from "@/store/modelerStore";
import type { DataDomain, DataObject, DataArea, DataModel } from "@shared/schema";
import { getSystemColor, getSystemColorBg, getSystemColorText } from "@/lib/systemColors";

interface CollapsibleDataExplorerProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void;
}

export default function CollapsibleDataExplorer({ 
  isCollapsed, 
  onToggleCollapse, 
  onClose 
}: CollapsibleDataExplorerProps) {
  const { aiSuggestions, currentModel } = useModelerStore();
  const [activeTab, setActiveTab] = useState("objects");
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [selectedDataArea, setSelectedDataArea] = useState("all");
  const [selectedSystem, setSelectedSystem] = useState("all");
  
  // State for collapsible domains in data areas tab
  const [expandedDomains, setExpandedDomains] = useState<Set<number>>(new Set());

  // Fetch domains from database
  const { data: domains = [] } = useQuery({
    queryKey: ["/api/domains"],
    queryFn: async () => {
      const response = await fetch("/api/domains");
      return response.json();
    }
  });

  // Fetch systems from database
  const { data: systems = [] } = useQuery({
    queryKey: ["/api/systems"],
    queryFn: async () => {
      const response = await fetch("/api/systems");
      return response.json();
    }
  });

  // Fetch all data areas
  const { data: allDataAreas = [] } = useQuery({
    queryKey: ["/api/domains", "all-areas"],
    queryFn: async () => {
      if (!domains.length) return [];
      const areaPromises = domains.map(async (domain: DataDomain) => {
        const response = await fetch(`/api/domains/${domain.id}/areas`);
        const areas = await response.json();
        return areas.map((area: DataArea) => ({ ...area, domainName: domain.name }));
      });
      const areaArrays = await Promise.all(areaPromises);
      return areaArrays.flat();
    },
    enabled: domains.length > 0
  });

  // Fetch all models
  const { data: allModels = [] } = useQuery({
    queryKey: ["/api/models"],
    queryFn: async () => {
      const response = await fetch("/api/models");
      return response.json();
    }
  });

  // Fetch all data objects across all models with enhanced data
  const { data: allDataObjects = [], refetch: refetchObjects } = useQuery({
    queryKey: ["/api/objects", "enhanced"],
    queryFn: async () => {
      const [objectsResponse, systemsResponse] = await Promise.all([
        fetch("/api/objects"),
        fetch("/api/systems")
      ]);
      
      const objects = await objectsResponse.json();
      const systemsData = await systemsResponse.json();
      
      // Create a map for quick system lookup
      const systemsMap = new Map(systemsData.map((sys: any) => [sys.id, sys as any]));
      
      // Enhance objects with system information and remove duplicates
      const uniqueObjects = new Map();
      objects.forEach((obj: DataObject) => {
        const sourceSystemData = obj.sourceSystemId ? systemsMap.get(obj.sourceSystemId) : null;
        const targetSystemData = obj.targetSystemId ? systemsMap.get(obj.targetSystemId) : null;
        
        const enhanced = {
          ...obj,
          sourceSystem: (sourceSystemData as any)?.name || null,
          targetSystem: (targetSystemData as any)?.name || null,
          sourceSystemData,
          targetSystemData,
        };
        uniqueObjects.set(obj.id, enhanced);
      });
      
      return Array.from(uniqueObjects.values());
    },
    staleTime: 0 // Always refetch to ensure fresh data
  });

  // Fetch attributes for objects to show correct counts
  const { data: allAttributes = [], refetch: refetchAttributes } = useQuery({
    queryKey: ["/api/attributes"],
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
    staleTime: 0 // Always refetch to ensure fresh data
  });

  // Create attribute count map
  const attributeCounts = useMemo(() => {
    const counts = new Map();
    
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

  // Fetch data objects for current model (keeping for compatibility)
  const { data: dataObjects = [] } = useQuery({
    queryKey: ["/api/models", currentModel?.id, "objects"],
    queryFn: async () => {
      if (!currentModel?.id) return [];
      const response = await fetch(`/api/models/${currentModel.id}/objects`);
      return response.json();
    },
    enabled: !!currentModel?.id
  });

  // Get filtered objects based on search and filter criteria
  const filteredObjects = useMemo(() => {
    let filtered = allDataObjects;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter((obj: any) =>
        obj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (obj.sourceSystem && obj.sourceSystem.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (obj.targetSystem && obj.targetSystem.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by domain
    if (selectedDomain && selectedDomain !== "all") {
      const domainId = parseInt(selectedDomain);
      filtered = filtered.filter((obj: DataObject) => obj.domainId === domainId);
    }

    // Filter by data area
    if (selectedDataArea && selectedDataArea !== "all") {
      const areaId = parseInt(selectedDataArea);
      filtered = filtered.filter((obj: DataObject) => obj.dataAreaId === areaId);
    }

    // Filter by source system
    if (selectedSystem && selectedSystem !== "all") {
      filtered = filtered.filter((obj: any) =>
        obj.sourceSystem && obj.sourceSystem.toLowerCase().includes(selectedSystem.toLowerCase())
      );
    }

    return filtered;
  }, [allDataObjects, searchTerm, selectedDomain, selectedDataArea, selectedSystem]);

  // Get unique source systems for filter
  const uniqueSystems = useMemo(() => {
    const systemsSet = new Set<string>();
    allDataObjects.forEach((obj: any) => {
      if (obj.sourceSystem) systemsSet.add(obj.sourceSystem);
      if (obj.targetSystem) systemsSet.add(obj.targetSystem);
    });
    return Array.from(systemsSet);
  }, [allDataObjects]);

  // Helper functions
  const getDomainName = (domainId: number | null) => {
    if (!domainId) return "Unknown";
    const domain = domains.find((d: DataDomain) => d.id === domainId);
    return domain?.name || "Unknown";
  };

  const getAreaName = (areaId: number | null) => {
    if (!areaId) return "Unknown";
    const area = allDataAreas.find((a: DataArea) => a.id === areaId);
    return area?.name || "Unknown";
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDomain("all");
    setSelectedDataArea("all");
    setSelectedSystem("all");
  };

  const toggleDomain = (domainId: number) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domainId)) {
      newExpanded.delete(domainId);
    } else {
      newExpanded.add(domainId);
    }
    setExpandedDomains(newExpanded);
  };

  // Group data areas by domain
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
      <div className="flex flex-col h-full w-12 bg-sidebar border-r border-sidebar-border">
        <div className="p-2 border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="w-8 h-8 p-0 hover:bg-sidebar-accent"
            title="Expand Data Explorer"
            data-testid="button-expand-data-explorer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center space-y-2 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 hover:bg-sidebar-accent"
            title="Data Objects"
            data-testid="button-data-objects-collapsed"
          >
            <Database className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 hover:bg-sidebar-accent"
            title="AI Suggestions"
            data-testid="button-ai-suggestions-collapsed"
          >
            <Lightbulb className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-sidebar-border bg-sidebar-header">
        <h2 className="text-sm font-semibold text-sidebar-foreground flex items-center">
          <Database className="h-4 w-4 mr-2" />
          Data Explorer
        </h2>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-6 w-6 p-0 hover:bg-sidebar-accent"
            title="Collapse Data Explorer"
            data-testid="button-collapse-data-explorer"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 hover:bg-sidebar-accent"
              title="Close"
              data-testid="button-close-data-explorer"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 m-2 mb-0">
            <TabsTrigger value="objects" className="text-xs" data-testid="tab-objects">
              <Table className="h-3 w-3 mr-1" />
              Objects
            </TabsTrigger>
            <TabsTrigger value="domains" className="text-xs" data-testid="tab-domains">
              <Folder className="h-3 w-3 mr-1" />
              Domains
            </TabsTrigger>
          </TabsList>

          <TabsContent value="objects" className="flex-1 flex flex-col min-h-0 px-2">
            {/* Filters */}
            <div className="space-y-2 p-2 bg-sidebar-header/50 rounded-lg border border-sidebar-border/50 mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-sidebar-foreground">Filters</span>
                </div>
                {(searchTerm || (selectedDomain && selectedDomain !== "all") || (selectedDataArea && selectedDataArea !== "all") || (selectedSystem && selectedSystem !== "all")) && (
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
                {/* Search Input */}
                <Input
                  placeholder="Search objects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-7 text-xs"
                  data-testid="input-search-objects"
                />

                {/* Filter Selects */}
                <div className="grid grid-cols-2 gap-2">
                  <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                    <SelectTrigger className="h-7 text-xs" data-testid="select-domain">
                      <SelectValue placeholder="Domain" />
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
                    <SelectTrigger className="h-7 text-xs" data-testid="select-area">
                      <SelectValue placeholder="Area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {allDataAreas.map((area: DataArea & { domainName?: string }) => (
                        <SelectItem key={area.id} value={area.id.toString()}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Select value={selectedSystem} onValueChange={setSelectedSystem}>
                  <SelectTrigger className="h-7 text-xs" data-testid="select-system">
                    <SelectValue placeholder="System" />
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

            {/* Objects List */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs text-muted-foreground font-medium" data-testid="text-object-count">
                  {filteredObjects.length} object{filteredObjects.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filteredObjects.length > 0 ? (
                <div className="space-y-2 flex-1 min-h-0 overflow-auto">
                  {filteredObjects.map((obj: any) => {
                    const systemBorderColor = getSystemColor(obj.sourceSystem || obj.targetSystem);
                    const systemBgColor = getSystemColorBg(obj.sourceSystem || obj.targetSystem);
                    const systemTextColor = getSystemColorText(obj.sourceSystem || obj.targetSystem);
                    const attributeCount = attributeCounts.get(obj.id) || 0;
                    
                    return (
                      <div 
                        key={obj.id} 
                        className={`relative bg-white dark:bg-card border border-sidebar-border rounded-lg p-3 cursor-grab hover:bg-gray-50 dark:hover:bg-sidebar-accent transition-all duration-200 shadow-sm hover:shadow-md border-l-4 ${systemBorderColor} touch-manipulation touch-target`}
                        draggable
                        onDragStart={(e) => {
                          console.log('Drag started for object:', obj.name);
                          if (!currentModel) {
                            e.preventDefault();
                            console.log('No active model - preventing drag');
                            return;
                          }
                          const dragData = JSON.stringify({
                            type: 'data-object',
                            object: obj
                          });
                          console.log('Setting drag data:', dragData);
                          e.dataTransfer.setData('application/json', dragData);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Single click to select object
                          const { selectObject } = useModelerStore.getState();
                          selectObject(obj.id);
                          
                          // Refresh data after selection
                          refetchObjects();
                          refetchAttributes();
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          // Double click to focus on properties
                          const propertiesPanel = document.querySelector('[data-testid="properties-panel"]');
                          if (propertiesPanel) {
                            propertiesPanel.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        data-testid={`card-object-${obj.id}`}
                      >
                        {/* Object Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-foreground truncate mb-1" title={obj.name}>
                              {obj.name}
                            </h3>
                            <div className="text-xs text-muted-foreground">
                              {attributeCount} attribute{attributeCount !== 1 ? 's' : ''}
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
                                // Dispatch a custom event to add object to canvas
                                const canvasElement = document.querySelector('[data-reactflow-wrapper]');
                                if (canvasElement) {
                                  const rect = canvasElement.getBoundingClientRect();
                                  const dropEvent = new CustomEvent('touchDrop', {
                                    detail: {
                                      data: JSON.stringify({
                                        type: 'data-object',
                                        object: obj
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
                              title="Add to canvas"
                              data-testid={`button-add-object-${obj.id}`}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-muted px-1.5 py-0.5 rounded text-xs" title="Drag to canvas or click + button">
                              Drag
                            </div>
                          </div>
                        </div>

                        {/* Domain and Area */}
                        <div className="flex flex-wrap gap-1 mb-2">
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
                        
                        {/* System Information - Show primary system only */}
                        {(obj.sourceSystem || obj.targetSystem) && (
                          <div className="flex items-center text-xs" data-testid={`system-info-${obj.id}`}>
                            <Server className="h-2.5 w-2.5 mr-1 text-muted-foreground" />
                            <span className="text-muted-foreground mr-1">System:</span>
                            <span className={`font-medium ${systemTextColor} px-1 py-0.5 rounded text-xs ${systemBgColor}`}>
                              {obj.targetSystem || obj.sourceSystem}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No objects match your filters</p>
                  <p className="text-xs opacity-75">Try adjusting your search criteria</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="domains" className="flex-1 space-y-3 px-2">
            {Object.keys(areasByDomain).length > 0 ? (
              Object.values(areasByDomain).map(({ domain, areas }) => (
                <Collapsible key={domain.id} open={expandedDomains.has(domain.id)} onOpenChange={() => toggleDomain(domain.id)}>
                  <div className="bg-white dark:bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                    {/* Domain Header - Not draggable */}
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
                      <div className="border-t border-border">
                        {areas.map((area) => {
                          const areaObjects = allDataObjects.filter((obj: DataObject) => obj.dataAreaId === area.id);
                          return (
                            <div 
                              key={area.id}
                              className="p-3 border-b border-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-muted/50 cursor-grab transition-colors last:rounded-b-lg touch-manipulation touch-target"
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
              <div className="text-center py-6 text-muted-foreground">
                <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No domains available</p>
                <p className="text-xs opacity-75">Create domains to organize your data</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}