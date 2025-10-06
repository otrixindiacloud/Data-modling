import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useModelerStore } from "@/store/modelerStore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { InsertDataObject, DataDomain, DataArea } from "@shared/schema";

interface AddDataObjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddDataObjectModal({ open, onOpenChange }: AddDataObjectModalProps) {
  const { currentModel, currentLayer } = useModelerStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [objectName, setObjectName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedDataArea, setSelectedDataArea] = useState("");
  const [sourceSystem, setSourceSystem] = useState("");
  const [targetSystem, setTargetSystem] = useState("Data Lake");
  const [attributes, setAttributes] = useState<Array<{
    name: string;
    conceptualType: string;
    logicalType: string;
    physicalType: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    nullable: boolean;
    length?: number;
  }>>([
    { name: "", conceptualType: "Text", logicalType: "", physicalType: "", isPrimaryKey: false, isForeignKey: false, nullable: true }
  ]);

  // Fetch domains
  const { data: domains = [] } = useQuery({
    queryKey: ["/api/domains"],
    queryFn: async () => {
      const response = await fetch("/api/domains");
      return response.json();
    }
  });

  // Fetch data areas for selected domain
  const { data: dataAreas = [], error: dataAreasError } = useQuery({
    queryKey: ["/api/domains", selectedDomain, "areas"],
    queryFn: async () => {
      if (!selectedDomain) return [];
      const response = await fetch(`/api/domains/${selectedDomain}/areas`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data areas: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!selectedDomain
  });

  const createObjectMutation = useMutation({
    mutationFn: async (objectData: InsertDataObject & { attributes: typeof attributes }) => {
      const { attributes: attrData, ...objData } = objectData;

      if (!currentModel) {
        throw new Error("No current model selected");
      }

      const allModelsResponse = await fetch("/api/models");
      if (!allModelsResponse.ok) {
        throw new Error("Failed to load data models");
      }
      const allModels = await allModelsResponse.json();

      let modelFamily: any[] = [];

      if (currentModel.layer === "conceptual") {
        modelFamily = allModels.filter(
          (model: any) => model.id === currentModel.id || model.parentModelId === currentModel.id,
        );
      } else if (currentModel.layer === "logical" || currentModel.layer === "physical") {
        const conceptualParent = allModels.find(
          (model: any) => model.id === currentModel.parentModelId && model.layer === "conceptual",
        );

        if (conceptualParent) {
          modelFamily = allModels.filter(
            (model: any) => model.id === conceptualParent.id || model.parentModelId === conceptualParent.id,
          );
        } else {
          modelFamily = [currentModel];
        }
      } else {
        modelFamily = [currentModel];
      }

      const conceptualModel = modelFamily.find((model: any) => model.layer === "conceptual");
      const logicalModel = modelFamily.find((model: any) => model.layer === "logical");
      const physicalModel = modelFamily.find((model: any) => model.layer === "physical");

      if (!conceptualModel || !logicalModel || !physicalModel) {
        console.error("Model family detection failed:", {
          currentModel,
          modelFamily,
          conceptualModel,
          logicalModel,
          physicalModel,
        });
        throw new Error(
          `Model family incomplete - missing conceptual, logical, or physical layer. Found: conceptual=${!!conceptualModel}, logical=${!!logicalModel}, physical=${!!physicalModel}`,
        );
      }

      const position = {
        x: Math.random() * 300 + 50,
        y: Math.random() * 300 + 50,
      };

      const filteredAttributes = attrData.filter((attr) => attr.name.trim());

      const payload = {
        ...objData,
        modelId: conceptualModel.id,
        attributes: filteredAttributes.map((attr, index) => ({
          name: attr.name,
          conceptualType: attr.conceptualType || null,
          logicalType: attr.logicalType || null,
          physicalType: attr.physicalType || null,
          dataType: attr.logicalType || attr.physicalType || attr.conceptualType || null,
          nullable: attr.nullable,
          isPrimaryKey: attr.isPrimaryKey,
          isForeignKey: attr.isForeignKey,
          length: attr.length ?? null,
          orderIndex: index,
        })),
        cascade: true,
        modelObjectConfig: {
          position,
          isVisible: true,
          layerSpecificConfig: {
            position,
          },
        },
        layerModelObjectConfig: {
          logical: { position },
          physical: { position },
        },
      };

      const response = await fetch("/api/objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let details: any = null;
        try {
          details = await response.json();
        } catch (err) {
          // ignore JSON parse error
        }
        throw new Error(`Failed to create object: ${details?.message ?? response.statusText}`);
      }

      const cascadeResult = await response.json();

      return { cascadeResult, attributes: filteredAttributes };
    },
    onSuccess: ({ cascadeResult, attributes: createdAttributes }) => {
      const conceptualLayer = cascadeResult?.layers?.conceptual;
      const conceptualObject = conceptualLayer?.object ?? cascadeResult?.primaryObject;

      if (!conceptualObject) {
        console.warn("Cascade response missing conceptual object", cascadeResult);
        return;
      }

      window.dispatchEvent(
        new CustomEvent("objectCreated", {
          detail: {
            objectId: conceptualObject.id,
            name: conceptualObject.name,
            attributes: createdAttributes,
            timestamp: new Date(),
          },
        }),
      );

      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("forceDataRefresh", {
            detail: { reason: "object_created", objectId: conceptualObject.id },
          }),
        );
      }, 300);

      toast({
        title: "✓ Object Created Successfully",
        description: `${conceptualObject.name} has been added to the model with ${createdAttributes.length} attributes.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attributes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", currentModel?.id, "canvas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/models", currentModel?.id, "objects"] });

      queryClient.refetchQueries({ queryKey: ["/api/objects"] });
      queryClient.refetchQueries({ queryKey: ["/api/attributes"] });

      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message ?? "Failed to create object. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setObjectName("");
    setDescription("");
    setSelectedDomain("");
    setSelectedDataArea("");
    setSourceSystem("");
    setTargetSystem("Data Lake");
    setAttributes([
      { name: "", conceptualType: "", logicalType: "", physicalType: "", isPrimaryKey: false, isForeignKey: false, nullable: true }
    ]);
  };

  const addAttribute = () => {
    setAttributes([...attributes, {
      name: "",
      conceptualType: "",
      logicalType: "",
      physicalType: "",
      isPrimaryKey: false,
      isForeignKey: false,
      nullable: true
    }]);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const updateAttribute = (index: number, field: string, value: any) => {
    const updated = [...attributes];
    updated[index] = { ...updated[index], [field]: value };
    setAttributes(updated);
  };

  const handleSubmit = () => {
    if (!objectName.trim() || !currentModel?.id) return;

    const selectedDomainObj = domains.find((d: any) => d.id.toString() === selectedDomain);
    const selectedAreaObj = Array.isArray(dataAreas) ? dataAreas.find((a: any) => a.id.toString() === selectedDataArea) : null;

    createObjectMutation.mutate({
      name: objectName,
      description: description || null,
      objectType: "entity", // Required field for dataObjects schema
      modelId: currentModel.id, // Add the required modelId
      domainId: selectedDomainObj ? selectedDomainObj.id : null,
      dataAreaId: selectedAreaObj ? selectedAreaObj.id : null,
      // sourceSystem: sourceSystem || null, // Will be handled via sourceSystemId
      isNew: true,
      attributes: attributes.filter(attr => attr.name.trim())
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        // Ensure cleanup on close
        resetForm();
      }
      onOpenChange(open);
    }}>
      <DialogContent 
        className="max-w-6xl w-[90vw] max-h-[95vh] overflow-hidden flex flex-col p-0"
        onInteractOutside={(e) => {
          // Allow interaction with dropdown menus
          const target = e.target as HTMLElement;
          if (target.closest('[data-radix-select-content]') || 
              target.closest('[data-radix-select-viewport]') ||
              target.closest('[role="listbox"]')) {
            return;
          }
          e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          // Allow dropdown interaction
          const target = e.target as HTMLElement;
          if (target.closest('[data-radix-select-content]') || 
              target.closest('[data-radix-select-viewport]') ||
              target.closest('[role="listbox"]')) {
            e.preventDefault();
          }
        }}
      >
        <div className="px-6 py-4 border-b bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-semibold">Add Data Object</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
              Create a new data object for your data model with attributes and relationships.
            </DialogDescription>
          </DialogHeader>
          {/* Enhanced close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Close modal"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="objectName">Object Name *</Label>
              <Input
                id="objectName"
                value={objectName}
                onChange={(e) => setObjectName(e.target.value)}
                placeholder="e.g., Customer, Product, Order"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sourceSystem">Source System</Label>
              <Input
                id="sourceSystem"
                value={sourceSystem}
                onChange={(e) => setSourceSystem(e.target.value)}
                placeholder="e.g., CRM System, ERP System"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and content of this data object"
              rows={3}
            />
          </div>

          {/* Domain and Area Selection - Enhanced for reliable dropdown interaction */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Select 
                value={selectedDomain} 
                onValueChange={setSelectedDomain}
                onOpenChange={(open) => {
                  // Force focus management to ensure dropdown opens properly
                  if (open) {
                    setTimeout(() => {
                      const trigger = document.querySelector('[data-state="open"][role="combobox"]');
                      if (trigger) {
                        (trigger as HTMLElement).focus();
                      }
                    }, 0);
                  }
                }}
              >
                <SelectTrigger 
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onPointerDown={(e) => {
                    // Prevent event conflicts that might prevent opening
                    e.stopPropagation();
                  }}
                  onFocus={(e) => {
                    // Ensure proper focus state
                    e.target.setAttribute('data-focused', 'true');
                  }}
                  onBlur={(e) => {
                    e.target.removeAttribute('data-focused');
                  }}
                >
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent 
                  className="z-[60] max-h-[200px] overflow-auto"
                  position="popper"
                  sideOffset={4}
                >
                  {domains.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">No domains available</div>
                  ) : (
                    domains.map((domain: DataDomain) => (
                      <SelectItem 
                        key={domain.id} 
                        value={domain.id.toString()}
                        className="focus:bg-blue-50 focus:text-blue-900"
                      >
                        <span className="font-medium">{domain.name}</span>
                        {domain.description && (
                          <span className="block text-xs text-gray-500 mt-1">
                            {domain.description}
                          </span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataArea">Data Area</Label>
              <Select 
                value={selectedDataArea} 
                onValueChange={setSelectedDataArea} 
                disabled={!selectedDomain}
                onOpenChange={(open) => {
                  // Force focus management for data area dropdown
                  if (open && selectedDomain) {
                    setTimeout(() => {
                      const trigger = document.querySelector('[data-state="open"][role="combobox"]');
                      if (trigger) {
                        (trigger as HTMLElement).focus();
                      }
                    }, 0);
                  }
                }}
              >
                <SelectTrigger 
                  className={`focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    !selectedDomain ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  onPointerDown={(e) => {
                    if (!selectedDomain) return;
                    e.stopPropagation();
                  }}
                  onFocus={(e) => {
                    if (selectedDomain) {
                      e.target.setAttribute('data-focused', 'true');
                    }
                  }}
                  onBlur={(e) => {
                    e.target.removeAttribute('data-focused');
                  }}
                >
                  <SelectValue placeholder={selectedDomain ? "Select data area" : "Select domain first"} />
                </SelectTrigger>
                <SelectContent 
                  className="z-[60] max-h-[200px] overflow-auto"
                  position="popper"
                  sideOffset={4}
                >
                  {dataAreasError ? (
                    <div className="p-2 text-sm text-red-500">
                      Error loading data areas: {dataAreasError.message}
                    </div>
                  ) : !Array.isArray(dataAreas) ? (
                    <div className="p-2 text-sm text-gray-500">
                      Loading data areas...
                    </div>
                  ) : dataAreas.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">
                      {selectedDomain ? 'No data areas available for this domain' : 'Select a domain first'}
                    </div>
                  ) : (
                    dataAreas.map((area: DataArea) => (
                      <SelectItem 
                        key={area.id} 
                        value={area.id.toString()}
                        className="focus:bg-blue-50 focus:text-blue-900"
                      >
                        <span className="font-medium">{area.name}</span>
                        {area.description && (
                          <span className="block text-xs text-gray-500 mt-1">
                            {area.description}
                          </span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetSystem">Target System</Label>
              <Select 
                value={targetSystem} 
                onValueChange={setTargetSystem}
                onOpenChange={(open) => {
                  if (open) {
                    setTimeout(() => {
                      const trigger = document.querySelector('[data-state="open"][role="combobox"]');
                      if (trigger) {
                        (trigger as HTMLElement).focus();
                      }
                    }, 0);
                  }
                }}
              >
                <SelectTrigger 
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  className="z-[60]"
                  position="popper"
                  sideOffset={4}
                >
                  <SelectItem value="Data Lake">
                    <span className="font-medium">Data Lake</span>
                    <span className="block text-xs text-gray-500">Centralized repository for structured/unstructured data</span>
                  </SelectItem>
                  <SelectItem value="Data Warehouse">
                    <span className="font-medium">Data Warehouse</span>
                    <span className="block text-xs text-gray-500">Optimized for analytics and reporting</span>
                  </SelectItem>
                  <SelectItem value="Operational Database">
                    <span className="font-medium">Operational Database</span>
                    <span className="block text-xs text-gray-500">Transaction processing system</span>
                  </SelectItem>
                  <SelectItem value="Analytics Platform">
                    <span className="font-medium">Analytics Platform</span>
                    <span className="block text-xs text-gray-500">Business intelligence and analytics</span>
                  </SelectItem>
                  <SelectItem value="Reporting System">
                    <span className="font-medium">Reporting System</span>
                    <span className="block text-xs text-gray-500">Automated reporting and dashboards</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enhanced Attributes Section */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 py-2 z-10 border-b">
              <div>
                <Label className="text-base font-medium">Attributes</Label>
                <p className="text-xs text-gray-500 mt-1">Define the fields for this data object</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addAttribute} className="shrink-0">
                <Plus className="h-4 w-4 mr-1" />
                Add Attribute
              </Button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto border rounded-lg bg-gray-50/50 dark:bg-gray-900/50 p-4">
              {attributes.map((attr, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        #{index + 1}
                      </span>
                      <span className="text-sm text-gray-600">
                        {attr.name || `Attribute ${index + 1}`}
                      </span>
                    </div>
                    {attributes.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeAttribute(index)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={attr.name}
                        onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                        placeholder="e.g., customer_id"
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Conceptual Type</Label>
                      <Select 
                        value={attr.conceptualType} 
                        onValueChange={(value) => updateAttribute(index, 'conceptualType', value)}
                        key={`conceptual-${index}`}
                      >
                        <SelectTrigger 
                          className="text-sm h-9 border-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 cursor-pointer"
                          data-testid={`select-conceptual-type-${index}`}
                        >
                          <SelectValue placeholder="Choose conceptual type" />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          <SelectItem value="Text">Text - Textual Data</SelectItem>
                          <SelectItem value="Number">Number - Numeric Data</SelectItem>
                          <SelectItem value="Date">Date - Date/Time Data</SelectItem>
                          <SelectItem value="Boolean">Boolean - True/False</SelectItem>
                          <SelectItem value="Currency">Currency - Monetary Values</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Logical Type</Label>
                      <Select 
                        value={attr.logicalType} 
                        onValueChange={(value) => updateAttribute(index, 'logicalType', value)}
                        key={`logical-${index}`}
                      >
                        <SelectTrigger 
                          className="text-sm h-9 border-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 cursor-pointer"
                          data-testid={`select-logical-type-${index}`}
                        >
                          <SelectValue placeholder="Choose logical type" />
                        </SelectTrigger>
                        <SelectContent className="z-50"
                          ref={(ref) => {
                            // Force proper positioning
                            if (ref) {
                              ref.style.zIndex = '9999';
                            }
                          }}
                        >
                          <SelectItem value="VARCHAR">VARCHAR - Variable Length Text</SelectItem>
                          <SelectItem value="INTEGER">INTEGER - Whole Numbers</SelectItem>
                          <SelectItem value="DECIMAL">DECIMAL - Decimal Numbers</SelectItem>
                          <SelectItem value="DATE">DATE - Date Only</SelectItem>
                          <SelectItem value="DATETIME">DATETIME - Date and Time</SelectItem>
                          <SelectItem value="TIMESTAMP">TIMESTAMP - Unix Timestamp</SelectItem>
                          <SelectItem value="BOOLEAN">BOOLEAN - True/False</SelectItem>
                          <SelectItem value="TEXT">TEXT - Large Text</SelectItem>
                          <SelectItem value="JSON">JSON - Structured Data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Physical Type</Label>
                      <div className="relative">
                        <Input
                          value={attr.physicalType}
                          onChange={(e) => updateAttribute(index, 'physicalType', e.target.value)}
                          placeholder="e.g., VARCHAR(50), INT, DECIMAL(10,2)"
                          className="text-sm h-9 px-3 border-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all"
                          onFocus={(e) => {
                            // Ensure full selection for better UX
                            e.target.select();
                            
                            // Auto-fill based on logical type if empty
                            if (!attr.physicalType && attr.logicalType) {
                              const suggestions = {
                                'VARCHAR': 'VARCHAR(255)',
                                'INTEGER': 'INT', 
                                'DECIMAL': 'DECIMAL(10,2)',
                                'DATE': 'DATE',
                                'DATETIME': 'DATETIME',
                                'TIMESTAMP': 'TIMESTAMP',
                                'BOOLEAN': 'BOOLEAN',
                                'TEXT': 'TEXT',
                                'JSON': 'JSON'
                              };
                              const suggestion = suggestions[attr.logicalType as keyof typeof suggestions];
                              if (suggestion) {
                                setTimeout(() => {
                                  updateAttribute(index, 'physicalType', suggestion);
                                  // Focus and select the auto-filled text
                                  e.target.focus();
                                  e.target.select();
                                }, 50);
                              }
                            }
                          }}
                          onBlur={(e) => {
                            // Validate and provide suggestions
                            const value = e.target.value.trim();
                            if (!value && attr.logicalType) {
                              // Show hint about auto-completion
                              e.target.placeholder = `Try clicking to auto-complete from ${attr.logicalType}`;
                            }
                          }}
                          data-testid={`input-physical-type-${index}`}
                        />
                        {attr.logicalType && !attr.physicalType && (
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              Click to auto-fill
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Enhanced checkbox controls with larger click areas */}
                  <div className="grid grid-cols-1 gap-2">
                    <label className="flex items-center space-x-3 text-sm cursor-pointer p-3 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all group">
                      <input
                        type="checkbox"
                        checked={attr.isPrimaryKey}
                        onChange={(e) => {
                          updateAttribute(index, 'isPrimaryKey', e.target.checked);
                          // Auto-set nullable to false for primary keys
                          if (e.target.checked) {
                            updateAttribute(index, 'nullable', false);
                          }
                        }}
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                        data-testid={`checkbox-primary-key-${index}`}
                      />
                      <span className="select-none font-medium group-hover:text-blue-600 transition-colors">Primary Key</span>
                      <span className="text-xs text-gray-500 ml-auto">(Auto-sets nullable = false)</span>
                    </label>

                    <label className="flex items-center space-x-3 text-sm cursor-pointer p-3 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all group">
                      <input
                        type="checkbox"
                        checked={attr.isForeignKey}
                        onChange={(e) => updateAttribute(index, 'isForeignKey', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                        data-testid={`checkbox-foreign-key-${index}`}
                      />
                      <span className="select-none font-medium group-hover:text-blue-600 transition-colors">Foreign Key</span>
                      {attr.isForeignKey && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="ml-auto h-7 text-xs px-3"
                          onClick={() => {
                            toast({
                              title: "Foreign Key Reference",
                              description: "Foreign key target selection will be implemented in the next update.",
                            });
                          }}
                        >
                          Set Target
                        </Button>
                      )}
                    </label>

                    <label className="flex items-center space-x-3 text-sm cursor-pointer p-3 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all group">
                      <input
                        type="checkbox"
                        checked={attr.nullable}
                        onChange={(e) => updateAttribute(index, 'nullable', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                        disabled={attr.isPrimaryKey} // Primary keys cannot be nullable
                        data-testid={`checkbox-nullable-${index}`}
                      />
                      <span className={cn("select-none font-medium transition-colors", 
                        attr.isPrimaryKey ? "text-gray-400" : "group-hover:text-blue-600")}>
                        Nullable
                      </span>
                      {attr.isPrimaryKey && (
                        <span className="text-xs text-gray-400 ml-auto">(Disabled for primary keys)</span>
                      )}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          </div>
        </div>
        
        {/* Fixed Actions Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {attributes.filter(attr => attr.name.trim()).length} of {attributes.length} attributes defined
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createObjectMutation.isPending}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!objectName.trim() || createObjectMutation.isPending}
              className="min-w-[120px]"
            >
              {createObjectMutation.isPending ? "Creating..." : "Create Object"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}