import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Settings, 
  Plus, 
  Trash2, 
  Edit3, 
  Key, 
  Link, 
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  FileText,
  Save,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Wand2,
  Server
} from "lucide-react";
import { useModelerStore } from "@/store/modelerStore";
import { useToast } from "@/hooks/use-toast";
import type { DataObject, Attribute } from "@shared/schema";

interface EnhancedPropertiesPanelProps {
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface AttributeFormData {
  name: string;
  conceptualType: string;
  logicalType: string;
  physicalType: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  description: string;
}

const dataTypes = {
  conceptual: [
    "Text", "Number", "Date", "Boolean", "Currency", "Percentage", 
    "Email", "Phone", "URL", "Image", "Document", "Location"
  ],
  logical: [
    "VARCHAR", "INTEGER", "DECIMAL", "DATE", "DATETIME", "BOOLEAN", 
    "TEXT", "BLOB", "JSON", "UUID", "ENUM"
  ],
  physical: [
    "VARCHAR(255)", "INT", "BIGINT", "DECIMAL(10,2)", "DATE", "DATETIME", 
    "TIMESTAMP", "BOOLEAN", "TEXT", "LONGTEXT", "BLOB", "JSON", "CHAR(36)"
  ]
};

export default function EnhancedPropertiesPanel({ onClose, isCollapsed = false, onToggleCollapse }: EnhancedPropertiesPanelProps) {
  const { selectedObjectId, currentModel, selectedNodeId } = useModelerStore();
  const [activeTab, setActiveTab] = useState("properties");
  const [isAddingAttribute, setIsAddingAttribute] = useState(false);
  const [editingAttributeId, setEditingAttributeId] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["basic", "attributes"]));
  const { toast } = useToast();
  const queryClient = useQueryClient();


  // Initial form data for new attributes
  const initialAttributeForm: AttributeFormData = {
    name: "",
    conceptualType: "Text",
    logicalType: "VARCHAR",
    physicalType: "VARCHAR(255)",
    nullable: true,
    isPrimaryKey: false,
    isForeignKey: false,
    description: ""
  };

  const [attributeForm, setAttributeForm] = useState<AttributeFormData>(initialAttributeForm);

  // Fetch selected object details
  const { data: selectedObject } = useQuery({
    queryKey: ["/api/objects", selectedObjectId],
    queryFn: async () => {
      if (!selectedObjectId) return null;
      const response = await fetch(`/api/objects/${selectedObjectId}`);
      return response.json();
    },
    enabled: !!selectedObjectId
  });

  // Mutation for enhancing attributes with layer-specific type mapping
  const enhanceAttributeMutation = useMutation({
    mutationFn: async ({ attributeId, targetLayer }: { attributeId: number; targetLayer: string }) => {
      const response = await fetch(`/api/attributes/${attributeId}/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetLayer }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to enhance attribute');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Attribute Enhanced",
        description: "Attribute types have been automatically mapped for the target layer.",
      });
      
      // Refresh attributes
      queryClient.invalidateQueries({
        queryKey: ["/api/objects", selectedObjectId, "attributes"]
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to enhance attribute. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Mutation for AI type suggestions
  const aiTypeSuggestionsMutation = useMutation({
    mutationFn: async ({ conceptualType, attributeName, objectName }: { conceptualType: string; attributeName: string; objectName: string }) => {
      const response = await fetch('/api/ai/suggest-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conceptualType,
          attributeName,
          context: `Attribute "${attributeName}" in object "${objectName}"`
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI type suggestions');
      }
      
      return response.json();
    },
    onSuccess: (suggestions) => {
      if (suggestions && suggestions.length > 0) {
        const topSuggestion = suggestions[0];
        setAttributeForm(prev => ({
          ...prev,
          logicalType: topSuggestion.logicalType,
          physicalType: topSuggestion.physicalType
        }));
        
        toast({
          title: "AI Suggestions Applied",
          description: `Suggested ${topSuggestion.logicalType} → ${topSuggestion.physicalType}. ${topSuggestion.reasoning}`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "AI Suggestions Failed",
        description: "Could not get AI type suggestions. Please set types manually.",
        variant: "destructive"
      });
    }
  });

  // Mutation for bulk enhancing all attributes for an object
  const bulkEnhanceAttributesMutation = useMutation({
    mutationFn: async ({ objectId, targetLayer }: { objectId: number; targetLayer: string }) => {
      const response = await fetch(`/api/objects/${objectId}/attributes/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetLayer }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to bulk enhance attributes');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Attributes Enhanced",
        description: "All attributes have been automatically mapped for the target layer.",
      });
      
      // Refresh attributes
      queryClient.invalidateQueries({
        queryKey: ["/api/objects", selectedObjectId, "attributes"]
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to enhance attributes. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Fetch attributes for the selected object
  const { data: attributes = [], isLoading: attributesLoading } = useQuery({
    queryKey: ["/api/objects", selectedObjectId, "attributes"],
    queryFn: async () => {
      if (!selectedObjectId) return [];
      const response = await fetch(`/api/objects/${selectedObjectId}/attributes`);
      return response.json();
    },
    enabled: !!selectedObjectId
  });

  // Add attribute mutation
  const addAttributeMutation = useMutation({
    mutationFn: async (data: AttributeFormData) => {
      const response = await fetch(`/api/objects/${selectedObjectId}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          objectId: selectedObjectId,
          orderIndex: attributes.length
        })
      });
      if (!response.ok) throw new Error("Failed to add attribute");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects", selectedObjectId, "attributes"] });
      setIsAddingAttribute(false);
      setAttributeForm(initialAttributeForm);
      toast({ title: "Attribute added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add attribute", variant: "destructive" });
    }
  });

  // Update attribute mutation
  const updateAttributeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AttributeFormData> }) => {
      const response = await fetch(`/api/attributes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to update attribute");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects", selectedObjectId, "attributes"] });
      setEditingAttributeId(null);
      toast({ title: "Attribute updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update attribute", variant: "destructive" });
    }
  });

  // Delete attribute mutation
  const deleteAttributeMutation = useMutation({
    mutationFn: async (attributeId: number) => {
      const response = await fetch(`/api/attributes/${attributeId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete attribute");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects", selectedObjectId, "attributes"] });
      toast({ title: "Attribute deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete attribute", variant: "destructive" });
    }
  });

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleSaveAttribute = () => {
    if (!attributeForm.name.trim()) {
      toast({ title: "Attribute name is required", variant: "destructive" });
      return;
    }

    if (editingAttributeId) {
      updateAttributeMutation.mutate({
        id: editingAttributeId,
        data: attributeForm
      });
    } else {
      addAttributeMutation.mutate(attributeForm);
    }
  };

  const handleEditAttribute = (attribute: Attribute) => {
    setAttributeForm({
      name: attribute.name,
      conceptualType: attribute.conceptualType || "Text",
      logicalType: attribute.logicalType || "VARCHAR",
      physicalType: attribute.physicalType || "VARCHAR(255)",
      length: attribute.length || undefined,
      precision: attribute.precision || undefined,
      scale: attribute.scale || undefined,
      nullable: attribute.nullable ?? false,
      isPrimaryKey: attribute.isPrimaryKey ?? false,
      isForeignKey: attribute.isForeignKey ?? false,
      description: attribute.description || ""
    });
    setEditingAttributeId(attribute.id);
    setIsAddingAttribute(true);
  };

  const handleCancelEdit = () => {
    setIsAddingAttribute(false);
    setEditingAttributeId(null);
    setAttributeForm(initialAttributeForm);
  };

  // Enhanced selection event handling to fix single-click selection
  useEffect(() => {
    const handleObjectSelection = (event: CustomEvent) => {
      const { objectId, forceUpdate } = event.detail;
      console.log('Properties panel received object selection:', objectId);
      if (forceUpdate) {
        // Force component refresh and update tab
        setActiveTab("properties");
        queryClient.invalidateQueries({ queryKey: ["/api/objects", objectId] });
      }
    };

    const handleNodeSelection = (event: CustomEvent) => {
      const { nodeId, objectId, forceUpdate } = event.detail;
      console.log('Properties panel received node selection:', nodeId, objectId);
      if (forceUpdate && objectId) {
        // Force component refresh  
        setActiveTab("properties");
        queryClient.invalidateQueries({ queryKey: ["/api/objects", objectId] });
      }
    };

    window.addEventListener('objectSelected', handleObjectSelection as EventListener);
    window.addEventListener('nodeSelected', handleNodeSelection as EventListener);
    
    return () => {
      window.removeEventListener('objectSelected', handleObjectSelection as EventListener);
      window.removeEventListener('nodeSelected', handleNodeSelection as EventListener);
    };
  }, [queryClient]);

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-card border-l border-border flex flex-col">
        <div className="p-2 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleCollapse?.()}
            className="w-full h-8 p-0"
            title="Expand properties"
            data-testid="button-expand-properties-panel"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center space-y-2 p-1">
          <div className="text-xs text-muted-foreground text-center">Properties</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleCollapse?.()}
            className="w-8 h-8 p-0"
            title="Expand properties"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!selectedObjectId || !selectedObject) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Properties
            </h2>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0"
                data-testid="button-close-properties"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div className="space-y-2">
            <Database className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No object selected</p>
            <p className="text-xs text-muted-foreground opacity-75">
              Double-click an object to view its properties
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center">
            <Settings className="h-4 w-4 mr-2" />
            Properties
          </h2>
          <div className="flex items-center gap-1">
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleCollapse?.()}
                className="h-6 w-6 p-0"
                title="Collapse properties"
                data-testid="button-collapse-properties-panel"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0"
                data-testid="button-close-properties"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2">
          <h3 className="text-sm font-medium text-foreground" data-testid="text-selected-object-name">
            {selectedObject.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {attributes.length} attribute{attributes.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 px-4 pt-4">
            <TabsTrigger value="properties" className="text-xs" data-testid="tab-properties">
              Properties
            </TabsTrigger>
            <TabsTrigger value="attributes" className="text-xs" data-testid="tab-attributes">
              Attributes ({attributes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="properties" className="flex-1 overflow-hidden px-4 pb-4 pt-2">
            <div className="h-full pr-3 overflow-hidden">
              <div className="space-y-4">
                {/* Basic Properties */}
                <div className="border border-border rounded-lg">
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-3 h-auto"
                    onClick={() => toggleSection("basic")}
                  >
                    <span className="text-sm font-medium">Basic Properties</span>
                    {expandedSections.has("basic") ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {expandedSections.has("basic") && (
                    <div className="border-t border-border p-4 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="object-name" className="text-xs font-medium">Name</Label>
                        <Input
                          id="object-name"
                          value={selectedObject.name}
                          className="h-8 text-sm"
                          data-testid="input-object-name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="object-description" className="text-xs font-medium">Description</Label>
                        <Textarea
                          id="object-description"
                          value={selectedObject.description || ""}
                          placeholder="Add a description..."
                          className="text-sm min-h-[60px]"
                          data-testid="textarea-object-description"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="object-type" className="text-xs font-medium">Object Type</Label>
                        <Select value={selectedObject.objectType || "table"}>
                          <SelectTrigger className="h-8 text-sm" data-testid="select-object-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="table">Table</SelectItem>
                            <SelectItem value="view">View</SelectItem>
                            <SelectItem value="entity">Entity</SelectItem>
                            <SelectItem value="interface">Interface</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {/* System Information */}
                <div className="border border-border rounded-lg">
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-3 h-auto"
                    onClick={() => toggleSection("system")}
                  >
                    <span className="text-sm font-medium">System Information</span>
                    {expandedSections.has("system") ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {expandedSections.has("system") && (
                    <div className="border-t border-border p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Source System</Label>
                          <Badge variant="outline" className="text-xs">
                            {selectedObject.sourceSystemId ? "Connected" : "Not Set"}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Target System</Label>
                          <Badge variant="outline" className="text-xs">
                            {selectedObject.targetSystemId ? "Connected" : "Not Set"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="attributes" className="flex-1 overflow-hidden px-4 pb-4 pt-2">
            <div className="h-full flex flex-col space-y-4">
              {/* Add Attribute Button */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Attributes</h3>
                <div className="flex items-center space-x-2">
                  {/* Bulk Enhancement Dropdown */}
                  {attributes.length > 0 && selectedObject && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          data-testid="button-enhance-attributes"
                        >
                          <Wand2 className="h-3 w-3 mr-1" />
                          Enhance
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => bulkEnhanceAttributesMutation.mutate({
                            objectId: selectedObject.id,
                            targetLayer: 'logical'
                          })}
                          disabled={bulkEnhanceAttributesMutation.isPending}
                        >
                          <Database className="h-3 w-3 mr-2" />
                          Map to Logical Types
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => bulkEnhanceAttributesMutation.mutate({
                            objectId: selectedObject.id,
                            targetLayer: 'physical'
                          })}
                          disabled={bulkEnhanceAttributesMutation.isPending}
                        >
                          <Server className="h-3 w-3 mr-2" />
                          Map to Physical Types
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setIsAddingAttribute(true)}
                    className="h-7 text-xs"
                    data-testid="button-add-attribute"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Attribute
                  </Button>
                </div>
              </div>

              {/* Attributes List */}
              <div className="flex-1 pr-3 overflow-hidden">
                {attributesLoading ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <div className="text-xs">Loading attributes...</div>
                  </div>
                ) : attributes.length > 0 ? (
                  <div className="space-y-2">
                    {attributes.map((attribute: Attribute) => (
                      <div
                        key={attribute.id}
                        className="border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                        data-testid={`attribute-card-${attribute.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="text-sm font-medium text-foreground truncate">
                                {attribute.name}
                              </h4>
                              <div className="flex items-center space-x-1">
                                {attribute.isPrimaryKey && (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-yellow-50 text-yellow-700">
                                    <Key className="h-2.5 w-2.5 mr-0.5" />
                                    PK
                                  </Badge>
                                )}
                                {attribute.isForeignKey && (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700">
                                    <Link className="h-2.5 w-2.5 mr-0.5" />
                                    FK
                                  </Badge>
                                )}
                                {!attribute.nullable && (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-red-50 text-red-700">
                                    Required
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div>Type: {attribute.physicalType || attribute.logicalType || attribute.conceptualType || "Not specified"}</div>
                              {attribute.description && (
                                <div>Description: {attribute.description}</div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAttribute(attribute)}
                              className="h-6 w-6 p-0"
                              data-testid={`button-edit-attribute-${attribute.id}`}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteAttributeMutation.mutate(attribute.id)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              data-testid={`button-delete-attribute-${attribute.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No attributes defined</p>
                    <p className="text-xs opacity-75">Add attributes to define the object structure</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Attribute Dialog */}
      <Dialog open={isAddingAttribute} onOpenChange={setIsAddingAttribute}>
  <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingAttributeId ? "Edit Attribute" : "Add New Attribute"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attr-name" className="text-sm font-medium">Name *</Label>
              <Input
                id="attr-name"
                value={attributeForm.name}
                onChange={(e) => setAttributeForm({ ...attributeForm, name: e.target.value })}
                placeholder="Enter attribute name"
                className="h-9"
                data-testid="input-attribute-name"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Conceptual Type</Label>
                  {attributeForm.name && attributeForm.conceptualType && selectedObject && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => aiTypeSuggestionsMutation.mutate({
                        conceptualType: attributeForm.conceptualType,
                        attributeName: attributeForm.name,
                        objectName: selectedObject.name
                      })}
                      disabled={aiTypeSuggestionsMutation.isPending}
                      title="Get AI suggestions for logical and physical types"
                    >
                      {aiTypeSuggestionsMutation.isPending ? (
                        <Wand2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3" />
                      )}
                      AI Suggest
                    </Button>
                  )}
                </div>
                <Select 
                  value={attributeForm.conceptualType} 
                  onValueChange={(value) => setAttributeForm({ ...attributeForm, conceptualType: value })}
                >
                  <SelectTrigger className="h-9 focus:ring-2 focus:ring-primary focus:border-transparent" data-testid="select-conceptual-type">
                    <SelectValue placeholder="Select conceptual type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {dataTypes.conceptual.map((type) => (
                      <SelectItem key={type} value={type} className="cursor-pointer hover:bg-accent focus:bg-accent">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Logical Type</Label>
                <Select 
                  value={attributeForm.logicalType} 
                  onValueChange={(value) => setAttributeForm({ ...attributeForm, logicalType: value })}
                >
                  <SelectTrigger className="h-9 focus:ring-2 focus:ring-primary focus:border-transparent" data-testid="select-logical-type">
                    <SelectValue placeholder="Select logical type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {dataTypes.logical.map((type) => (
                      <SelectItem key={type} value={type} className="cursor-pointer hover:bg-accent focus:bg-accent">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Physical Type</Label>
                <Select 
                  value={attributeForm.physicalType} 
                  onValueChange={(value) => setAttributeForm({ ...attributeForm, physicalType: value })}
                >
                  <SelectTrigger className="h-9 focus:ring-2 focus:ring-primary focus:border-transparent" data-testid="select-physical-type">
                    <SelectValue placeholder="Select physical type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {dataTypes.physical.map((type) => (
                      <SelectItem key={type} value={type} className="cursor-pointer hover:bg-accent focus:bg-accent">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Options</Label>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer group" 
                       onClick={() => setAttributeForm({ ...attributeForm, nullable: !attributeForm.nullable })}>
                    <Switch
                      id="nullable"
                      checked={attributeForm.nullable}
                      onCheckedChange={(checked) => setAttributeForm({ ...attributeForm, nullable: checked })}
                      data-testid="switch-nullable"
                      className="data-[state=checked]:bg-blue-600"
                    />
                    <div className="flex-1">
                      <Label htmlFor="nullable" className="text-sm font-medium cursor-pointer group-hover:text-primary">
                        Nullable
                      </Label>
                      <p className="text-xs text-muted-foreground">Allow null values for this attribute</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer group"
                       onClick={() => setAttributeForm({ ...attributeForm, isPrimaryKey: !attributeForm.isPrimaryKey })}>
                    <Switch
                      id="primary-key"
                      checked={attributeForm.isPrimaryKey}
                      onCheckedChange={(checked) => setAttributeForm({ ...attributeForm, isPrimaryKey: checked })}
                      data-testid="switch-primary-key"
                      className="data-[state=checked]:bg-green-600"
                    />
                    <div className="flex-1">
                      <Label htmlFor="primary-key" className="text-sm font-medium cursor-pointer group-hover:text-primary">
                        Primary Key
                      </Label>
                      <p className="text-xs text-muted-foreground">Uniquely identifies each record</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer group"
                       onClick={() => setAttributeForm({ ...attributeForm, isForeignKey: !attributeForm.isForeignKey })}>
                    <Switch
                      id="foreign-key"
                      checked={attributeForm.isForeignKey}
                      onCheckedChange={(checked) => setAttributeForm({ ...attributeForm, isForeignKey: checked })}
                      data-testid="switch-foreign-key"
                      className="data-[state=checked]:bg-amber-600"
                    />
                    <div className="flex-1">
                      <Label htmlFor="foreign-key" className="text-sm font-medium cursor-pointer group-hover:text-primary">
                        Foreign Key
                      </Label>
                      <p className="text-xs text-muted-foreground">References another table's primary key</p>
                    </div>
                    {attributeForm.isForeignKey && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2 h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Open FK relationship modal
                        }}
                      >
                        Setup
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attr-description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="attr-description"
                value={attributeForm.description}
                onChange={(e) => setAttributeForm({ ...attributeForm, description: e.target.value })}
                placeholder="Add a description for this attribute"
                className="min-h-[60px]"
                data-testid="textarea-attribute-description"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                data-testid="button-cancel-attribute"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAttribute}
                disabled={addAttributeMutation.isPending || updateAttributeMutation.isPending}
                data-testid="button-save-attribute"
              >
                <Save className="h-3 w-3 mr-1" />
                {editingAttributeId ? "Update" : "Add"} Attribute
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}