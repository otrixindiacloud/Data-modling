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
  // Debug: Log when component renders
  console.log('[AddDataObjectModal] Component rendered, open:', open);
  
  const { currentModel, currentLayer } = useModelerStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [objectName, setObjectName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedDataArea, setSelectedDataArea] = useState("");
  const [sourceSystem, setSourceSystem] = useState("");
  const [targetSystem, setTargetSystem] = useState("");
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

  // Fetch systems
  const { data: systems = [] } = useQuery({
    queryKey: ["/api/systems"],
    queryFn: async () => {
      const response = await fetch("/api/systems");
      if (!response.ok) {
        throw new Error(`Failed to fetch systems: ${response.statusText}`);
      }
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
    mutationFn: async (objectData: any) => {
      // New API: Creates objects directly in data_model_objects (no data_objects entry)
      // data_objects table is reserved for system sync only
      const response = await fetch("/api/objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(objectData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create object");
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("Object created successfully:", data);
      
      // Invalidate relevant queries - MUST include canvas query to refresh display
      // Use broader invalidation pattern to catch all canvas queries for this model
      queryClient.invalidateQueries({ 
        queryKey: ["/api/models", currentModel?.id],
        exact: false // This will invalidate all queries starting with this key
      });
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attributes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      
      toast({
        title: "✓ Object Created Successfully",
        description: `${data.modelObject.name} has been added to the model with ${data.attributes.length} attributes.`,
      });
      
      // Reset form and close modal
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Error creating object:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create object. Please try again.",
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
    setTargetSystem("");
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

    // Ensure we're in Conceptual layer with a Conceptual model
    if (currentLayer !== 'conceptual' || currentModel.layer !== 'conceptual') {
      toast({
        title: "Layer Restriction",
        description: "Objects can only be created in Conceptual layer. Switch to Conceptual layer to add objects.",
        variant: "destructive",
      });
      return;
    }

    const selectedDomainObj = domains.find((d: any) => d.id.toString() === selectedDomain);
    const selectedAreaObj = Array.isArray(dataAreas) ? dataAreas.find((a: any) => a.id.toString() === selectedDataArea) : null;
    
    // Find system IDs by name
    const sourceSystemObj = systems.find((s: any) => s.name === sourceSystem);
    const targetSystemObj = systems.find((s: any) => s.name === targetSystem);

    // Generate random position for the object
    const position = {
      x: Math.random() * 300 + 50,
      y: Math.random() * 300 + 50,
    };

    createObjectMutation.mutate({
      name: objectName,
      description: description || undefined,
      objectType: "entity",
      modelId: currentModel.id,
      domainId: selectedDomainObj ? selectedDomainObj.id : undefined,
      dataAreaId: selectedAreaObj ? selectedAreaObj.id : undefined,
      sourceSystemId: sourceSystemObj ? sourceSystemObj.id : undefined,
      targetSystemId: targetSystemObj ? targetSystemObj.id : undefined,
      position,
      attributes: attributes.filter(attr => attr.name.trim()).map((attr, index) => ({
        name: attr.name,
        conceptualType: attr.conceptualType || undefined,
        logicalType: attr.logicalType || undefined,
        physicalType: attr.physicalType || undefined,
        dataType: attr.logicalType || attr.physicalType || attr.conceptualType || undefined,
        nullable: attr.nullable,
        isPrimaryKey: attr.isPrimaryKey,
        isForeignKey: attr.isForeignKey,
        orderIndex: index,
      }))
    });
  };

  console.log('[AddDataObjectModal] Rendering Dialog, open:', open, 'layer:', currentLayer);

  // CRITICAL: Only render in Conceptual layer and when open
  // This prevents multiple modals (one per layer) from appearing
  if (!open || currentLayer !== 'conceptual') {
    return null;
  }

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
            <DialogTitle className="text-lg font-semibold">Add Data Object (Conceptual Layer)</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
              Create a new conceptual data object. Logical and Physical layer objects will be generated from this conceptual object.
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
              <Select 
                value={sourceSystem} 
                onValueChange={setSourceSystem}
              >
                <SelectTrigger 
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <SelectValue placeholder="Select source system" />
                </SelectTrigger>
                <SelectContent 
                  className="z-[60] max-h-[200px] overflow-auto"
                  position="popper"
                  sideOffset={4}
                >
                  {systems.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">No systems available</div>
                  ) : (
                    systems
                      .filter((system: any) => system.canBeSource !== false)
                      .map((system: any) => (
                        <SelectItem 
                          key={system.id} 
                          value={system.id.toString()}
                          className="focus:bg-blue-50 focus:text-blue-900"
                        >
                          <span className="font-medium">{system.name}</span>
                          {system.category && (
                            <span className="block text-xs text-gray-500 mt-1">
                              {system.category}
                            </span>
                          )}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
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
                  {systems.filter(s => s.canBeTarget !== false).map((system) => (
                    <SelectItem key={system.id} value={system.name}>
                      <span className="font-medium">{system.name}</span>
                      {system.category && (
                        <span className="block text-xs text-gray-500">
                          {system.category}
                        </span>
                      )}
                    </SelectItem>
                  ))}
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