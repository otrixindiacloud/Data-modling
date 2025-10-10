import React, { useState, useEffect } from "react";
import { X, Plus, Edit, Key, ExternalLink, Trash2, Save, Server, Database as DbIcon, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModelerStore } from "@/store/modelerStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ModelLayer } from "@/types/modeler";
import { Attribute, DataObject, DataDomain, DataArea } from "@/../../shared/schema";
import { getSystemColor, getSystemColorBg, getSystemColorText } from "@/lib/systemColors";

interface AttributeEditFormProps {
  attribute: Attribute;
  currentLayer: ModelLayer;
  onSave: (updates: Partial<Attribute>) => void;
  onCancel: () => void;
}

interface CustomProperty {
  id: string;
  key: string;
  value: string;
  type: 'text' | 'number' | 'boolean' | 'date';
}

function AttributeEditForm({ attribute, currentLayer, onSave, onCancel }: AttributeEditFormProps) {
  const [editData, setEditData] = useState({
    name: attribute.name,
    conceptualType: attribute.conceptualType || "Text",
    logicalType: attribute.logicalType || "",
    physicalType: attribute.physicalType || "",
    nullable: attribute.nullable ?? true,
    isPrimaryKey: attribute.isPrimaryKey ?? false,
    isForeignKey: attribute.isForeignKey ?? false,
  });

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium text-gray-600">Attribute Name</Label>
        <Input
          placeholder="Attribute name"
          value={editData.name}
          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
          className="mt-1"
        />
      </div>

      {/* Layer-specific type editing */}
      {currentLayer === "conceptual" && (
        <div>
          <Label className="text-xs font-medium text-gray-600">Conceptual Type</Label>
          <Select
            value={editData.conceptualType}
            onValueChange={(value) => setEditData({ ...editData, conceptualType: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select conceptual type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Text">Text</SelectItem>
              <SelectItem value="Number">Number</SelectItem>
              <SelectItem value="Decimal">Decimal</SelectItem>
              <SelectItem value="Date">Date</SelectItem>
              <SelectItem value="DateTime">DateTime</SelectItem>
              <SelectItem value="Boolean">Boolean</SelectItem>
              <SelectItem value="Currency">Currency</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {currentLayer === "logical" && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs font-medium text-gray-600">Conceptual Type</Label>
            <Select
              value={editData.conceptualType}
              onValueChange={(value) => setEditData({ ...editData, conceptualType: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select conceptual type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Text">Text</SelectItem>
                <SelectItem value="Number">Number</SelectItem>
                <SelectItem value="Decimal">Decimal</SelectItem>
                <SelectItem value="Date">Date</SelectItem>
                <SelectItem value="DateTime">DateTime</SelectItem>
                <SelectItem value="Boolean">Boolean</SelectItem>
                <SelectItem value="Currency">Currency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600">Logical Type</Label>
            <Input
              placeholder="Logical type (e.g., String, Integer)"
              value={editData.logicalType}
              onChange={(e) => setEditData({ ...editData, logicalType: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {currentLayer === "physical" && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs font-medium text-gray-600">Conceptual Type</Label>
            <Select
              value={editData.conceptualType}
              onValueChange={(value) => setEditData({ ...editData, conceptualType: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select conceptual type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Text">Text</SelectItem>
                <SelectItem value="Number">Number</SelectItem>
                <SelectItem value="Decimal">Decimal</SelectItem>
                <SelectItem value="Date">Date</SelectItem>
                <SelectItem value="DateTime">DateTime</SelectItem>
                <SelectItem value="Boolean">Boolean</SelectItem>
                <SelectItem value="Currency">Currency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600">Physical Type</Label>
            <Select
              value={editData.physicalType}
              onValueChange={(value) => setEditData({ ...editData, physicalType: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select physical type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VARCHAR(50)">VARCHAR(50)</SelectItem>
                <SelectItem value="VARCHAR(255)">VARCHAR(255)</SelectItem>
                <SelectItem value="VARCHAR(1000)">VARCHAR(1000)</SelectItem>
                <SelectItem value="TEXT">TEXT</SelectItem>
                <SelectItem value="INT">INT</SelectItem>
                <SelectItem value="BIGINT">BIGINT</SelectItem>
                <SelectItem value="SMALLINT">SMALLINT</SelectItem>
                <SelectItem value="DECIMAL(10,2)">DECIMAL(10,2)</SelectItem>
                <SelectItem value="DECIMAL(15,2)">DECIMAL(15,2)</SelectItem>
                <SelectItem value="FLOAT">FLOAT</SelectItem>
                <SelectItem value="DOUBLE">DOUBLE</SelectItem>
                <SelectItem value="DATE">DATE</SelectItem>
                <SelectItem value="DATETIME">DATETIME</SelectItem>
                <SelectItem value="TIMESTAMP">TIMESTAMP</SelectItem>
                <SelectItem value="TIME">TIME</SelectItem>
                <SelectItem value="BOOLEAN">BOOLEAN</SelectItem>
                <SelectItem value="BIT">BIT</SelectItem>
                <SelectItem value="CHAR(1)">CHAR(1)</SelectItem>
                <SelectItem value="CHAR(10)">CHAR(10)</SelectItem>
                <SelectItem value="BLOB">BLOB</SelectItem>
                <SelectItem value="JSON">JSON</SelectItem>
                <SelectItem value="UUID">UUID</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-4 text-sm">
        <label className="flex items-center space-x-1">
          <Checkbox
            checked={editData.isPrimaryKey}
            onCheckedChange={(checked) => setEditData({ ...editData, isPrimaryKey: checked as boolean })}
          />
          <span>Primary Key</span>
        </label>
        <label className="flex items-center space-x-1">
          <Checkbox
            checked={editData.isForeignKey}
            onCheckedChange={(checked) => setEditData({ ...editData, isForeignKey: checked as boolean })}
          />
          <span>Foreign Key</span>
        </label>
        <label className="flex items-center space-x-1">
          <Checkbox
            checked={editData.nullable}
            onCheckedChange={(checked) => setEditData({ ...editData, nullable: checked as boolean })}
          />
          <span>Nullable</span>
        </label>
      </div>

      <div className="flex space-x-2 pt-2">
        <Button size="sm" onClick={handleSave} className="flex items-center space-x-1">
          <Save className="h-3 w-3" />
          <span>Save</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel} className="flex items-center space-x-1">
          <X className="h-3 w-3" />
          <span>Cancel</span>
        </Button>
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const {
    selectedNodeId,
    selectedAttributeId,
    nodes,
    currentModel,
    currentLayer,
    updateNode,
    selectNode,
    selectAttribute,
    setNodes,
  } = useModelerStore();

  const { toast } = useToast();
  const [editingAttribute, setEditingAttribute] = useState<number | null>(null);
  const [editingObject, setEditingObject] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<string>("properties");
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>([]);
  const [newCustomProperty, setNewCustomProperty] = useState<Omit<CustomProperty, 'id'>>({
    key: "",
    value: "",
    type: "text"
  });
  const [newAttribute, setNewAttribute] = useState({
    name: "",
    conceptualType: "Text",
    logicalType: "",
    physicalType: "",
    nullable: true,
    isPrimaryKey: false,
    isForeignKey: false,
  });

  const queryClient = useQueryClient();

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  // Additional validation to ensure selectedNode has valid data
  const validSelectedNode = selectedNode?.data ? selectedNode : null;

  // Load common properties from database when node is selected
  useEffect(() => {
    if (validSelectedNode?.data?.commonProperties && typeof validSelectedNode.data.commonProperties === "object") {
      const parsed = Object.entries(validSelectedNode.data.commonProperties as Record<string, any>).map(
        ([key, rawValue]) => {
          const valueObj = (rawValue ?? {}) as { value?: string; type?: CustomProperty["type"] };
          return {
            id: `${key}`,
            key,
            value: String(valueObj.value ?? ""),
            type: (valueObj.type as CustomProperty["type"]) ?? "text",
          } as CustomProperty;
        },
      );
      setCustomProperties(parsed);
    } else {
      setCustomProperties([]);
    }
  }, [validSelectedNode?.data?.commonProperties, validSelectedNode?.id]);

  // Load domains
  const { data: allDomains = [] } = useQuery({
    queryKey: ["/api/domains"],
  });

  // Load data areas for selected domain
  const { data: domainAreas = [] } = useQuery<DataArea[]>({
    queryKey: ["/api/domains", validSelectedNode?.data?.domain, "areas"],
    enabled: !!validSelectedNode?.data?.domain,
  });

  // Load attributes for selected object
  const { data: objectAttributes = [] } = useQuery<Attribute[]>({
    queryKey: ["/api/objects", validSelectedNode?.data?.objectId, "attributes"],
    enabled: !!validSelectedNode?.data?.objectId,
  });

  // Load specific attribute data when an attribute is selected
  const { data: selectedAttribute } = useQuery<Attribute>({
    queryKey: ["/api/attributes", selectedAttributeId],
    enabled: !!selectedAttributeId,
  });

  // Update object mutation
  const updateObjectMutation = useMutation({
    mutationFn: async (data: Partial<DataObject>) => {
      if (!validSelectedNode?.data?.objectId) {
        throw new Error("No valid object selected");
      }
      return apiRequest("PUT", `/api/objects/${validSelectedNode.data.objectId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      // Invalidate canvas for all layers to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/models", currentModel?.id, "canvas"] });
      setEditingObject(false);
    },
  });

  // Create attribute mutation
  const createAttributeMutation = useMutation({
    mutationFn: async (data: Partial<Attribute>) => {
      console.log('Creating attribute with data:', data);
      const result = await apiRequest("POST", "/api/attributes", data);
      console.log('Attribute creation result:', result);
      return result;
    },
    onSuccess: async (response) => {
      console.log('Attribute creation successful:', response);
      
      // Parse the response if it's a Response object
      const result = response instanceof Response ? await response.json() : response;

      // Optimistic update: add the new attribute to the cache immediately
      queryClient.setQueryData(
        ["/api/objects", validSelectedNode?.data?.objectId, "attributes"],
        (oldData: Attribute[] = []) => [...oldData, result as Attribute]
      );

      // Also refresh all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/objects", validSelectedNode?.data?.objectId, "attributes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      // Invalidate canvas to refresh node with new attribute
      queryClient.invalidateQueries({ queryKey: ["/api/models", currentModel?.id, "canvas"] });

      toast({
        title: "✓ Attribute Added Successfully",
        description: `${result.name} has been added to ${validSelectedNode?.data?.name}. Total attributes: ${(objectAttributes.length + 1)}`
      });
      
      // Auto-scroll to show the new attribute
      setTimeout(() => {
        const attributesList = document.getElementById('attributes-list');
        if (attributesList) {
          attributesList.scrollTop = attributesList.scrollHeight;
        }
      }, 100);

      setNewAttribute({
        name: "",
        conceptualType: "Text",
        logicalType: "",
        physicalType: "",
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
      });
      setEditingAttribute(null);
    },
    onError: (error) => {
      console.error('Failed to create attribute:', error);
      toast({
        title: "❌ Failed to Add Attribute",
        description: `Could not save ${newAttribute.name}. Please try again.`,
        variant: "destructive"
      });
    },
  });

  // Update attribute mutation
  const updateAttributeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Attribute> }) => {
      return apiRequest("PUT", `/api/attributes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects", validSelectedNode?.data?.objectId, "attributes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      // Invalidate canvas to refresh node with updated attribute
      queryClient.invalidateQueries({ queryKey: ["/api/models", currentModel?.id, "canvas"] });

      toast({
        title: "✓ Attribute Updated Successfully",
        description: "The attribute has been saved with your changes."
      });

      setEditingAttribute(null);
    },
  });

  // Delete attribute mutation
  const deleteAttributeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/attributes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects", validSelectedNode?.data?.objectId, "attributes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      // Invalidate canvas to refresh node with removed attribute
      queryClient.invalidateQueries({ queryKey: ["/api/models", currentModel?.id, "canvas"] });

      toast({
        title: "✓ Attribute Deleted",
        description: "The attribute has been removed."
      });
    },
  });

  // Generate logical object mutation (Conceptual → Logical)
  const generateLogicalMutation = useMutation({
    mutationFn: async () => {
      if (!validSelectedNode?.data?.objectId) {
        throw new Error("No valid object selected");
      }
      return apiRequest("POST", `/api/objects/${validSelectedNode.data.objectId}/generate-logical`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      // Invalidate all canvas views
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      
      toast({
        title: "✓ Logical Object Generated",
        description: `Successfully created logical object "${data.data?.createdObject?.name}" from conceptual object.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Failed to Generate Logical Object",
        description: error.message || "Could not generate logical object. Make sure a logical model exists.",
        variant: "destructive",
      });
    },
  });

  // Generate physical object mutation (Logical → Physical)
  const generatePhysicalMutation = useMutation({
    mutationFn: async () => {
      if (!validSelectedNode?.data?.objectId) {
        throw new Error("No valid object selected");
      }
      return apiRequest("POST", `/api/objects/${validSelectedNode.data.objectId}/generate-physical`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      // Invalidate all canvas views
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      
      toast({
        title: "✓ Physical Object Generated",
        description: `Successfully created physical object "${data.data?.createdObject?.name}" from logical object.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Failed to Generate Physical Object",
        description: error.message || "Could not generate physical object. Make sure a physical model exists.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateLogical = () => {
    if (confirm("Generate a logical object from this conceptual object? This will create a new object in the logical layer with all attributes.")) {
      generateLogicalMutation.mutate();
    }
  };

  const handleGeneratePhysical = () => {
    if (confirm("Generate a physical object from this logical object? This will create a new object in the physical layer with all attributes.")) {
      generatePhysicalMutation.mutate();
    }
  };

  const handleObjectUpdate = (field: string, value: any) => {
    console.log('handleObjectUpdate called:', field, value);
    if (!validSelectedNode) {
      console.log('No valid node selected');
      return;
    }

    if (!editingObject) {
      console.log('Not in editing mode, ignoring update');
      return;
    }

    // Update node in store immediately for UI responsiveness
    updateNode(validSelectedNode.id, {
      data: {
        ...validSelectedNode.data,
        [field]: value,
      },
    });

    // Also update nodes array directly to ensure immediate canvas refresh
    const updatedNodes = nodes.map((node) => 
      node.id === validSelectedNode.id 
        ? {
            ...node,
            data: {
              ...node.data,
              [field]: value,
            }
          }
        : node
    );
    setNodes(updatedNodes);

    // Also trigger a toast to confirm the update
    toast({
      title: "Property Updated",
      description: `${field === 'name' ? 'Object name' : field} updated successfully.`,
    });

    const updates: Partial<DataObject> = { [field]: value };
    console.log('Updating object with:', updates);
    updateObjectMutation.mutate(updates);
  };

  const handleAddAttribute = () => {
    console.log('handleAddAttribute called');
    console.log('validSelectedNode:', validSelectedNode);
    console.log('newAttribute:', newAttribute);
    console.log('objectAttributes count:', objectAttributes.length);

    if (!validSelectedNode || !newAttribute.name.trim()) {
      toast({
        title: "⚠️ Cannot Add Attribute",
        description: "Please enter an attribute name before saving.",
        variant: "destructive"
      });
      return;
    }

    const attributeData = {
      ...newAttribute,
      objectId: validSelectedNode.data.objectId,
      orderIndex: objectAttributes.length,
    };

    console.log('Creating attribute with data:', attributeData);
    console.log('Object ID for attribute:', validSelectedNode.data.objectId);
    createAttributeMutation.mutate(attributeData);
  };

  const handleUpdateAttribute = (attributeId: number, updates: Partial<Attribute>) => {
    updateAttributeMutation.mutate({ id: attributeId, data: updates });
  };

  const handleDeleteAttribute = (attributeId: number) => {
    deleteAttributeMutation.mutate(attributeId);
  };

  const handleAddCustomProperty = () => {
    if (!newCustomProperty.key.trim() || !validSelectedNode) return;

    const customProp: CustomProperty = {
      ...newCustomProperty,
      id: Date.now().toString(),
    };

    const updatedProperties = [...customProperties, customProp];
    setCustomProperties(updatedProperties);

    // Save to database
    const commonPropsObject = updatedProperties.reduce((acc, prop) => {
      acc[prop.key] = { value: prop.value, type: prop.type };
      return acc;
    }, {} as Record<string, any>);

    updateObjectMutation.mutate({ commonProperties: commonPropsObject });

    setNewCustomProperty({ key: "", value: "", type: "text" });
  };

  const handleDeleteCustomProperty = (id: string) => {
    if (!validSelectedNode) return;

    const updatedProperties = customProperties.filter(prop => prop.id !== id);
    setCustomProperties(updatedProperties);

    // Save to database
    const commonPropsObject = updatedProperties.reduce((acc, prop) => {
      acc[prop.key] = { value: prop.value, type: prop.type };
      return acc;
    }, {} as Record<string, any>);

    updateObjectMutation.mutate({ commonProperties: commonPropsObject });
  };

  const handleUpdateCustomProperty = (id: string, updates: Partial<CustomProperty>) => {
    setCustomProperties(prev => 
      prev.map(prop => prop.id === id ? { ...prop, ...updates } : prop)
    );
  };

  if (!validSelectedNode && !selectedAttributeId) {
    return (
      <aside className="w-80 bg-sidebar border-l border-sidebar-border overflow-y-auto shadow-soft">
        <div className="padding-responsive">
          <h2 className="text-responsive-lg font-semibold text-sidebar-foreground mb-4">Properties</h2>
          <div className="text-center py-8 text-muted-foreground">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-xl flex items-center justify-center shadow-soft">
              <Edit className="h-8 w-8" />
            </div>
            <p className="text-responsive-sm font-medium">Select an object or attribute</p>
            <p className="text-xs mt-1 opacity-75">Choose an object or attribute to edit its properties</p>
          </div>
        </div>
      </aside>
    );
  }

  // Show attribute properties when an attribute is selected
  if (selectedAttributeId && selectedAttribute) {
    return (
      <aside className="w-80 bg-sidebar border-l border-sidebar-border overflow-y-auto shadow-soft">
        <div className="padding-responsive">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-responsive-lg font-semibold text-sidebar-foreground">Attribute Properties</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => selectAttribute(null)}
              className="h-9 w-9 p-0 hover:bg-sidebar-accent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted">
              <TabsTrigger value="properties" className="text-responsive-xs">Properties</TabsTrigger>
              <TabsTrigger value="custom" className="text-responsive-xs">Custom</TabsTrigger>
            </TabsList>

            <TabsContent value="properties" className="space-responsive mt-4">
              {/* Selected Attribute Info */}
              <Card className="shadow-soft border-sidebar-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-responsive-sm flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-md flex items-center justify-center shadow-sm">
                      <div className="w-2 h-2 bg-blue-100 rounded-sm"></div>
                    </div>
                    <span className="truncate">{selectedAttribute.name}</span>
                    {selectedAttribute.isPrimaryKey && <Key className="h-3 w-3 text-yellow-500" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">ID</div>
                    <div className="font-mono text-xs">{selectedAttribute.id}</div>
                    <div className="text-muted-foreground">Type</div>
                    <div className="text-xs">Attribute</div>
                    <div className="text-muted-foreground">Layer</div>
                    <div className="capitalize text-xs">{currentLayer}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Attribute Properties Form */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Attribute Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="attrName" className="text-xs font-medium text-gray-600">Name</Label>
                    <Input
                      id="attrName"
                      value={selectedAttribute.name}
                      className="mt-1"
                      disabled
                    />
                  </div>

                  <div>
                    <Label htmlFor="attrDescription" className="text-xs font-medium text-gray-600">Description</Label>
                    <Input
                      id="attrDescription"
                      value={selectedAttribute.description || ""}
                      className="mt-1"
                      disabled
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-medium text-gray-600">Conceptual Type</Label>
                      <div className="mt-1 text-sm font-mono bg-muted p-2 rounded">
                        {selectedAttribute.conceptualType || "Not set"}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-600">Logical Type</Label>
                      <div className="mt-1 text-sm font-mono bg-muted p-2 rounded">
                        {selectedAttribute.logicalType || "Not set"}
                      </div>
                    </div>
                  </div>

                  {currentLayer === "physical" && (
                    <div>
                      <Label className="text-xs font-medium text-gray-600">Physical Type</Label>
                      <div className="mt-1 text-sm font-mono bg-muted p-2 rounded">
                        {selectedAttribute.physicalType || "Not set"}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <Checkbox checked={selectedAttribute.isPrimaryKey || false} disabled />
                      <span className="text-xs">Primary Key</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Checkbox checked={selectedAttribute.isForeignKey || false} disabled />
                      <span className="text-xs">Foreign Key</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Checkbox checked={selectedAttribute.nullable || false} disabled />
                      <span className="text-xs">Nullable</span>
                    </div>
                  </div>

                  {selectedAttribute.length && (
                    <div>
                      <Label className="text-xs font-medium text-gray-600">Length</Label>
                      <div className="mt-1 text-sm font-mono bg-muted p-2 rounded">
                        {selectedAttribute.length}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-medium text-gray-600">Order Index</Label>
                    <div className="mt-1 text-sm font-mono bg-muted p-2 rounded">
                      {selectedAttribute.orderIndex || "Not set"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="custom" className="space-responsive mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Custom Properties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Custom Properties for Attributes */}
                  {selectedAttribute.commonProperties && Object.keys(selectedAttribute.commonProperties).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(selectedAttribute.commonProperties).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="flex-1">
                            <div className="text-sm font-medium">{key}</div>
                            <div className="text-xs text-muted-foreground">{value.value || value}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">{value.type || 'text'}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No custom properties defined for this attribute.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full h-full bg-gradient-to-b from-white to-gray-50 dark:from-card dark:to-background border-l border-sidebar-border overflow-y-auto shadow-soft">
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-3 bg-white dark:bg-card border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <Edit className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Properties</h2>
              <p className="text-xs text-muted-foreground">Configure object details</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => selectNode(null)}
            className="h-8 w-8 p-0 hover:bg-sidebar-accent rounded-full"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col px-3">
          <TabsList className="grid w-full grid-cols-2 bg-muted/60 h-10 mb-3">
            <TabsTrigger value="properties" className="text-xs font-medium flex items-center space-x-1">
              <Layers className="h-3 w-3" />
              <span>Properties</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="text-xs font-medium flex items-center space-x-1">
              <Edit className="h-3 w-3" />
              <span>Custom</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="properties" className="flex-1 space-y-3 px-0">
            {/* Selected Object Info */}
            <Card className="shadow-sm border-0 bg-white dark:bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center space-x-2">
                  <div className={`p-1.5 rounded ${getSystemColorBg(validSelectedNode?.data?.sourceSystem)} border-l-4 ${getSystemColor(validSelectedNode?.data?.sourceSystem)}`}>
                    <DbIcon className={`h-3 w-3 ${getSystemColorText(validSelectedNode?.data?.sourceSystem)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground truncate text-xs">{validSelectedNode?.data?.name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">Data Object</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Object ID</div>
                    <div className="font-mono text-xs bg-muted/60 px-2 py-1 rounded">{validSelectedNode?.data?.objectId || "N/A"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Layer</div>
                    <Badge className="capitalize text-xs px-2 py-0.5">
                      <Layers className="h-2.5 w-2.5 mr-1" />
                      {currentLayer}
                    </Badge>
                  </div>
                </div>

                {/* System Information */}
                {validSelectedNode?.data?.sourceSystem && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Source System</div>
                    <div className={`flex items-center space-x-2 px-2 py-1 rounded ${getSystemColorBg(validSelectedNode.data.sourceSystem)}`}>
                      <Server className={`h-3 w-3 ${getSystemColorText(validSelectedNode.data.sourceSystem)}`} />
                      <span className={`font-medium text-xs ${getSystemColorText(validSelectedNode.data.sourceSystem)}`}>
                        {validSelectedNode.data.sourceSystem}
                      </span>
                    </div>
                  </div>
                )}

                {/* Layer Generation Actions */}
                {currentLayer === "conceptual" && (
                  <div className="pt-2 border-t">
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">Layer Actions</Label>
                    <Button
                      onClick={handleGenerateLogical}
                      disabled={generateLogicalMutation.isPending}
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      {generateLogicalMutation.isPending ? (
                        <>
                          <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Layers className="h-4 w-4 mr-2" />
                          Generate Logical Object
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Create a logical model object based on this conceptual object with type mappings
                    </p>
                  </div>
                )}

                {currentLayer === "logical" && (
                  <div className="pt-2 border-t">
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">Layer Actions</Label>
                    <Button
                      onClick={handleGeneratePhysical}
                      disabled={generatePhysicalMutation.isPending}
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      {generatePhysicalMutation.isPending ? (
                        <>
                          <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <DbIcon className="h-4 w-4 mr-2" />
                          Generate Physical Object
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Create a physical model object based on this logical object with database types
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Object Properties Form */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center justify-between">
                  Object Properties
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      console.log('Edit button clicked, current editingObject:', editingObject);
                      setEditingObject(!editingObject);
                      if (!editingObject) {
                        toast({
                          title: "Editing Mode Enabled",
                          description: "You can now modify object properties and domains.",
                        });
                      }
                    }} 
                    className={`h-6 w-6 p-0 transition-colors ${editingObject ? 'bg-primary/10 text-primary' : ''}`}
                    title={editingObject ? "Exit edit mode" : "Enable edit mode"}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label htmlFor="objectName" className="text-xs font-medium text-gray-600">
                    Name
                  </Label>
                  <Input
                    id="objectName"
                    value={validSelectedNode?.data?.name || ""}
                    onChange={(e) => {
                      console.log('Name field changed to:', e.target.value);
                      handleObjectUpdate("name", e.target.value);
                    }}
                    className="mt-1"
                    disabled={!editingObject}
                    placeholder={editingObject ? "Enter object name..." : "Click edit button to modify"}
                  />
                </div>

                <div>
                  <Label htmlFor="domain" className="text-xs font-medium text-gray-600">
                    Domain
                  </Label>
                  <Select
                    value={validSelectedNode?.data?.domain || ""}
                    onValueChange={(value) => {
                      console.log('Domain dropdown changed to:', value);
                      handleObjectUpdate("domain", value);
                    }}
                    disabled={!editingObject}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {(allDomains as any[]).map((domain: any) => (
                        <SelectItem key={domain.id} value={domain.name}>
                          {domain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dataArea" className="text-xs font-medium text-gray-600">
                    Data Area
                  </Label>
                  <Select
                    value={validSelectedNode?.data?.dataArea || ""}
                    onValueChange={(value) => handleObjectUpdate("dataArea", value)}
                    disabled={!editingObject}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select data area" />
                    </SelectTrigger>
                    <SelectContent>
                      {domainAreas.map((area) => (
                        <SelectItem key={area.id} value={area.name}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Attributes Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  Attributes ({objectAttributes.length})
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingAttribute(-1)}
                    className="text-primary hover:text-primary border-primary/20 hover:bg-primary/5"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add New
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2" id="attributes-list">
                {/* Add New Attribute Form */}
                {editingAttribute === -1 && (
                  <div className="border-2 border-primary/20 rounded-lg p-4 bg-primary/5 shadow-sm">
                    <div className="flex items-center mb-3">
                      <Plus className="h-4 w-4 text-primary mr-2" />
                      <h4 className="text-sm font-semibold text-primary">Add New Attribute</h4>
                    </div>
                    <div className="space-y-3">
                      <Input
                        placeholder="Attribute name"
                        value={newAttribute.name}
                        onChange={(e) =>
                          setNewAttribute({ ...newAttribute, name: e.target.value })
                        }
                      />

                      {/* Type selection based on current layer */}
                      {currentLayer === "conceptual" && (
                        <Select
                          value={newAttribute.conceptualType}
                          onValueChange={(value) =>
                            setNewAttribute({ ...newAttribute, conceptualType: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Text">Text</SelectItem>
                            <SelectItem value="Number">Number</SelectItem>
                            <SelectItem value="Decimal">Decimal</SelectItem>
                            <SelectItem value="Date">Date</SelectItem>
                            <SelectItem value="DateTime">DateTime</SelectItem>
                            <SelectItem value="Boolean">Boolean</SelectItem>
                            <SelectItem value="Currency">Currency</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      <div className="flex items-center space-x-3 text-sm">
                        <label className="flex items-center space-x-1">
                          <Checkbox
                            checked={newAttribute.isPrimaryKey}
                            onCheckedChange={(checked) =>
                              setNewAttribute({ ...newAttribute, isPrimaryKey: checked as boolean })
                            }
                          />
                          <span>PK</span>
                        </label>
                        <label className="flex items-center space-x-1">
                          <Checkbox
                            checked={newAttribute.isForeignKey}
                            onCheckedChange={(checked) =>
                              setNewAttribute({ ...newAttribute, isForeignKey: checked as boolean })
                            }
                          />
                          <span>FK</span>
                        </label>
                        <label className="flex items-center space-x-1">
                          <Checkbox
                            checked={newAttribute.nullable}
                            onCheckedChange={(checked) =>
                              setNewAttribute({ ...newAttribute, nullable: checked as boolean })
                            }
                          />
                          <span>Null</span>
                        </label>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button 
                          size="sm" 
                          onClick={handleAddAttribute}
                          disabled={!newAttribute.name.trim() || createAttributeMutation.isPending}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {createAttributeMutation.isPending ? "Adding..." : "✓ Add Attribute"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setEditingAttribute(null);
                            setNewAttribute({
                              name: "",
                              conceptualType: "Text",
                              logicalType: "",
                              physicalType: "",
                              nullable: true,
                              isPrimaryKey: false,
                              isForeignKey: false,
                            });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Attributes List */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {objectAttributes.map((attr) => (
                    <div key={attr.id} className="border border-border rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{attr.name}</span>
                        <div className="flex items-center space-x-1">
                          {attr.isPrimaryKey && (
                            <Key className="h-3 w-3 text-yellow-500" />
                          )}
                          {attr.isForeignKey && (
                            <ExternalLink className="h-3 w-3 text-blue-500" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingAttribute(attr.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAttribute(attr.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Layer-specific type display */}
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-medium">{attr.conceptualType}</span>
                        </div>
                        {currentLayer === "physical" && attr.physicalType && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Physical:</span>
                            <span className="font-medium">{attr.physicalType}</span>
                          </div>
                        )}
                        <div className="flex space-x-2">
                          <Badge variant={attr.nullable ? "outline" : "default"} className="text-xs">
                            {attr.nullable ? "Nullable" : "Not Null"}
                          </Badge>
                        </div>
                      </div>

                      {/* Edit Attribute Form */}
                      {editingAttribute === attr.id && (
                        <div className="mt-3 p-3 border border-primary rounded-md bg-primary/5">
                          <AttributeEditForm 
                            attribute={attr}
                            currentLayer={currentLayer}
                            onSave={(updates) => handleUpdateAttribute(attr.id, updates)}
                            onCancel={() => setEditingAttribute(null)}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {objectAttributes.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No attributes defined
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-4">
            {/* Custom Properties */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  Custom Properties
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddCustomProperty}
                    disabled={!newCustomProperty.key.trim()}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Add Custom Property */}
                <div className="space-y-2">
                  <Input
                    placeholder="Property name"
                    value={newCustomProperty.key}
                    onChange={(e) => setNewCustomProperty({ ...newCustomProperty, key: e.target.value })}
                  />
                  <div className="flex space-x-2">
                    <Select
                      value={newCustomProperty.type}
                      onValueChange={(value: 'text' | 'number' | 'boolean' | 'date') => 
                        setNewCustomProperty({ ...newCustomProperty, type: value })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Value"
                      value={newCustomProperty.value}
                      onChange={(e) => setNewCustomProperty({ ...newCustomProperty, value: e.target.value })}
                      type={newCustomProperty.type === 'number' ? 'number' : 
                            newCustomProperty.type === 'date' ? 'date' : 'text'}
                    />
                  </div>
                </div>

                {/* Custom Properties List */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {customProperties.map((prop) => (
                    <div key={prop.id} className="flex items-center justify-between p-2 border border-border rounded">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{prop.key}</div>
                        <div className="text-xs text-muted-foreground">{prop.value}</div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Badge variant="outline" className="text-xs">
                          {prop.type}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCustomProperty(prop.id)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {customProperties.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No custom properties defined
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}