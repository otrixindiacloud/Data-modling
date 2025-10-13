import { Loader2, Layers3 } from "lucide-react";
import { useEffect, useState } from "react";

interface LayerSwitchingIndicatorProps {
  isVisible: boolean;
  targetLayer?: string;
}

export default function LayerSwitchingIndicator({ 
  isVisible, 
  targetLayer 
}: LayerSwitchingIndicatorProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
    } else {
      // Keep visible for a brief moment to show completion
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!show) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="bg-card border-2 border-primary/20 shadow-lg rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="relative">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <Layers3 className="h-3 w-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            Switching to {targetLayer || "layer"}...
          </span>
          <span className="text-xs text-muted-foreground">
            Loading canvas data
          </span>
        </div>
      </div>
    </div>
  );
}
