import { useState, useCallback } from "react";
import { useReactFlow } from "reactflow";
import { 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  MapPin,
  Eye,
  EyeOff,
  Move,
  MousePointer2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ImprovedMiniMapControlsProps {
  showMiniMap: boolean;
  setShowMiniMap: (show: boolean) => void;
  isMapExpanded: boolean;
  setIsMapExpanded: (expanded: boolean) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  showLegend?: boolean;
  onToggleLegend?: () => void;
  className?: string;
}

export default function ImprovedMiniMapControls({
  showMiniMap,
  setShowMiniMap,
  isMapExpanded,
  setIsMapExpanded,
  zoomLevel,
  onZoomChange,
  showLegend,
  onToggleLegend,
  className
}: ImprovedMiniMapControlsProps) {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const [isPanning, setIsPanning] = useState(false);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 300 });
    onZoomChange(Math.min(zoomLevel * 1.2, 4));
  }, [zoomIn, zoomLevel, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 300 });
    onZoomChange(Math.max(zoomLevel * 0.8, 0.1));
  }, [zoomOut, zoomLevel, onZoomChange]);

  const handleFitView = useCallback(() => {
    fitView({ 
      duration: 800,
      padding: 0.1,
      includeHiddenNodes: false
    });
  }, [fitView]);

  const handleResetZoom = useCallback(() => {
    zoomTo(1, { duration: 500 });
    onZoomChange(1);
  }, [zoomTo, onZoomChange]);

  const formatZoomPercentage = (zoom: number) => {
    return `${Math.round(zoom * 100)}%`;
  };

  return (
    <div className={cn(
      "absolute bottom-4 right-4 z-50",
      "bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg",
      "p-2 space-y-2",
      className
    )}>
      {/* Zoom Controls */}
      <div className="flex flex-col space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Zoom</span>
          <Badge variant="secondary" className="text-xs px-2 py-0.5">
            {formatZoomPercentage(zoomLevel)}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.1}
                className="h-8 w-8 p-0"
                data-testid="button-zoom-out"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetZoom}
                className="h-8 px-2 text-xs"
                data-testid="button-reset-zoom"
              >
                Reset
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset Zoom (100%)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 4}
                className="h-8 w-8 p-0"
                data-testid="button-zoom-in"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Separator />

      {/* View Controls */}
      <div className="flex flex-col space-y-1">
        <span className="text-xs font-medium text-muted-foreground">View</span>
        
        <div className="flex items-center space-x-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFitView}
                className="h-8 w-8 p-0"
                data-testid="button-fit-view"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to View</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isPanning ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPanning(!isPanning)}
                className="h-8 w-8 p-0"
                data-testid="button-pan-mode"
              >
                {isPanning ? <Move className="h-3 w-3" /> : <MousePointer2 className="h-3 w-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isPanning ? "Exit Pan Mode" : "Pan Mode"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Separator />

      {/* MiniMap Controls */}
      <div className="flex flex-col space-y-1">
        <span className="text-xs font-medium text-muted-foreground">MiniMap</span>
        
        <div className="flex items-center space-x-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showMiniMap ? "default" : "outline"}
                size="sm"
                onClick={() => setShowMiniMap(!showMiniMap)}
                className="h-8 w-8 p-0"
                data-testid="button-toggle-minimap"
              >
                {showMiniMap ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{showMiniMap ? "Hide MiniMap" : "Show MiniMap"}</TooltipContent>
          </Tooltip>

          {showMiniMap && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isMapExpanded ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsMapExpanded(!isMapExpanded)}
                  className="h-8 w-8 p-0"
                  data-testid="button-expand-minimap"
                >
                  {isMapExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isMapExpanded ? "Collapse MiniMap" : "Expand MiniMap"}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Legend Toggle */}
      {onToggleLegend && (
        <>
          <Separator />
          <div className="flex flex-col space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Legend</span>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showLegend ? "default" : "outline"}
                  size="sm"
                  onClick={onToggleLegend}
                  className="h-8 w-8 p-0"
                  data-testid="button-toggle-legend"
                >
                  <MapPin className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showLegend ? "Hide Legend" : "Show Legend"}</TooltipContent>
            </Tooltip>
          </div>
        </>
      )}

      {/* Interaction Hints */}
      <div className="pt-2 border-t border-border">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <span>Mouse wheel</span>
            <span>Zoom</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Space + drag</span>
            <span>Pan</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Double click</span>
            <span>Select</span>
          </div>
        </div>
      </div>
    </div>
  );
}