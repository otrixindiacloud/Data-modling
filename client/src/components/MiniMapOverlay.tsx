import { useState } from "react";
import { Search, Filter, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useModelerStore } from "@/store/modelerStore";

export default function MiniMapOverlay() {
  const { nodes, edges } = useModelerStore();
  const [showStats, setShowStats] = useState(false);
  
  // Calculate model statistics
  const stats = {
    totalObjects: nodes.length,
    totalRelationships: edges.length,
    newObjects: nodes.filter(node => node.data?.isNew).length,
    systemBreakdown: nodes.reduce((acc: Record<string, number>, node) => {
      const system = node.data?.targetSystem || 'Unknown';
      acc[system] = (acc[system] || 0) + 1;
      return acc;
    }, {}),
  };

  return (
    <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg border border-border p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Model Overview</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowStats(!showStats)}
          title="Toggle detailed statistics"
          className="h-6 w-6 p-0"
        >
          <Info className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Objects:</span>
          <span className="font-medium">{stats.totalObjects}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">Relationships:</span>
          <span className="font-medium">{stats.totalRelationships}</span>
        </div>
        
        {stats.newObjects > 0 && (
          <div className="flex justify-between">
            <span className="text-green-600">New Objects:</span>
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              {stats.newObjects}
            </Badge>
          </div>
        )}
        
        {showStats && (
          <div className="border-t pt-2 mt-2">
            <div className="text-muted-foreground mb-2">System Distribution:</div>
            <div className="space-y-1">
              {Object.entries(stats.systemBreakdown).map(([system, count]) => (
                <div key={system} className="flex justify-between">
                  <span className="text-xs">{system}:</span>
                  <span className="text-xs font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {stats.totalObjects > 10 && (
          <div className="border-t pt-2 mt-2 text-amber-600">
            <div className="flex items-center space-x-1">
              <Filter className="h-3 w-3" />
              <span>Large model - use mini-map to navigate</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}