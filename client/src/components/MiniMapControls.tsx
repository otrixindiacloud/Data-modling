import { useState } from "react";
import { Map, MapPin, Eye, EyeOff, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModelerStore } from "@/store/modelerStore";

interface MiniMapControlsProps {
  onToggleMiniMap: () => void;
  showMiniMap: boolean;
  onToggleExpanded: () => void;
  isExpanded: boolean;
}

export default function MiniMapControls({
  onToggleMiniMap,
  showMiniMap,
  onToggleExpanded,
  isExpanded,
}: MiniMapControlsProps) {
  const { nodes } = useModelerStore();
  
  const nodeCount = nodes.length;
  const shouldShowMiniMap = nodeCount > 5; // Auto-show for larger models

  return (
    <div className="absolute bottom-4 right-4 z-10 bg-white rounded-lg shadow-lg border border-border p-2 flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Map className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {nodeCount} objects
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpanded}
            title={isExpanded ? "Minimize map" : "Maximize map"}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMiniMap}
            title={showMiniMap ? "Hide mini-map" : "Show mini-map"}
            className="h-6 w-6 p-0"
          >
            {showMiniMap ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
      
      {shouldShowMiniMap && !showMiniMap && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
          <MapPin className="h-3 w-3 inline mr-1" />
          Large model detected. Consider using mini-map for navigation.
        </div>
      )}
      
      {showMiniMap && (
        <div className="text-xs text-muted-foreground">
          Click and drag in mini-map to navigate large models
        </div>
      )}
    </div>
  );
}