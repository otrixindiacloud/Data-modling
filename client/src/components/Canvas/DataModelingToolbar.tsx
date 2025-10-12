import React, { useState } from 'react';
import { 
  MousePointer, 
  Move, 
  Link, 
  GitBranch, 
  Save, 
  Layout, 
  Zap, 
  Grid, 
  Circle, 
  MoreHorizontal,
  Magnet,
  AlignCenter,
  Maximize,
  RotateCcw,
  Lightbulb,
  Search,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useSmartLayout } from './SmartLayoutManager';
import { useReactFlow } from 'reactflow';

interface DataModelingToolbarProps {
  connectionMode: 'selection' | 'connection';
  setConnectionMode: (mode: 'selection' | 'connection') => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onSave: () => void;
  currentLayer: string;
  onAddObject: () => void;
  showAISuggestions: boolean;
  onToggleAISuggestions: () => void;
  onToggleSearch?: () => void;
  showAutoLayout?: boolean;
  onToggleAutoLayout?: () => void;
}

export default function DataModelingToolbar({
  connectionMode,
  setConnectionMode,
  saveStatus,
  onSave,
  currentLayer,
  onAddObject,
  showAISuggestions,
  onToggleAISuggestions,
  onToggleSearch,
  showAutoLayout,
  onToggleAutoLayout
}: DataModelingToolbarProps) {
  const { getNodes, getEdges, fitView } = useReactFlow();
  const { 
    applyHierarchicalLayout, 
    applyForceDirectedLayout, 
    applyCircularLayout, 
    applyGridLayout 
  } = useSmartLayout();
  
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);

  const handleLayoutChange = (layoutType: string) => {
    const nodes = getNodes();
    const edges = getEdges();
    
    switch (layoutType) {
      case 'hierarchical':
        applyHierarchicalLayout(nodes, edges);
        break;
      case 'force':
        applyForceDirectedLayout(nodes, edges);
        break;
      case 'circular':
        applyCircularLayout(nodes);
        break;
      case 'grid':
        applyGridLayout(nodes);
        break;
      case 'fit':
        fitView({ duration: 800, padding: 0.2 });
        break;
    }
    setIsLayoutMenuOpen(false);
  };

  const getSaveStatusColor = () => {
    switch (saveStatus) {
      case 'saving': return 'text-yellow-600';
      case 'saved': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving': return 'Saving...';
      case 'saved': return 'Saved';
      case 'error': return 'Error';
      default: return 'Save';
    }
  };

  const [isToolboxOpen, setIsToolboxOpen] = useState(false);

  return (
    <>
      {/* Compact Toolbar Button with Save Status Indicator */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <DropdownMenu open={isToolboxOpen} onOpenChange={setIsToolboxOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-12 w-12 p-0 touch-target touch-button bg-card/95 backdrop-blur-md shadow-strong border-2 hover:shadow-medium transition-all duration-200 hover:scale-105"
              title="Open Toolbar"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            side="bottom"
            className="w-80 max-h-[80vh] overflow-y-auto bg-card/95 backdrop-blur-md border-border shadow-strong animate-slide-up p-2"
          >
            {/* Current Layer Indicator */}
            <div className="mb-3 p-2">
              <Badge variant="outline" className="capitalize font-medium bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20 text-primary">
                <Layers className="w-3 h-3 mr-1" />
                {currentLayer} Layer
              </Badge>
            </div>

            <DropdownMenuSeparator />

            {/* Tool Selection */}
            <div className="mb-3 p-2">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground mb-2">TOOLS</DropdownMenuLabel>
              <div className="flex gap-2">
                <Button
                  variant={connectionMode === 'selection' ? "default" : "outline"}
                  size="sm"
                  className="flex-1 touch-target touch-button"
                  onClick={() => {
                    setConnectionMode('selection');
                    setIsToolboxOpen(false);
                  }}
                >
                  <MousePointer className="h-4 w-4 mr-2" />
                  Select
                </Button>
                <Button
                  variant={connectionMode === 'connection' ? "default" : "outline"}
                  size="sm"
                  className="flex-1 touch-target touch-button"
                  onClick={() => {
                    setConnectionMode('connection');
                    setIsToolboxOpen(false);
                  }}
                >
                  <Link className="h-4 w-4 mr-2" />
                  Connect
                </Button>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Quick Actions */}
            <div className="mb-3 p-2">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground mb-2">ACTIONS</DropdownMenuLabel>
              <div className="space-y-2">

                {onToggleSearch && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onToggleSearch();
                      setIsToolboxOpen(false);
                    }}
                    className="w-full justify-start touch-target touch-button"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search & Filter
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onSave();
                    setIsToolboxOpen(false);
                  }}
                  disabled={saveStatus === 'saving'}
                  className={`w-full justify-start touch-target ${
                    saveStatus === 'saved' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950' 
                    : saveStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950'
                    : ''
                  }`}
                >
                  <Save className={`h-4 w-4 mr-2 ${saveStatus === 'saving' ? 'animate-spin' : ''}`} />
                  {getSaveStatusText()}
                </Button>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Layout Controls */}
            <div className="mb-3 p-2">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground mb-2">LAYOUTS</DropdownMenuLabel>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleLayoutChange('hierarchical');
                    setIsToolboxOpen(false);
                  }}
                  className="touch-target text-xs"
                >
                  <GitBranch className="h-3 w-3 mr-1" />
                  Hierarchy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleLayoutChange('grid');
                    setIsToolboxOpen(false);
                  }}
                  className="touch-target text-xs"
                >
                  <Grid className="h-3 w-3 mr-1" />
                  Grid
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleLayoutChange('force');
                    setIsToolboxOpen(false);
                  }}
                  className="touch-target text-xs"
                >
                  <Magnet className="h-3 w-3 mr-1" />
                  Force
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleLayoutChange('fit');
                    setIsToolboxOpen(false);
                  }}
                  className="touch-target text-xs"
                >
                  <Maximize className="h-3 w-3 mr-1" />
                  Fit View
                </Button>
              </div>
              
              {onToggleAutoLayout && (
                <Button
                  variant={showAutoLayout ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    onToggleAutoLayout();
                    setIsToolboxOpen(false);
                  }}
                  className="w-full justify-start touch-target"
                >
                  <AlignCenter className="h-4 w-4 mr-2" />
                  {showAutoLayout ? 'Hide' : 'Show'} Auto Layout Panel
                </Button>
              )}
            </div>

            <DropdownMenuSeparator />

            {/* AI Features */}
            <div className="p-2">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground mb-2">AI FEATURES</DropdownMenuLabel>
              <Button
                variant={showAISuggestions ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  onToggleAISuggestions();
                  setIsToolboxOpen(false);
                }}
                className={`w-full justify-start touch-target ${
                  showAISuggestions 
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-yellow-400' 
                    : 'hover:bg-yellow-50 hover:border-yellow-200 hover:text-yellow-700 dark:hover:bg-yellow-950'
                }`}
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                {showAISuggestions ? 'Hide' : 'Show'} AI Suggestions
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Auto-Save Status - Always visible */}
        <div className={`
          px-3 py-1.5 rounded-md shadow-sm backdrop-blur-md border text-xs font-medium 
          flex items-center gap-1.5 transition-all duration-200
          ${saveStatus === 'saving' || saveStatus === 'saved'
            ? 'bg-green-50/90 border-green-300 text-green-700 dark:bg-green-950/90'
            : 'bg-gray-50/90 border-gray-300 text-gray-600 dark:bg-gray-900/90 dark:text-gray-400'
          }
        `}>
          <div className={`w-2 h-2 rounded-full ${
            saveStatus === 'saving' ? 'bg-yellow-500 animate-pulse' 
            : saveStatus === 'saved' ? 'bg-green-500 animate-pulse'
            : 'bg-gray-400'
          }`}></div>
          <span>Auto-save: {saveStatus === 'saving' ? 'SAVING' : saveStatus === 'saved' ? 'SAVED' : 'Ready'}</span>
        </div>
        
        {/* Save Status Indicator - Visible outside dropdown */}
        {saveStatus !== 'idle' && (
          <div className={`
            px-3 py-2 rounded-md shadow-md backdrop-blur-md border-2 text-sm font-medium
            transition-all duration-200 flex items-center gap-2
            ${saveStatus === 'saving' ? 'bg-yellow-50/95 border-yellow-300 text-yellow-700 dark:bg-yellow-950/95' 
              : saveStatus === 'saved' ? 'bg-green-50/95 border-green-300 text-green-700 dark:bg-green-950/95 animate-pulse'
              : saveStatus === 'error' ? 'bg-red-50/95 border-red-300 text-red-700 dark:bg-red-950/95'
              : ''
            }
          `}>
            <Save className={`h-4 w-4 ${saveStatus === 'saving' ? 'animate-spin' : ''}`} />
            <span>{getSaveStatusText()}</span>
          </div>
        )}
      </div>
    </>
  );
}