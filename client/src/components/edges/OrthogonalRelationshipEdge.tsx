import React, { memo, useState, useCallback, useRef } from 'react';
import {
  EdgeProps,
  EdgeLabelRenderer,
  BaseEdge,
  Position,
  useReactFlow,
  useStore,
} from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link2, Database, Zap, Plus, GripVertical, X } from 'lucide-react';

interface RelationshipEdgeData {
  relationshipType?: '1:1' | '1:N' | 'N:M';
  relationshipId?: number;
  sourceAttributeId?: number;
  targetAttributeId?: number;
  isAttributeRelationship?: boolean;
  label?: string;
  waypoints?: Array<{ x: number; y: number }>; // User-defined turning points
}

interface RelationshipEdgeProps extends EdgeProps {
  data?: RelationshipEdgeData;
}

// Crow's foot notation marker paths
const createOneMarker = (color: string): string => {
  return `
    <marker
      id="one-${color.replace('#', '')}"
      viewBox="0 0 20 20"
      refX="10"
      refY="10"
      markerWidth="8"
      markerHeight="8"
      orient="auto-start-reverse"
    >
      <line x1="10" y1="5" x2="10" y2="15" stroke="${color}" stroke-width="2"/>
    </marker>
  `;
};

const createManyMarker = (color: string): string => {
  return `
    <marker
      id="many-${color.replace('#', '')}"
      viewBox="0 0 20 20"
      refX="10"
      refY="10"
      markerWidth="10"
      markerHeight="10"
      orient="auto-start-reverse"
    >
      <line x1="10" y1="10" x2="5" y2="5" stroke="${color}" stroke-width="2"/>
      <line x1="10" y1="10" x2="5" y2="15" stroke="${color}" stroke-width="2"/>
      <line x1="10" y1="10" x2="15" y2="10" stroke="${color}" stroke-width="2"/>
    </marker>
  `;
};

const createOneOneMarker = (color: string, isEnd: boolean): string => {
  const id = isEnd ? `one-one-end-${color.replace('#', '')}` : `one-one-start-${color.replace('#', '')}`;
  return `
    <marker
      id="${id}"
      viewBox="0 0 20 20"
      refX="${isEnd ? 18 : 2}"
      refY="10"
      markerWidth="8"
      markerHeight="8"
      orient="${isEnd ? 'auto' : 'auto-start-reverse'}"
    >
      <line x1="10" y1="5" x2="10" y2="15" stroke="${color}" stroke-width="2"/>
      <line x1="14" y1="5" x2="14" y2="15" stroke="${color}" stroke-width="2"/>
    </marker>
  `;
};

// Generate orthogonal (90-degree) path with waypoints (always create 2 default waypoints if none exist)
const getOrthogonalPath = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  waypoints?: Array<{ x: number; y: number }>,
): [string, number, number, Array<{ x: number; y: number }>] => {
  const offset = 20;
  const points: Array<{ x: number; y: number }> = [{ x: sourceX, y: sourceY }];
  
  // If user has defined waypoints, use them (limit to 2)
  if (waypoints && waypoints.length > 0) {
    const limitedWaypoints = waypoints.slice(0, 2);
    limitedWaypoints.forEach(wp => points.push(wp));
    points.push({ x: targetX, y: targetY });
  } else {
    // Auto-generate exactly 2 waypoints that create 90-degree angles
    const isHorizontalFirst = 
      sourcePosition === Position.Left || 
      sourcePosition === Position.Right;
    
    if (isHorizontalFirst) {
      // Start horizontal: source → waypoint1 (horizontal) → waypoint2 (vertical) → target
      const midX = (sourceX + targetX) / 2;
      points.push({ x: midX, y: sourceY }); // First waypoint: same Y as source
      points.push({ x: midX, y: targetY }); // Second waypoint: same Y as target
    } else {
      // Start vertical: source → waypoint1 (vertical) → waypoint2 (horizontal) → target
      const midY = (sourceY + targetY) / 2;
      points.push({ x: sourceX, y: midY }); // First waypoint: same X as source
      points.push({ x: targetX, y: midY }); // Second waypoint: same X as target
    }
    
    points.push({ x: targetX, y: targetY });
  }
  
  // Build SVG path with orthogonal segments
  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x},${points[i].y}`;
  }
  
  // Calculate label position
  const middleIndex = Math.floor(points.length / 2);
  const labelX = points[middleIndex].x;
  const labelY = points[middleIndex].y;
  
  // Return the draggable waypoints (exclude source and target, limit to 2)
  const draggableWaypoints = points.slice(1, -1).slice(0, 2);
  
  return [path, labelX, labelY, draggableWaypoints];
};

const getRelationshipColor = (type?: string): string => {
  switch (type) {
    case '1:1':
      return '#10b981';
    case '1:N':
      return '#3b82f6';
    case 'N:M':
      return '#8b5cf6';
    default:
      return '#6b7280';
  }
};

const getMarkerIds = (type?: string): { markerStart: string; markerEnd: string } => {
  const color = getRelationshipColor(type).replace('#', '');
  
  switch (type) {
    case '1:1':
      return {
        markerStart: `url(#one-one-start-${color})`,
        markerEnd: `url(#one-one-end-${color})`,
      };
    case '1:N':
      return {
        markerStart: `url(#one-${color})`,
        markerEnd: `url(#many-${color})`,
      };
    case 'N:M':
      return {
        markerStart: `url(#many-${color})`,
        markerEnd: `url(#many-${color})`,
      };
    default:
      return {
        markerStart: '',
        markerEnd: `url(#many-${color})`,
      };
  }
};

function OrthogonalRelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  markerStart,
  selected,
  source,
  target,
}: RelationshipEdgeProps) {
  const relationshipType = data?.relationshipType || '1:N';
  const isAttributeRelationship = data?.isAttributeRelationship || false;
  const color = getRelationshipColor(relationshipType);
  const [isHovered, setIsHovered] = useState(false);
  const [draggedWaypoint, setDraggedWaypoint] = useState<number | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const { setEdges } = useReactFlow();
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  
  // Get viewport transform for coordinate conversion
  const transform = useStore((state) => state.transform);
  const [zoomLevel, offsetX, offsetY] = transform;
  
  // Use orthogonal path - will create 2 default waypoints if none exist
  const [edgePath, labelX, labelY, draggableWaypoints] = getOrthogonalPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data?.waypoints,
  );

  const markers = getMarkerIds(relationshipType);
  
  const edgeStyle = {
    stroke: color,
    strokeWidth: selected ? 3 : isHovered ? 2.5 : 2,
    ...(isAttributeRelationship ? { strokeDasharray: '5,5' } : {}),
    ...style,
  };

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - offsetX) / zoomLevel,
      y: (screenY - offsetY) / zoomLevel,
    };
  }, [offsetX, offsetY, zoomLevel]);

  // Save waypoints to database
  const saveWaypoints = useCallback(async (waypoints: Array<{ x: number; y: number }>) => {
    const relationshipId = data?.relationshipId;
    if (relationshipId) {
      try {
        await fetch(`/api/relationships/${relationshipId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            waypoints: waypoints,
          }),
        });
        console.log('Waypoints saved successfully');
      } catch (error) {
        console.error('Failed to save waypoints:', error);
      }
    }
  }, [data]);

  // Handle waypoint dragging
  const handleWaypointDragStart = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setDraggedWaypoint(index);
    dragStartPos.current = screenToCanvas(e.clientX, e.clientY);
  }, [screenToCanvas]);

  const handleWaypointDrag = useCallback((e: React.MouseEvent) => {
    if (draggedWaypoint !== null && dragStartPos.current) {
      e.stopPropagation();
      
      // Calculate new position in canvas coordinates
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      
      // Get current waypoints or use draggable waypoints (ensure max 2)
      const currentWaypoints = data?.waypoints || draggableWaypoints;
      const newWaypoints = [...currentWaypoints].slice(0, 2); // Ensure max 2 waypoints
      
      if (newWaypoints.length === 0) return; // Safety check
      
      // For orthogonal paths with 2 waypoints, we have: source -> wp1 -> wp2 -> target
      // wp1 creates a horizontal OR vertical line from source
      // wp2 creates the perpendicular line to wp1, then continues to target
      
      if (draggedWaypoint === 0) {
        // Dragging first waypoint
        // Determine if we're in horizontal-first or vertical-first mode based on drag direction
        const dxFromSource = Math.abs(canvasPos.x - sourceX);
        const dyFromSource = Math.abs(canvasPos.y - sourceY);
        
        if (dxFromSource > dyFromSource) {
          // Horizontal first: wp1 moves horizontally from source
          newWaypoints[0] = { x: canvasPos.x, y: sourceY };
          // wp2 stays at corner position
          if (newWaypoints.length > 1) {
            newWaypoints[1] = { x: canvasPos.x, y: targetY };
          }
        } else {
          // Vertical first: wp1 moves vertically from source
          newWaypoints[0] = { x: sourceX, y: canvasPos.y };
          // wp2 stays at corner position
          if (newWaypoints.length > 1) {
            newWaypoints[1] = { x: targetX, y: canvasPos.y };
          }
        }
      } else if (draggedWaypoint === 1 && newWaypoints.length > 1) {
        // Dragging second waypoint
        const wp1 = newWaypoints[0];
        
        // Second waypoint must align with either wp1's X or Y to maintain orthogonal path
        // Check if wp1 is horizontal or vertical from source
        const wp1IsHorizontal = Math.abs(wp1.y - sourceY) < 1;
        
        if (wp1IsHorizontal) {
          // wp1 is horizontal from source, so wp2 should be vertical from wp1
          newWaypoints[1] = { x: wp1.x, y: canvasPos.y };
        } else {
          // wp1 is vertical from source, so wp2 should be horizontal from wp1
          newWaypoints[1] = { x: canvasPos.x, y: wp1.y };
        }
      }
      
      // Update edge data
      setEdges((edges) =>
        edges.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                data: {
                  ...edge.data,
                  waypoints: newWaypoints,
                },
              }
            : edge
        )
      );
    }
  }, [draggedWaypoint, data, draggableWaypoints, id, setEdges, screenToCanvas, sourceX, sourceY, targetX, targetY]);

  const handleWaypointDragEnd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedWaypoint(null);
    dragStartPos.current = null;
    
    // Save waypoints to database
    if (data?.waypoints) {
      saveWaypoints(data.waypoints);
    }
  }, [data, saveWaypoints]);

  const getRelationshipDescription = (type: string) => {
    switch (type) {
      case '1:1':
        return 'One-to-One: Each record in source relates to exactly one record in target';
      case '1:N':
        return 'One-to-Many: Each record in source can relate to multiple records in target';
      case 'N:M':
        return 'Many-to-Many: Records in both entities can relate to multiple records in the other';
      default:
        return 'Relationship between data objects';
    }
  };

  return (
    <>
      {/* Define custom markers in SVG defs */}
      <defs>
        <style>
          {`
            ${createOneMarker(color)}
            ${createManyMarker(color)}
            ${createOneOneMarker(color, false)}
            ${createOneOneMarker(color, true)}
          `}
        </style>
      </defs>

      {/* Main edge path with hover detection */}
      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <BaseEdge
          id={id}
          path={edgePath}
          style={edgeStyle}
        />
        
        {/* Invisible wider path for easier hover detection */}
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth="20"
          style={{ cursor: 'pointer' }}
        />
        
        {/* Visual indicator at target end: 3 lines for "many", 1 line for "one" */}
        {(() => {
          // Determine if this is a "many" relationship
          const isMany = relationshipType.includes('N') || relationshipType.includes('M');
          
          // Get the last segment direction to position the indicator
          const points = edgePath.split(/[ML]/).filter(p => p.trim()).map(p => {
            const [x, y] = p.trim().split(',').map(Number);
            return { x, y };
          });
          
          if (points.length < 2) return null;
          
          const lastPoint = points[points.length - 1];
          const secondLastPoint = points[points.length - 2];
          
          // Calculate direction
          const dx = lastPoint.x - secondLastPoint.x;
          const dy = lastPoint.y - secondLastPoint.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          
          if (length === 0) return null;
          
          // Normalized direction
          const dirX = dx / length;
          const dirY = dy / length;
          
          // Perpendicular direction
          const perpX = -dirY;
          const perpY = dirX;
          
          // Position indicator 20px before the target
          const indicatorDistance = 20;
          const baseX = lastPoint.x - dirX * indicatorDistance;
          const baseY = lastPoint.y - dirY * indicatorDistance;
          
          const lineLength = 12; // Longer lines for better visibility
          const spacing = 4; // More spacing between lines
          
          if (isMany) {
            // Draw 3 parallel lines for "many" relationship
            return (
              <g>
                {[-1, 0, 1].map((offset) => (
                  <line
                    key={offset}
                    x1={baseX + perpX * offset * spacing - perpX * lineLength / 2}
                    y1={baseY + perpY * offset * spacing - perpY * lineLength / 2}
                    x2={baseX + perpX * offset * spacing + perpX * lineLength / 2}
                    y2={baseY + perpY * offset * spacing + perpY * lineLength / 2}
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                ))}
              </g>
            );
          } else {
            // Draw 1 line for "one" relationship
            return (
              <line
                x1={baseX - perpX * lineLength / 2}
                y1={baseY - perpY * lineLength / 2}
                x2={baseX + perpX * lineLength / 2}
                y2={baseY + perpY * lineLength / 2}
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            );
          }
        })()}

        {/* Render ALWAYS VISIBLE draggable waypoint circles (1-2 points max) */}
        {draggableWaypoints.map((waypoint, index) => {
          const isDragging = draggedWaypoint === index;
          const isHovering = hoveredSegment === index;
          
          return (
            <g 
              key={`waypoint-${index}`}
              onMouseDown={(e) => handleWaypointDragStart(e, index)}
              onMouseMove={handleWaypointDrag}
              onMouseUp={handleWaypointDragEnd}
              onMouseEnter={() => setHoveredSegment(index)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {/* Main draggable circle - smaller but visible */}
              <circle
                cx={waypoint.x}
                cy={waypoint.y}
                r={isDragging ? 7 : isHovering ? 6 : 5}
                fill={isDragging ? color : 'white'}
                stroke={color}
                strokeWidth="2"
                style={{ 
                  cursor: isDragging ? 'grabbing' : 'grab',
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))',
                  transition: 'all 0.2s',
                }}
              />
              
              {/* Inner dot for visual feedback */}
              <circle
                cx={waypoint.x}
                cy={waypoint.y}
                r="2"
                fill={isDragging ? 'white' : color}
                style={{ pointerEvents: 'none' }}
              />
            </g>
          );
        })}
      </g>
    </>
  );
}

export default memo(OrthogonalRelationshipEdge);
