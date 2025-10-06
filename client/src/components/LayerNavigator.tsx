import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useModelerStore } from "@/store/modelerStore";
import { DataModel } from "@shared/schema";
import { Database, Layers3, Server } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ModelLayer } from "@/types/modeler";

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

const buildModelMap = (models: DataModel[]): Map<number, DataModel> => {
  return models.reduce((map, model) => {
    map.set(model.id, model);
    return map;
  }, new Map<number, DataModel>());
};

const getModelFamily = (root: DataModel | null, models: DataModel[]): DataModel[] => {
  if (!root) return [];

  const family: DataModel[] = [];
  const visited = new Set<number>();
  const queue: DataModel[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;

    visited.add(current.id);
    family.push(current);

    const children = models.filter((model) => model.parentModelId === current.id);
    queue.push(...children);
  }

  return family;
};

const resolveLayerModel = (
  layer: ModelLayer,
  currentModel: DataModel | null,
  family: DataModel[],
  modelMap: Map<number, DataModel>
): DataModel | null => {
  const candidates = family.filter((model) => model.layer === layer);
  if (candidates.length === 0) {
    return null;
  }

  if (currentModel) {
    const currentLineage = new Set<number>();
    let pointer: DataModel | null | undefined = currentModel;

    while (pointer) {
      if (currentLineage.has(pointer.id)) {
        break;
      }

      currentLineage.add(pointer.id);
      if (!pointer.parentModelId) {
        break;
      }
      pointer = modelMap.get(pointer.parentModelId) ?? null;
    }

    const branchMatch = candidates.find((candidate) => {
      let walker: DataModel | null | undefined = candidate;
      while (walker) {
        if (currentLineage.has(walker.id)) {
          return true;
        }
        if (!walker.parentModelId) {
          break;
        }
        walker = modelMap.get(walker.parentModelId) ?? null;
      }
      return false;
    });

    if (branchMatch) {
      return branchMatch;
    }
  }

  return candidates[0];
};

export default function LayerNavigator() {
  const { currentModel, currentLayer, setCurrentLayer, allModels } = useModelerStore();

  const models = Array.isArray(allModels) ? allModels : [];

  const findRootModel = (model: DataModel | null): DataModel | null => {
    if (!model) return null;

    let current: DataModel | null = model;
    const visited = new Set<number>();

    while (current?.parentModelId) {
      if (visited.has(current.parentModelId)) {
        break;
      }

      visited.add(current.parentModelId);
      const parent = models.find((m) => m.id === current?.parentModelId) ?? null;
      if (!parent) {
        break;
      }
      current = parent;
    }

    return current ?? model;
  };

  const rootModel = findRootModel(currentModel) ?? currentModel;

  const modelMap = useMemo(() => buildModelMap(models), [models]);
  const modelFamily = useMemo(() => {
    const baseModel = rootModel ?? currentModel;
    if (!baseModel) {
      return [] as DataModel[];
    }
    return getModelFamily(baseModel, models);
  }, [rootModel, currentModel, models]);

  const layerModels = useMemo(() => {
    const conceptual = resolveLayerModel("conceptual", currentModel, modelFamily, modelMap) ?? rootModel ?? currentModel;
    const logical = resolveLayerModel("logical", currentModel, modelFamily, modelMap);
    const physical = resolveLayerModel("physical", currentModel, modelFamily, modelMap);

    return {
      conceptual,
      logical,
      physical,
    };
  }, [currentModel, modelFamily, modelMap, rootModel]);

  const layers = ["conceptual", "logical", "physical"] as const;

  if (!currentModel) {
    return null;
  }

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
                      if (!isAvailable || isActive) {
                        return;
                      }

                      if (typeof window !== "undefined") {
                        try {
                          window.sessionStorage.setItem("modeler:pendingLayer", layer);
                          if (model?.id) {
                            window.sessionStorage.setItem("modeler:pendingModelId", model.id.toString());
                          } else {
                            window.sessionStorage.removeItem("modeler:pendingModelId");
                          }
                        } catch (error) {
                          console.warn("Failed to persist pending layer before reload", error);
                        }
                      }

                      setCurrentLayer(layer);

                      if (typeof window !== "undefined") {
                        setTimeout(() => {
                          window.location.reload();
                        }, 50);
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