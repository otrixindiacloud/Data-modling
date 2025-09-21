import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface MiniMapLegendProps {
  visible: boolean;
}

export default function MiniMapLegend({ visible }: MiniMapLegendProps) {
  if (!visible) return null;

  const systemColors = [
    { name: "Data Lake", color: "bg-blue-500", textColor: "text-blue-700" },
    { name: "Data Warehouse", color: "bg-purple-500", textColor: "text-purple-700" },
    { name: "Operational DB", color: "bg-green-500", textColor: "text-green-700" },
    { name: "Analytics Platform", color: "bg-orange-500", textColor: "text-orange-700" },
    { name: "Cloud Storage", color: "bg-cyan-500", textColor: "text-cyan-700" },
    { name: "Real-time Stream", color: "bg-red-500", textColor: "text-red-700" },
  ];

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg border border-border p-3 max-w-xs">
      <h4 className="text-sm font-medium mb-2">Mini-Map Legend</h4>
      
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {systemColors.map((system) => (
            <div key={system.name} className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded ${system.color}`}></div>
              <span className={system.textColor}>{system.name}</span>
            </div>
          ))}
        </div>
        
        <div className="border-t pt-2">
          <div className="flex items-center space-x-2 text-xs">
            <div className="w-3 h-3 rounded bg-green-500 relative">
              <Sparkles className="w-2 h-2 text-white absolute -top-0.5 -right-0.5" />
            </div>
            <span className="text-green-700">New Objects/Attributes</span>
          </div>
        </div>
      </div>
    </div>
  );
}