import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

export default function LoadingOverlay({ 
  message = "Loading...", 
  size = "md",
  fullScreen = false 
}: LoadingOverlayProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  };

  const containerClasses = fullScreen 
    ? "fixed inset-0 z-50" 
    : "absolute inset-0 z-40";

  return (
    <div className={`${containerClasses} bg-background/80 backdrop-blur-sm flex items-center justify-center`}>
      <div className="flex flex-col items-center gap-4 bg-card p-6 rounded-lg shadow-lg border">
        <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
}
