import React, { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Key, ExternalLink, Sparkles, Trash2, X, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModelerStore } from "@/store/modelerStore";
import { CanvasNode } from "@/types/modeler";
import { getSystemColor, getNewItemColor, getSystemHeaderColor, getSystemBorderColor, getDomainColor, getAreaColor } from "@/utils/colorUtils";
import { useIsMobile } from "@/hooks/use-mobile";

function DataObjectNode({ data, selected }: NodeProps<CanvasNode["data"]>) {
  const { currentLayer, selectNode, selectAttribute, selectedAttributeId } = useModelerStore();
  const isMobile = useIsMobile();
  
  // DEBUG: Log what data the node receives
  React.useEffect(() => {
    console.log('🎨 DataObjectNode rendered with data:', {
      name: data?.name,
      objectId: data?.objectId,
      modelObjectId: data?.modelObjectId,
      domain: data?.domain,
      dataArea: data?.dataArea,
      hasAttributes: !!data?.attributes,
      attributeCount: data?.attributes?.length || 0
    });
  }, [data]);
  
  // Enhanced touch handling for mobile devices
  const [touchStart, setTouchStart] = React.useState<{ x: number; y: number; time: number } | null>(null);
  const [isLongPress, setIsLongPress] = React.useState(false);
  const touchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Double-click selects the node and triggers opening properties panel on any device
    const nodeId = (data.modelObjectId || data.objectId)?.toString();
    if (nodeId) {
      selectNode(nodeId);
      // Dispatch a custom event to open the properties panel
      window.dispatchEvent(new CustomEvent('openMobileProperties', { detail: { nodeId: nodeId } }));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const currentTime = Date.now();
    
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: currentTime
    });
    
    setIsLongPress(false);
    
    // Start long press timer for mobile context menu
    touchTimeoutRef.current = setTimeout(() => {
      setIsLongPress(true);
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Trigger properties panel on long press
      const nodeId = (data.modelObjectId || data.objectId)?.toString();
      if (nodeId) {
        selectNode(nodeId);
        window.dispatchEvent(new CustomEvent('openMobileProperties', { detail: { nodeId: nodeId } }));
      }
    }, 500); // 500ms for long press
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // If user moves finger more than 10px, cancel long press
    if (deltaX > 10 || deltaY > 10) {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
        touchTimeoutRef.current = null;
      }
      setIsLongPress(false);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
    
    if (!touchStart) return;
    
    const currentTime = Date.now();
    const timeDiff = currentTime - touchStart.time;
    
    // Handle double tap (under 300ms and not a long press)
    if (timeDiff < 300 && !isLongPress) {
      // Check for rapid successive taps (double tap)
      const nodeId = (data.modelObjectId || data.objectId)?.toString();
      if (nodeId) {
        selectNode(nodeId);
        window.dispatchEvent(new CustomEvent('openMobileProperties', { detail: { nodeId: nodeId } }));
      }
    }
    
    setTouchStart(null);
    setIsLongPress(false);
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    };
  }, []);

  const getTypeDisplayName = (attribute: any) => {
    switch (currentLayer) {
      case "physical":
        return attribute.physicalType || attribute.logicalType || attribute.conceptualType || "Unknown";
      case "logical":
        // Logical layer shows no data types - only attribute names and keys
        return null;
      case "conceptual":
      default:
        return attribute.conceptualType || "Unknown";
    }
  };

  // Get domain color using the utility function
  const domainColorClass = getDomainColor(data.domain);

  // Determine color scheme based on source/target system and new status
  const isNewObject = data.isNew;
  const sourceSystem = data.sourceSystem;
  const targetSystem = data.targetSystem;
  
  // Use target system for primary coloring, source system for secondary indicators
  const primarySystem = targetSystem || sourceSystem;
  
  const nodeColorClass = isNewObject 
    ? getNewItemColor()
    : getSystemColor(primarySystem);
    
  const headerColorClass = isNewObject
    ? 'bg-green-500'
    : getSystemHeaderColor(primarySystem);
    
  const borderColorClass = isNewObject
    ? 'border-green-400'
    : selected 
      ? 'border-primary' 
      : getSystemBorderColor(primarySystem);

  return (
    <div
      className={`rounded-lg shadow-lg border-2 w-64 ${nodeColorClass} ${borderColorClass} touch-manipulation select-none`}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        touchAction: 'pan-x pan-y',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    >
      {/* Connection Handles - Clean object-level handles for all layers */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-primary border-2 border-white shadow-lg hover:scale-125 transition-transform"
        id="object-top"
        style={{ top: -6 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-primary border-2 border-white shadow-lg hover:scale-125 transition-transform"
        id="object-bottom"
        style={{ bottom: -6 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-primary border-2 border-white shadow-lg hover:scale-125 transition-transform"
        id="object-left"
        style={{ left: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-primary border-2 border-white shadow-lg hover:scale-125 transition-transform"
        id="object-right"
        style={{ right: -6 }}
      />

      {/* Node Header */}
      <div className={`${headerColorClass} text-white px-4 py-3 rounded-t-lg relative group`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium">{data.name}</h3>
            {isNewObject && <Sparkles className="w-3 h-3 text-white" />}
          </div>
          <div className="flex items-center space-x-2">
            {primarySystem && (
              <Badge variant="secondary" className="text-xs bg-white/30 text-white border-white/40">
                {primarySystem}
              </Badge>
            )}
            {/* Double-click indicator - show on all devices */}
            <div className="bg-white/20 rounded-full p-1 opacity-60" title="Double-click to open properties">
              <ExternalLink className="h-3 w-3 text-white" />
            </div>
            {/* Delete button - only show when node is selected */}
            {selected && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white hover:bg-red-500 hover:text-white opacity-75 hover:opacity-100 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  // Dispatch a custom event that the canvas can listen to
                  const deleteEvent = new CustomEvent('delete-node', { 
                    detail: { objectId: data.objectId } 
                  });
                  window.dispatchEvent(deleteEvent);
                }}
                title="Delete object"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {(data.domain || data.dataArea) && (
          <div className="flex items-center space-x-2 mt-1 text-xs opacity-90">
            {data.domain && <span>{data.domain}</span>}
            {data.domain && data.dataArea && <span>•</span>}
            {data.dataArea && <span>{data.dataArea}</span>}
          </div>
        )}
      </div>

      {/* Attributes List - Only show in logical and physical layers */}
      {currentLayer !== "conceptual" && (
        <div className="p-0">
          {data.attributes.map((attr, index) => (
            <div
              key={attr.id}
              onClick={(e) => {
                e.stopPropagation();
                selectAttribute(attr.id);
              }}
              className={`relative border-b border-border px-4 py-2 hover:bg-muted text-sm cursor-pointer transition-colors ${
                selectedAttributeId === attr.id ? "bg-blue-50 border-blue-200" : ""
              } ${
                index === data.attributes.length - 1 ? "border-b-0 rounded-b-lg" : ""
              }`}
            >
              {/* Individual attribute connection handles for logical/physical layers */}
              <Handle
                type="source"
                position={Position.Right}
                id={`attr-${attr.id}-source`}
                className="w-2 h-2 bg-blue-500 border border-white shadow hover:scale-125 transition-transform"
                style={{ 
                  right: -6, 
                  top: "50%", 
                  transform: "translateY(-50%)"
                }}
              />
              <Handle
                type="target"
                position={Position.Left}
                id={`attr-${attr.id}-target`}
                className="w-2 h-2 bg-green-500 border border-white shadow hover:scale-125 transition-transform"
                style={{ 
                  left: -6, 
                  top: "50%", 
                  transform: "translateY(-50%)"
                }}
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {attr.isPrimaryKey && (
                    <Key className="h-3 w-3 text-yellow-500 mr-2" />
                  )}
                  {attr.isForeignKey && (
                    <ExternalLink className="h-3 w-3 text-blue-500 mr-2" />
                  )}
                  {attr.isNew && (
                    <Sparkles className="h-3 w-3 text-green-500 mr-2" />
                  )}
                  <span className={`${attr.isPrimaryKey ? "font-medium" : ""} ${attr.isNew ? "text-green-700 font-medium" : ""}`}>
                    {attr.name}
                  </span>
                </div>
                {getTypeDisplayName(attr) && (
                  <span className="text-muted-foreground text-xs">
                    {getTypeDisplayName(attr)}
                  </span>
                )}
              </div>
            </div>
          ))}
          
          {data.attributes.length === 0 && (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">
              No attributes defined
            </div>
          )}
        </div>
      )}

      {/* Conceptual layer - simplified view */}
      {currentLayer === "conceptual" && (
        <div className="px-4 py-3 text-center text-sm text-muted-foreground">
          {data.attributes.length} attribute{data.attributes.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export default memo(DataObjectNode);