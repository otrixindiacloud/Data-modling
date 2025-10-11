import React, { memo, useState } from 'react';
import {
  EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
  EdgeMarker,
  Position,
} from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link2, Database, Zap } from 'lucide-react';

interface RelationshipEdgeData {
  relationshipType?: '1:1' | '1:N' | 'N:M';
  relationshipId?: number;
  sourceAttributeId?: number;
  targetAttributeId?: number;
  isAttributeRelationship?: boolean;
  label?: string;
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

// Generate orthogonal (90-degree) path between two points
const getOrthogonalPath = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
): [string, number, number] => {
  const offset = 20; // Minimum offset from node
  
  // Calculate path points based on source and target positions
  const points: [number, number][] = [[sourceX, sourceY]];
  
  // Determine if we need horizontal or vertical segments first
  const isHorizontalFirst = 
    sourcePosition === Position.Left || 
    sourcePosition === Position.Right;
  
  const isTargetHorizontal = 
    targetPosition === Position.Left || 
    targetPosition === Position.Right;
  
  // Calculate intermediate points for orthogonal routing
  if (isHorizontalFirst) {
    // Start horizontally from source
    const midX = (sourceX + targetX) / 2;
    
    if (sourcePosition === Position.Right && targetPosition === Position.Left) {
      // Right to Left - simple case
      if (sourceX < targetX - offset * 2) {
        points.push([midX, sourceY]);
        points.push([midX, targetY]);
      } else {
        // Need to route around
        const routeY = Math.min(sourceY, targetY) - offset;
        points.push([sourceX + offset, sourceY]);
        points.push([sourceX + offset, routeY]);
        points.push([targetX - offset, routeY]);
        points.push([targetX - offset, targetY]);
      }
    } else if (sourcePosition === Position.Left && targetPosition === Position.Right) {
      // Left to Right
      if (sourceX > targetX + offset * 2) {
        points.push([midX, sourceY]);
        points.push([midX, targetY]);
      } else {
        const routeY = Math.min(sourceY, targetY) - offset;
        points.push([sourceX - offset, sourceY]);
        points.push([sourceX - offset, routeY]);
        points.push([targetX + offset, routeY]);
        points.push([targetX + offset, targetY]);
      }
    } else if (sourcePosition === Position.Right && targetPosition === Position.Top) {
      points.push([targetX, sourceY]);
    } else if (sourcePosition === Position.Right && targetPosition === Position.Bottom) {
      points.push([targetX, sourceY]);
    } else if (sourcePosition === Position.Left && targetPosition === Position.Top) {
      points.push([targetX, sourceY]);
    } else if (sourcePosition === Position.Left && targetPosition === Position.Bottom) {
      points.push([targetX, sourceY]);
    }
  } else {
    // Start vertically from source
    const midY = (sourceY + targetY) / 2;
    
    if (sourcePosition === Position.Bottom && targetPosition === Position.Top) {
      // Bottom to Top
      if (sourceY < targetY - offset * 2) {
        points.push([sourceX, midY]);
        points.push([targetX, midY]);
      } else {
        const routeX = Math.min(sourceX, targetX) - offset;
        points.push([sourceX, sourceY + offset]);
        points.push([routeX, sourceY + offset]);
        points.push([routeX, targetY - offset]);
        points.push([targetX, targetY - offset]);
      }
    } else if (sourcePosition === Position.Top && targetPosition === Position.Bottom) {
      // Top to Bottom
      if (sourceY > targetY + offset * 2) {
        points.push([sourceX, midY]);
        points.push([targetX, midY]);
      } else {
        const routeX = Math.min(sourceX, targetX) - offset;
        points.push([sourceX, sourceY - offset]);
        points.push([routeX, sourceY - offset]);
        points.push([routeX, targetY + offset]);
        points.push([targetX, targetY + offset]);
      }
    } else if (sourcePosition === Position.Bottom && targetPosition === Position.Left) {
      points.push([sourceX, targetY]);
    } else if (sourcePosition === Position.Bottom && targetPosition === Position.Right) {
      points.push([sourceX, targetY]);
    } else if (sourcePosition === Position.Top && targetPosition === Position.Left) {
      points.push([sourceX, targetY]);
    } else if (sourcePosition === Position.Top && targetPosition === Position.Right) {
      points.push([sourceX, targetY]);
    }
  }
  
  points.push([targetX, targetY]);
  
  // Build SVG path string
  let path = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i][0]},${points[i][1]}`;
  }
  
  // Calculate label position (middle of path)
  const middleIndex = Math.floor(points.length / 2);
  const labelX = points[middleIndex][0];
  const labelY = points[middleIndex][1];
  
  return [path, labelX, labelY];
};

const getRelationshipColor = (type?: string): string => {
  switch (type) {
    case '1:1':
      return '#10b981'; // green
    case '1:N':
      return '#3b82f6'; // blue
    case 'N:M':
      return '#8b5cf6'; // purple
    default:
      return '#6b7280'; // gray
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

function RelationshipEdge({
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
  
  // Use orthogonal path instead of bezier
  const [edgePath, labelX, labelY] = getOrthogonalPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  );

  const markers = getMarkerIds(relationshipType);
  
  const edgeStyle = {
    stroke: color,
    strokeWidth: selected ? 3 : isHovered ? 2.5 : 2,
    ...(isAttributeRelationship ? { strokeDasharray: '5,5' } : {}),
    ...style,
  };

  // Get relationship type description
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
          markerStart={markers.markerStart}
          markerEnd={markers.markerEnd}
        />
        
        {/* Invisible wider path for easier hover detection */}
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth="20"
          style={{ cursor: 'pointer' }}
        />
      </g>

      {/* Label renderer for custom positioned label */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <TooltipProvider>
            <Tooltip open={isHovered || selected}>
              <TooltipTrigger asChild>
                <Badge
                  variant={selected ? 'default' : 'outline'}
                  className="text-[10px] px-2 py-1 shadow-md cursor-pointer hover:shadow-lg transition-all duration-200 flex items-center gap-1"
                  style={{
                    backgroundColor: selected || isHovered ? color : 'white',
                    color: selected || isHovered ? 'white' : color,
                    borderColor: color,
                    borderWidth: '1.5px',
                  }}
                >
                  {isAttributeRelationship ? (
                    <Zap className="h-3 w-3" />
                  ) : (
                    <Link2 className="h-3 w-3" />
                  )}
                  <span className="font-semibold">{relationshipType}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-xs z-50 bg-white dark:bg-gray-800 border shadow-xl"
              >
                <div className="space-y-2 p-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {isAttributeRelationship ? (
                      <>
                        <Zap className="h-4 w-4 text-yellow-500" />
                        <span>Attribute Relationship</span>
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 text-blue-500" />
                        <span>Object Relationship</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground">
                      {getRelationshipDescription(relationshipType)}
                    </p>
                    <div className="pt-1 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground">
                        <strong>Tip:</strong> Double-click to edit • Drag handles to reconnect
                      </p>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(RelationshipEdge);
