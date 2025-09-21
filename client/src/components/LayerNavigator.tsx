import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useModelerStore } from "@/store/modelerStore";
import { DataModel } from "@shared/schema";
import { ChevronRight, Database, Layers3, Server } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const LAYER_ICONS = {
  conceptual: Database,
  logical: Layers3,
  physical: Server,
};

const LAYER_DESCRIPTIONS = {
  conceptual: "High-level business entities and relationships",
  logical: "Detailed attributes, keys, and data types",
  physical: "Implementation-specific constraints and storage",
};

export default function LayerNavigator() {
  const { currentModel, currentLayer, setCurrentLayer, setCurrentModel } = useModelerStore();

  const { data: allModels } = useQuery({
    queryKey: ["/api/models"],
  });

  if (!currentModel) {
    return null;
  }

  // Find all models in the current family (conceptual + logical + physical)
  const modelFamily = (allModels as DataModel[] || []).filter((model: DataModel) => 
    model.parentModelId === currentModel.id || model.id === currentModel.id
  );

  // Organize models by layer
  const layerModels = {
    conceptual: modelFamily.find(m => m.layer === "conceptual") || currentModel,
    logical: modelFamily.find(m => m.layer === "logical"),
    physical: modelFamily.find(m => m.layer === "physical"),
  };

  const layers = ["conceptual", "logical", "physical"] as const;

  return (
    <TooltipProvider>
      <div className="flex items-center space-x-1 p-1 bg-muted/30 rounded-lg border">
        {layers.map((layer, index) => {
          const Icon = LAYER_ICONS[layer];
          const model = layerModels[layer];
          const isActive = currentLayer === layer;
          const isAvailable = !!model;

          return (
            <div key={layer} className="flex items-center">
              {index > 0 && (
                <div className="w-px h-6 bg-border mx-1" />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setCurrentLayer(layer);
                      // Update current model to the layer-specific model
                      if (model) {
                        setCurrentModel(model);
                      }
                    }}
                    disabled={!isAvailable}
                    className="h-9 w-9 p-0 relative"
                  >
                    <Icon className="h-4 w-4" />
                    {!isAvailable && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full flex items-center justify-center">
                        <span className="text-[8px] text-destructive-foreground font-bold">!</span>
                      </div>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="text-center">
                    <p className="font-medium capitalize">{layer} Layer</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {LAYER_DESCRIPTIONS[layer]}
                    </p>
                    {!isAvailable && (
                      <p className="text-xs text-destructive mt-1">Not Available</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}