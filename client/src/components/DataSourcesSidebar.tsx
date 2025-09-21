import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Lightbulb, Folder, Table, Filter, X, FileText, Server, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useModelerStore } from "@/store/modelerStore";
import type { DataDomain, DataObject, DataArea, DataModel } from "@shared/schema";
import { getSystemColor, getSystemColorBg, getSystemColorText } from "@/lib/systemColors";

interface DataSourcesSidebarProps {
  onClose?: () => void;
}

export default function DataSourcesSidebar({ onClose }: DataSourcesSidebarProps = {}) {
  const { aiSuggestions, currentModel } = useModelerStore();
  const [activeTab, setActiveTab] = useState("objects");
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [selectedDataArea, setSelectedDataArea] = useState("all");
  const [selectedSystem, setSelectedSystem] = useState("all");
  
  // State for collapsible domains in data areas tab
  const [expandedDomains, setExpandedDomains] = useState<Set<number>>(new Set());

  // Helper functions to get system names from IDs
  const getSystemName = (systemId: number | null | undefined): string | null => {
    if (!systemId) return null;
    const system = systems.find((s: any) => s.id === systemId);
    return system?.name || null;
  };

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
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const response = await fetch("/api/sources");
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

  // Fetch all data objects across all models
  const { data: allDataObjects = [] } = useQuery({
    queryKey: ["/api/objects"],
    queryFn: async () => {
      const response = await fetch("/api/objects");
      return response.json();
    }
  });

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
      filtered = filtered.filter((obj: DataObject) =>
        obj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (getSystemName(obj.sourceSystemId) && getSystemName(obj.sourceSystemId)!.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (getSystemName(obj.targetSystemId) && getSystemName(obj.targetSystemId)!.toLowerCase().includes(searchTerm.toLowerCase()))
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
      filtered = filtered.filter((obj: DataObject) =>
        getSystemName(obj.sourceSystemId) && getSystemName(obj.sourceSystemId)!.toLowerCase().includes(selectedSystem.toLowerCase())
      );
    }

    return filtered;
  }, [allDataObjects, searchTerm, selectedDomain, selectedDataArea, selectedSystem]);

  // Get unique source systems for filter
  const uniqueSystems = useMemo(() => {
    const systems = new Set<string>();
    allDataObjects.forEach((obj: DataObject) => {
      const sourceSystemName = getSystemName(obj.sourceSystemId);
      const targetSystemName = getSystemName(obj.targetSystemId);
      if (sourceSystemName) systems.add(sourceSystemName);
      if (targetSystemName) systems.add(targetSystemName);
    });
    return Array.from(systems).sort();
  }, [allDataObjects]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDomain("all");
    setSelectedDataArea("all");
    setSelectedSystem("all");
  };

  // Toggle domain expansion
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
    const grouped: Record<number, { domain: DataDomain; areas: (DataArea & { domainName?: string })[] }> = {};
    
    domains.forEach((domain: DataDomain) => {
      const domainAreas = allDataAreas.filter((area: DataArea) => area.domainId === domain.id);
      if (domainAreas.length > 0) {
        grouped[domain.id] = {
          domain,
          areas: domainAreas
        };
      }
    });
    
    return grouped;
  }, [domains, allDataAreas]);

  // Get domain and area names for display
  const getDomainName = (domainId: number | null) => {
    if (!domainId) return "No Domain";
    const domain = domains.find((d: DataDomain) => d.id === domainId);
    return domain?.name || "Unknown Domain";
  };

  const getAreaName = (areaId: number | null) => {
    if (!areaId) return "No Area";
    const area = allDataAreas.find((a: DataArea) => a.id === areaId);
    return area?.name || "Unknown Area";
  };

  const getModelName = (modelId: number) => {
    const model = allModels.find((m: DataModel) => m.id === modelId);
    return model?.name || "Unknown Model";
  };



  return (
    <aside className="w-full h-full bg-gradient-to-b from-white to-gray-50 dark:from-card dark:to-background border-r border-sidebar-border overflow-y-auto shadow-soft">
      <div className="h-full flex flex-col">
        <div className="flex items-center space-x-2 p-3 bg-white dark:bg-card border-b border-border">
          <div className="p-1.5 bg-primary/10 rounded-md">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Data Explorer</h2>
            <p className="text-xs text-muted-foreground">Browse and manage objects</p>
          </div>
        </div>



        {/* Data Sources Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col px-3">
          <TabsList className="grid w-full grid-cols-2 bg-muted/60 h-10 mb-3">
            <TabsTrigger value="objects" className="text-xs font-medium flex items-center space-x-1">
              <Table className="h-3 w-3" />
              <span>Objects</span>
            </TabsTrigger>
            <TabsTrigger value="domains" className="text-xs font-medium flex items-center space-x-1">
              <Folder className="h-3 w-3" />
              <span>Data Areas</span>
            </TabsTrigger>
          </TabsList>



          <TabsContent value="objects" className="flex-1 flex flex-col space-y-3 px-0">
            {/* Filter Controls */}
            <div className="space-y-3 p-3 bg-white dark:bg-card border border-border rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-blue-50 dark:bg-blue-950 rounded">
                    <Filter className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-medium text-xs text-foreground">Filters</span>
                </div>
                {(searchTerm || (selectedDomain && selectedDomain !== "all") || (selectedDataArea && selectedDataArea !== "all") || (selectedSystem && selectedSystem !== "all")) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="h-6 px-2 text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200"
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
                />

                {/* Filter Selects */}
                <div className="grid grid-cols-2 gap-2">
                  <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                    <SelectTrigger className="h-7 text-xs">
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
                    <SelectTrigger className="h-7 text-xs">
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
                  <SelectTrigger className="h-7 text-xs">
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
                <span className="text-xs text-muted-foreground font-medium">
                  {filteredObjects.length} object{filteredObjects.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filteredObjects.length > 0 ? (
                <div className="space-y-2 flex-1 min-h-0">
                  {filteredObjects.map((obj: DataObject) => {
                    const systemName = getSystemName(obj.sourceSystemId) || getSystemName(obj.targetSystemId);
                    const systemBorderColor = getSystemColor(systemName);
                    const systemBgColor = getSystemColorBg(systemName);
                    const systemTextColor = getSystemColorText(systemName);
                    
                    return (
                      <div 
                        key={obj.id} 
                        className={`relative bg-white dark:bg-card border border-sidebar-border rounded-lg p-3 cursor-grab hover:bg-gray-50 dark:hover:bg-sidebar-accent transition-all duration-200 shadow-sm hover:shadow-md border-l-4 ${systemBorderColor} touch-manipulation touch-target`}
                        draggable
                        onDragStart={(e) => {
                          console.log('Drag started for object:', obj.name);
                          const dragData = JSON.stringify({
                            type: 'data-object',
                            object: obj
                          });
                          console.log('Setting drag data:', dragData);
                          e.dataTransfer.setData('application/json', dragData);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onTouchStart={(e) => {
                          // Store touch data for mobile drag
                          const touch = e.touches[0];
                          const element = e.currentTarget;
                          element.dataset.touchStartX = touch.clientX.toString();
                          element.dataset.touchStartY = touch.clientY.toString();
                          element.dataset.objectData = JSON.stringify({
                            type: 'data-object',
                            object: obj
                          });
                          
                          // Add visual feedback for mobile
                          element.style.opacity = '0.7';
                          element.style.transform = 'scale(1.05)';
                          element.style.zIndex = '1000';
                        }}
                        onTouchMove={(e) => {
                          e.preventDefault(); // Prevent scrolling
                          const touch = e.touches[0];
                          const element = e.currentTarget;
                          
                          // Update visual position
                          const startX = parseFloat(element.dataset.touchStartX || '0');
                          const startY = parseFloat(element.dataset.touchStartY || '0');
                          const deltaX = touch.clientX - startX;
                          const deltaY = touch.clientY - startY;
                          
                          element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.05)`;
                          
                          // Find element under touch point
                          element.style.pointerEvents = 'none';
                          const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                          element.style.pointerEvents = 'auto';
                          
                          // Check if over canvas area
                          const canvasElement = document.querySelector('[data-reactflow-wrapper]') || 
                                              document.querySelector('.react-flow') ||
                                              document.querySelector('[class*="react-flow"]');
                          
                          if (canvasElement && canvasElement.contains(elementBelow)) {
                            element.style.borderColor = '#22c55e'; // Green border when over drop zone
                          } else {
                            element.style.borderColor = ''; // Reset border
                          }
                        }}
                        onTouchEnd={(e) => {
                          const element = e.currentTarget;
                          const touch = e.changedTouches[0];
                          
                          // Reset visual state
                          element.style.opacity = '';
                          element.style.transform = '';
                          element.style.zIndex = '';
                          element.style.borderColor = '';
                          
                          // Find element under touch point
                          element.style.pointerEvents = 'none';
                          const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                          element.style.pointerEvents = 'auto';
                          
                          // Check if dropped on canvas
                          const canvasElement = document.querySelector('[data-reactflow-wrapper]') || 
                                              document.querySelector('.react-flow') ||
                                              document.querySelector('[class*="react-flow"]');
                          
                          if (canvasElement && canvasElement.contains(elementBelow)) {
                            // Create artificial drop event for touch
                            const objectData = element.dataset.objectData;
                            if (objectData && canvasElement) {
                              const canvasRect = canvasElement.getBoundingClientRect();
                              const dropEvent = new CustomEvent('touchDrop', {
                                detail: {
                                  data: objectData,
                                  clientX: touch.clientX,
                                  clientY: touch.clientY,
                                  canvasX: touch.clientX - canvasRect.left,
                                  canvasY: touch.clientY - canvasRect.top
                                }
                              });
                              canvasElement.dispatchEvent(dropEvent);
                            }
                          }
                          
                          // Clean up data attributes
                          delete element.dataset.touchStartX;
                          delete element.dataset.touchStartY;
                          delete element.dataset.objectData;
                        }}
                      >
                        {/* Header with icon and name */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center min-w-0 space-x-2">
                            <div className={`p-1 rounded ${systemBgColor}`}>
                              <Table className={`h-3 w-3 ${systemTextColor}`} />
                            </div>
                            <span className="font-semibold text-xs text-foreground truncate">{obj.name}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {obj.isNew && (
                              <Badge variant="outline" className="text-xs px-1 py-0 bg-green-50 text-green-700 border-green-200">
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
                        {systemName && (
                          <div className="flex items-center text-xs">
                            <Server className="h-2.5 w-2.5 mr-1 text-muted-foreground" />
                            <span className="text-muted-foreground mr-1">System:</span>
                            <span className={`font-medium ${systemTextColor} px-1 py-0.5 rounded text-xs ${systemBgColor}`}>
                              {systemName}
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

          <TabsContent value="domains" className="flex-1 space-y-3 px-0">
            {Object.keys(areasByDomain).length > 0 ? (
              Object.values(areasByDomain).map(({ domain, areas }) => (
                <Collapsible key={domain.id} open={expandedDomains.has(domain.id)} onOpenChange={() => toggleDomain(domain.id)}>
                  <div className="bg-white dark:bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                    {/* Domain Header - Not draggable */}
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-muted/50 rounded-t-lg">
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
                              onTouchStart={(e) => {
                                // Store touch data for mobile drag
                                const touch = e.touches[0];
                                const element = e.currentTarget;
                                element.dataset.touchStartX = touch.clientX.toString();
                                element.dataset.touchStartY = touch.clientY.toString();
                                element.dataset.areaData = JSON.stringify({
                                  type: 'data-area',
                                  area: area,
                                  objects: areaObjects
                                });
                                
                                // Add visual feedback for mobile
                                element.style.opacity = '0.7';
                                element.style.transform = 'scale(1.05)';
                                element.style.zIndex = '1000';
                              }}
                              onTouchMove={(e) => {
                                e.preventDefault(); // Prevent scrolling
                                const touch = e.touches[0];
                                const element = e.currentTarget;
                                
                                // Update visual position
                                const startX = parseFloat(element.dataset.touchStartX || '0');
                                const startY = parseFloat(element.dataset.touchStartY || '0');
                                const deltaX = touch.clientX - startX;
                                const deltaY = touch.clientY - startY;
                                
                                element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.05)`;
                                
                                // Find element under touch point
                                element.style.pointerEvents = 'none';
                                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                                element.style.pointerEvents = 'auto';
                                
                                // Check if over canvas area
                                const canvasElement = document.querySelector('[data-reactflow-wrapper]') || 
                                                    document.querySelector('.react-flow') ||
                                                    document.querySelector('[class*="react-flow"]');
                                
                                if (canvasElement && canvasElement.contains(elementBelow)) {
                                  element.style.borderColor = '#22c55e'; // Green border when over drop zone
                                } else {
                                  element.style.borderColor = ''; // Reset border
                                }
                              }}
                              onTouchEnd={(e) => {
                                const element = e.currentTarget;
                                const touch = e.changedTouches[0];
                                
                                // Reset visual state
                                element.style.opacity = '';
                                element.style.transform = '';
                                element.style.zIndex = '';
                                element.style.borderColor = '';
                                
                                // Find element under touch point
                                element.style.pointerEvents = 'none';
                                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                                element.style.pointerEvents = 'auto';
                                
                                // Check if dropped on canvas
                                const canvasElement = document.querySelector('[data-reactflow-wrapper]') || 
                                                    document.querySelector('.react-flow') ||
                                                    document.querySelector('[class*="react-flow"]');
                                
                                if (canvasElement && canvasElement.contains(elementBelow)) {
                                  // Create artificial drop event for touch
                                  const areaData = element.dataset.areaData;
                                  if (areaData && canvasElement) {
                                    const canvasRect = canvasElement.getBoundingClientRect();
                                    const dropEvent = new CustomEvent('touchDrop', {
                                      detail: {
                                        data: areaData,
                                        clientX: touch.clientX,
                                        clientY: touch.clientY,
                                        canvasX: touch.clientX - canvasRect.left,
                                        canvasY: touch.clientY - canvasRect.top
                                      }
                                    });
                                    canvasElement.dispatchEvent(dropEvent);
                                  }
                                }
                                
                                // Clean up data attributes
                                delete element.dataset.touchStartX;
                                delete element.dataset.touchStartY;
                                delete element.dataset.areaData;
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <div className="p-1 bg-orange-50 dark:bg-orange-950 rounded">
                                    <Table className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                  </div>
                                  <div>
                                    <span className="font-medium text-xs text-foreground">{area.name}</span>
                                    <div className="text-xs text-muted-foreground">{areaObjects.length} objects</div>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-muted px-1.5 py-0.5 rounded">
                                  Drag
                                </div>
                              </div>
                              {area.description && (
                                <p className="text-xs text-muted-foreground mt-2 bg-gray-50 dark:bg-muted/50 p-2 rounded">
                                  {area.description}
                                </p>
                              )}
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
                <div className="h-12 w-12 mx-auto mb-3 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-lg flex items-center justify-center shadow-sm">
                  <Folder className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xs font-medium text-foreground mb-1">No data areas available</h3>
                <p className="text-xs opacity-75">Data areas will appear as you add objects to domains</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Suggestions Panel */}
      <div className="px-3 pb-3">
        {aiSuggestions.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Lightbulb className="h-4 w-4 text-primary mr-2" />
              <h3 className="font-medium text-sm">AI Suggestions</h3>
            </div>
            <div className="space-y-2">
              {aiSuggestions.slice(0, 3).map((suggestion, index) => (
                <div key={index} className="text-xs bg-white p-2 rounded border-l-4 border-blue-400">
                  <span className="font-medium">{suggestion.title}:</span>
                  <p className="text-muted-foreground mt-1">{suggestion.description}</p>
                </div>
              ))}
            </div>
            <Button 
              size="sm" 
              className="w-full mt-3 text-xs"
              onClick={() => {
                // TODO: Implement AI suggestions application logic
                console.log("Applying AI suggestions:", aiSuggestions);
              }}
            >
              Apply All Suggestions
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
