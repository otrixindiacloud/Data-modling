import { ZoomIn, ZoomOut, Maximize, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModelerStore } from "@/store/modelerStore";

interface CanvasControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  zoomLevel: number;
}

export default function CanvasControls({
  onZoomIn,
  onZoomOut,
  onFitView,
  zoomLevel
}: CanvasControlsProps) {
  const { undo, redo, canUndo, canRedo } = useModelerStore();

  return (
    <div className="absolute bottom-4 left-4 flex flex-col gap-2 bg-card/95 dark:bg-card/95 backdrop-blur-md rounded-xl border border-border p-3 shadow-strong animate-fade-in">
      {/* Zoom Controls */}
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          className="h-9 w-9 p-0 touch-target hover:bg-primary/10 hover:text-primary hover:scale-105 transition-all duration-200"
          title="Zoom In (+)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        
        <div className="text-xs text-center text-foreground font-medium px-2 py-1 bg-muted/50 rounded-md">
          {Math.round(zoomLevel * 100)}%
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomOut}
          className="h-9 w-9 p-0 touch-target hover:bg-primary/10 hover:text-primary hover:scale-105 transition-all duration-200"
          title="Zoom Out (-)"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onFitView}
          className="h-9 w-9 p-0 touch-target hover:bg-accent hover:text-accent-foreground hover:scale-105 transition-all duration-200"
          title="Fit to View (F)"
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      {/* Divider */}
      <div className="h-px bg-border mx-1" />

      {/* Undo/Redo Controls */}
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={!canUndo()}
          className={`h-9 w-9 p-0 touch-target transition-all duration-200 ${
            canUndo() 
              ? 'hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-300 hover:scale-105' 
              : 'opacity-50 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={!canRedo()}
          className={`h-9 w-9 p-0 touch-target transition-all duration-200 ${
            canRedo() 
              ? 'hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950 dark:hover:text-green-300 hover:scale-105' 
              : 'opacity-50 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}