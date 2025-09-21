import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Search, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useModelerStore } from "@/store/modelerStore";
import type { DataModel } from "@shared/schema";

interface ImprovedModelPickerProps {
  onCreateNew?: () => void;
  compact?: boolean;
}

export default function ImprovedModelPicker({ onCreateNew, compact = false }: ImprovedModelPickerProps) {
  const { currentModel, setCurrentModel } = useModelerStore();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch models with enhanced metadata
  const { data: models = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/models", "enhanced"],
    queryFn: async () => {
      const response = await fetch("/api/models");
      return response.json();
    },
    staleTime: 30000 // Cache for 30 seconds
  });

  // Filter and group models
  const filteredModels = useMemo(() => {
    let filtered = models;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = models.filter((model: DataModel) =>
        model.name.toLowerCase().includes(search) ||
        // model.description?.toLowerCase().includes(search) ||
        model.layer.toLowerCase().includes(search)
      );
    }

    // Group by layer for better organization
    const grouped = filtered.reduce((acc: any, model: DataModel) => {
      const layer = model.layer || 'conceptual';
      if (!acc[layer]) acc[layer] = [];
      acc[layer].push(model);
      return acc;
    }, {});

    // Sort each group by name
    Object.keys(grouped).forEach(layer => {
      grouped[layer].sort((a: DataModel, b: DataModel) => a.name.localeCompare(b.name));
    });

    return grouped;
  }, [models, searchTerm]);

  const handleSelectModel = (model: DataModel) => {
    setCurrentModel(model);
    setOpen(false);
  };

  const formatModelInfo = (model: DataModel) => {
    const parts = [];
    // if (model.version) parts.push(`v${model.version}`);
    if (model.layer) parts.push(model.layer);
    return parts.length > 0 ? parts.join(' • ') : 'Latest';
  };

  const getLayerColor = (layer: string) => {
    switch (layer) {
      case 'conceptual': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'logical': return 'bg-green-100 text-green-700 border-green-200';
      case 'physical': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "justify-between min-w-[200px] max-w-[300px]",
              !currentModel && "text-muted-foreground"
            )}
            data-testid="model-picker-compact"
          >
            {currentModel ? (
              <div className="flex items-center space-x-2 truncate">
                <Badge variant="outline" className={cn("text-xs px-1.5 py-0.5", getLayerColor(currentModel.layer || 'conceptual'))}>
                  {currentModel.layer || 'conceptual'}
                </Badge>
                <span className="truncate">{currentModel.name}</span>
              </div>
            ) : (
              "Select model..."
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search models..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="h-9"
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading models...</span>
                </div>
              ) : Object.keys(filteredModels).length === 0 ? (
                <CommandEmpty>
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-2">
                      {searchTerm ? "No models match your search" : "No models found"}
                    </p>
                    {onCreateNew && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setOpen(false);
                          onCreateNew();
                        }}
                        className="text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Create Model
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
              ) : (
                Object.entries(filteredModels).map(([layer, layerModels]) => (
                  <CommandGroup key={layer} heading={layer.charAt(0).toUpperCase() + layer.slice(1)} className="px-2">
                    {(layerModels as any[]).map((model: DataModel) => (
                      <CommandItem
                        key={model.id}
                        value={`${model.name}-${model.id}`}
                        onSelect={() => handleSelectModel(model)}
                        className="flex items-center justify-between py-3 cursor-pointer"
                        data-testid={`model-option-${model.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant="outline" className={cn("text-xs px-1.5 py-0.5", getLayerColor(layer))}>
                              {layer}
                            </Badge>
                            <span className="font-medium text-sm truncate">{model.name}</span>
                            {currentModel?.id === model.id && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatModelInfo(model)}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              )}
              {onCreateNew && Object.keys(filteredModels).length > 0 && (
                <>
                  <Separator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        onCreateNew();
                      }}
                      className="text-primary cursor-pointer"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Model
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  // Full version for larger displays
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Data Models</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="text-xs"
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
          </Button>
          {onCreateNew && (
            <Button variant="default" size="sm" onClick={onCreateNew} className="text-xs">
              <Plus className="h-3 w-3 mr-1" />
              New Model
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search models by name, description, or layer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="model-search"
        />
      </div>

      {/* Models List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-muted-foreground">Loading models...</span>
            </div>
          ) : Object.keys(filteredModels).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No models match your search criteria" : "No models found"}
              </p>
              {onCreateNew && (
                <Button variant="outline" onClick={onCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Model
                </Button>
              )}
            </div>
          ) : (
            Object.entries(filteredModels).map(([layer, layerModels]) => (
              <div key={layer} className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {layer} Layer ({(layerModels as any[]).length})
                </h4>
                <div className="space-y-2">
                  {(layerModels as any[]).map((model: DataModel) => (
                    <div
                      key={model.id}
                      className={cn(
                        "p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md",
                        currentModel?.id === model.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => handleSelectModel(model)}
                      data-testid={`model-card-${model.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline" className={cn("text-xs px-2 py-1", getLayerColor(layer))}>
                              {layer}
                            </Badge>
                            <h5 className="font-semibold text-foreground truncate">{model.name}</h5>
                            {currentModel?.id === model.id && (
                              <Badge variant="default" className="text-xs">Current</Badge>
                            )}
                          </div>
                          {(model as any).description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {(model as any).description}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            {(model as any).version && <span>Version {(model as any).version}</span>}
                            <span>Created {new Date(model.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {currentModel?.id === model.id && (
                          <Check className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}