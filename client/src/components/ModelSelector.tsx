import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModelerStore } from "@/store/modelerStore";
import { DataModel } from "@shared/schema";

export default function ModelSelector() {
  const { currentModel, setCurrentModel, currentLayer, setCurrentLayer } = useModelerStore();

  const { data: allModels, isLoading } = useQuery({
    queryKey: ["/api/models"],
  });

  // Filter to show only conceptual models (parent models) in the dropdown
  const conceptualModels = (allModels as DataModel[] || []).filter((model: DataModel) => 
    model.layer === "conceptual" && (model.parentModelId === null || model.parentModelId === undefined)
  );

  // Get all models for the current model family (conceptual + its logical/physical layers)
  const modelFamily = (allModels as DataModel[] || []).filter((model: DataModel) => 
    model.parentModelId === currentModel?.id || model.id === currentModel?.id
  );

  const handleModelChange = (modelId: string) => {
    const model = conceptualModels?.find((m: DataModel) => m.id === parseInt(modelId));
    if (model) {
      setCurrentModel(model);
      setCurrentLayer("conceptual"); // Always start with conceptual when switching models
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading models...
      </div>
    );
  }

  if (!conceptualModels || conceptualModels.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No models available
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium">Model:</span>
      <Select
        value={currentModel?.id.toString() || ""}
        onValueChange={handleModelChange}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select a data model" />
        </SelectTrigger>
        <SelectContent>
          {conceptualModels.map((model: DataModel) => (
            <SelectItem key={model.id} value={model.id.toString()}>
              <div className="flex flex-col">
                <span className="font-medium">{model.name}</span>
                <span className="text-xs text-muted-foreground">
                  3-Layer Model • {(model as any).targetSystem || "No target"}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}