import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Undo2, Redo2, History, Clock, Move, Link, Plus, Trash2 } from "lucide-react";
import { useModelerStore } from "@/store/modelerStore";

interface HistoryEntry {
  id: string;
  timestamp: Date;
  action: 'node_moved' | 'node_added' | 'node_deleted' | 'edge_added' | 'edge_deleted' | 'initial';
  description: string;
  nodeCount: number;
  edgeCount: number;
  preview?: string;
}

export default function UndoRedoTimeline() {
  const { 
    history, 
    historyIndex, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useModelerStore();
  
  const [showTimeline, setShowTimeline] = useState(false);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'node_moved': return <Move className="h-3 w-3" />;
      case 'node_added': return <Plus className="h-3 w-3" />;
      case 'node_deleted': return <Trash2 className="h-3 w-3" />;
      case 'edge_added': return <Link className="h-3 w-3" />;
      case 'edge_deleted': return <Trash2 className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'node_moved': return 'bg-blue-100 text-blue-800';
      case 'node_added': return 'bg-green-100 text-green-800';
      case 'node_deleted': return 'bg-red-100 text-red-800';
      case 'edge_added': return 'bg-purple-100 text-purple-800';
      case 'edge_deleted': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="relative">
      {/* Undo/Redo Controls */}
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTimeline(!showTimeline)}
          title="Show/Hide Timeline"
        >
          <History className="h-4 w-4" />
        </Button>
      </div>

      {/* Timeline Preview */}
      {showTimeline && (
        <Card className="absolute top-12 left-0 w-80 z-50 shadow-lg border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>Change Timeline</span>
              <Badge variant="secondary" className="text-xs">
                {history.length} changes
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              <div className="p-3 space-y-2">
                {history.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    No changes yet
                  </div>
                ) : (
                  history.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`p-2 rounded-md border transition-all cursor-pointer hover:bg-muted ${
                        index === historyIndex 
                          ? 'border-primary bg-primary/5' 
                          : index < historyIndex 
                            ? 'border-border bg-background opacity-60' 
                            : 'border-border bg-background opacity-40'
                      }`}
                      onClick={() => {
                        // Navigate to this history state
                        const diff = index - historyIndex;
                        if (diff > 0) {
                          for (let i = 0; i < diff; i++) redo();
                        } else if (diff < 0) {
                          for (let i = 0; i < Math.abs(diff); i++) undo();
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge className={`h-5 w-5 rounded-full p-0 flex items-center justify-center ${getActionColor(entry.action)}`}>
                            {getActionIcon(entry.action)}
                          </Badge>
                          <div>
                            <div className="text-xs font-medium">{entry.description}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatTime(entry.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.nodeCount}N {entry.edgeCount}E
                        </div>
                      </div>
                      {entry.preview && (
                        <div className="mt-1 text-xs text-muted-foreground bg-muted p-1 rounded">
                          {entry.preview}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}