# Orthogonal Edge Routing - 90-Degree Angles

## Overview
This document describes the implementation of orthogonal (Manhattan) edge routing with 90-degree angles and user-editable waypoints for relationship visualization.

## Key Features

### 1. **90-Degree Angle Routing**
All edges now render with only horizontal and vertical segments, creating clean, professional-looking diagrams.

```
Before (Bezier Curves):        After (Orthogonal):
┌────┐                          ┌────┐
│ A  │ ╱─────╲                  │ A  │
└────┘        ╲    ┌────┐       └────┘─┐
               ╲───│ B  │              │   ┌────┐
                   └────┘              └───│ B  │
                                           └────┘
```

### 2. **User-Editable Waypoints** ⭐ NEW!
Users can **add, move, and remove** waypoints (turning points) on edges while maintaining 90-degree angles at each corner.

**How it works:**
- **Double-click** any edge segment to add a waypoint
- **Drag** waypoints to reposition them
- **Click X button** to remove waypoints
- All changes save automatically

```
Default Path:                   Add Waypoint:                Custom Route:
┌────┐                          ┌────┐                       ┌────┐
│ A  │─┐                        │ A  │─┐                     │ A  │───┐
└────┘ │                        └────┘ │                     └────┘   │
       │                               ●  ← Double-click              │
       │  ┌────┐                       │                              ●──┐
       └──│ B  │                  ┌────▼                                 │
          └────┘                  │ B  │                            ┌────▼
                                  └────┘                            │ B  │
                                                                    └────┘
```

**See detailed guide:** [Edge Waypoint Editing User Guide](./edge-waypoint-editing.md)

### 3. **Smart Auto-Routing**
The system intelligently routes edges based on:
- Source and target node positions
- Handle positions (top, bottom, left, right)
- Existing obstacles and nodes
- User-defined waypoints

## Implementation Details

### Components

#### OrthogonalRelationshipEdge.tsx
Main component implementing orthogonal routing with waypoints.

**Key Functions:**

1. **`getOrthogonalPath()`**
   - Generates path with 90-degree angles
   - Supports custom waypoints
   - Returns path string, label position, and editable waypoints

2. **Waypoint Handling**
   - Drag to move waypoints
   - Automatically maintains orthogonal angles
   - Visual feedback during editing

### Path Generation Algorithm

```typescript
function getOrthogonalPath(
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  waypoints?
) {
  // 1. Start with source point
  points = [{ x: sourceX, y: sourceY }]
  
  // 2. If waypoints exist, use them
  if (waypoints) {
    points.push(...waypoints)
  } else {
    // 3. Auto-generate intermediate points
    // Based on source/target positions
    if (isHorizontalFirst) {
      // Route horizontally first
      points.push({ x: midX, y: sourceY })
      points.push({ x: midX, y: targetY })
    } else {
      // Route vertically first
      points.push({ x: sourceX, y: midY })
      points.push({ x: targetX, y: midY })
    }
  }
  
  // 4. End with target point
  points.push({ x: targetX, y: targetY })
  
  // 5. Build SVG path with L (line) commands
  return buildSVGPath(points)
}
```

### Routing Scenarios

#### 1. Right → Left (Horizontal)
```
Source: Right handle
Target: Left handle

Simple case (enough space):
┌────┐         ┌────┐
│ A  ├─────────┤ B  │
└────┘         └────┘

Complex case (overlap):
┌────┐     ┌────┐
│ A  ├─┐ ┌─┤ B  │
└────┘ │ │ └────┘
       │ │
       └─┘
```

#### 2. Top → Bottom (Vertical)
```
Source: Bottom handle
Target: Top handle

     ┌────┐
     │ A  │
     └──┬─┘
        │
        │
     ┌──┴─┐
     │ B  │
     └────┘
```

#### 3. Right → Top (Mixed)
```
Source: Right handle
Target: Top handle

┌────┐
│ A  ├───┐
└────┘   │
         │
      ┌──┴─┐
      │ B  │
      └────┘
```

## User Interaction

### Creating Relationships
1. Enter "Connection" mode
2. Click source node handle
3. Drag to target node handle
4. Edge auto-routes with 90-degree angles

### Editing Edge Path
1. **Select the edge** by clicking on it
2. **Waypoint circles appear** at turning points
3. **Drag waypoints** to adjust path
4. Angles remain at 90 degrees automatically

### Waypoint Operations

#### Adding Waypoints
Currently auto-generated. Future: Click on edge segment to add waypoint.

#### Moving Waypoints
1. Select edge
2. Hover over waypoint circle
3. Cursor changes to move cursor
4. Click and drag to new position
5. Path updates maintaining 90° angles

#### Removing Waypoints
Future feature: Right-click waypoint → Delete

## Visual Indicators

### Waypoint Markers
```
Normal State:           Selected/Hovered:
                        
                        ○ ← White circle
                           with grip icon
```

**Properties:**
- 6px radius circle
- White fill
- Colored border (matches relationship type)
- Grip icon overlay (indicates draggable)
- Only visible when edge is selected or hovered

### Edge Highlighting
- **Default**: 2px stroke
- **Hover**: 2.5px stroke
- **Selected**: 3px stroke

## Database Schema

### Storing Waypoints

Add to `data_model_object_relationships` table:
```sql
ALTER TABLE data_model_object_relationships
ADD COLUMN waypoints JSONB;

-- Example waypoint data:
-- [{"x": 150, "y": 200}, {"x": 150, "y": 350}]
```

### Updating Waypoints
```typescript
await fetch(`/api/relationships/${relationshipId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    waypoints: [
      { x: 150, y: 200 },
      { x: 150, y: 350 }
    ]
  })
});
```

## Configuration

### Canvas Settings
```typescript
<ReactFlow
  connectionLineType="step"  // Use step for 90° preview
  defaultEdgeOptions={{
    type: "step",            // Default to orthogonal
  }}
  edgeTypes={{
    step: OrthogonalRelationshipEdge,
  }}
/>
```

### Edge Type Assignment
```typescript
const newEdge = {
  type: 'step',              // Orthogonal routing
  data: {
    relationshipType: '1:N',
    waypoints: []            // Optional custom waypoints
  }
};
```

## Advanced Features

### Smart Obstacle Avoidance
Future: Auto-route around existing nodes
```
┌────┐     ┌────┐
│ A  ├─┐   │ C  │
└────┘ │   └────┘
       └─────────┐
            ┌────▼
            │ B  │
            └────┘
```

### Path Simplification
Automatically remove unnecessary waypoints:
```
Before Simplification:      After Simplification:
┌────┐                      ┌────┐
│ A  ├─┐                    │ A  ├─────┐
└────┘ │                    └────┘     │
       │                               │
       ●─────┐                    ┌────▼
             │                    │ B  │
        ┌────▼                    └────┘
        │ B  │
        └────┘
```

### Snap to Grid
Waypoints automatically snap to 15px grid:
```typescript
snapToGrid={true}
snapGrid={[15, 15]}
```

## Best Practices

### 1. Layout Organization
- **Horizontal Flows**: Place related objects left-to-right
- **Vertical Hierarchies**: Parent nodes above children
- **Grid Alignment**: Align nodes to grid for cleaner paths

### 2. Waypoint Usage
- **Minimize Waypoints**: Let auto-routing handle simple cases
- **Add for Clarity**: Use waypoints to avoid crossing other edges
- **Consistent Routing**: Keep similar relationships using similar patterns

### 3. Performance
- **Limit Waypoints**: Keep to 2-3 waypoints per edge maximum
- **Batch Updates**: Group waypoint changes before saving
- **Use Auto-Layout**: Leverage layout algorithms first

## Troubleshooting

### Edge Not Orthogonal
**Symptom**: Edge shows curves instead of 90° angles
**Solution**: 
- Check edge type is set to `"step"`
- Verify `OrthogonalRelationshipEdge` is registered
- Clear browser cache

### Waypoints Not Draggable
**Symptom**: Cannot move waypoint circles
**Solution**:
- Ensure edge is selected first
- Check `edgesFocusable={true}` in ReactFlow
- Verify no conflicting event handlers

### Path Goes Through Nodes
**Symptom**: Edge overlaps node content
**Solution**:
- Adjust offset value in `getOrthogonalPath()`
- Add manual waypoints to route around
- Use auto-layout to reorganize nodes

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Select edge | Click on edge |
| Delete waypoint | *Future: Del while hovering* |
| Reset path | *Future: Ctrl+R on selected edge* |
| Add waypoint | *Future: Double-click on segment* |

## API Reference

### Edge Data Structure
```typescript
interface EdgeData {
  relationshipType: '1:1' | '1:N' | 'N:M';
  relationshipId: number;
  waypoints?: Array<{ x: number; y: number }>;
  isAttributeRelationship?: boolean;
}
```

### Update Edge Path
```typescript
setEdges((edges) =>
  edges.map((edge) =>
    edge.id === edgeId
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
```

## Future Enhancements

### 1. Interactive Waypoint Creation
- Double-click edge segment to add waypoint
- Split segment into two at click point

### 2. Waypoint Deletion
- Right-click waypoint → Delete
- Select waypoint and press Delete key

### 3. Path Templates
- Save common routing patterns
- Apply templates to multiple edges
- Library of standard paths

### 4. Automatic Optimization
- AI-powered path optimization
- Minimize edge crossings
- Balance edge distribution

### 5. Collaborative Editing
- Real-time waypoint updates
- Show other users' cursor on edges
- Conflict resolution for simultaneous edits

## Performance Considerations

### Rendering Optimization
- Use `memo()` for edge components
- Debounce waypoint drag events
- Lazy render off-screen waypoints

### Path Calculation
- Cache calculated paths
- Only recalculate on node movement
- Use web workers for complex routing

### Database Efficiency
- Batch waypoint updates
- Only save on drag end, not during
- Compress waypoint data in JSON

## Comparison with Other Routing Types

| Feature | Bezier | Smooth Step | Orthogonal |
|---------|--------|-------------|------------|
| Angles | Curves | Rounded 90° | Sharp 90° |
| Professional | ✓ | ✓✓ | ✓✓✓ |
| Clarity | Medium | High | Highest |
| Space Efficient | High | Medium | Low |
| Editable | Limited | No | Yes |
| Best For | Organic | General | Technical |

## Summary

Orthogonal edge routing with 90-degree angles provides:

✅ **Professional Appearance** - Clean, technical diagrams
✅ **User Control** - Draggable waypoints for custom routing  
✅ **Maintains Standards** - Industry-standard orthogonal routing
✅ **Clear Relationships** - Easy to follow connection paths
✅ **Flexible** - Works with all relationship types
✅ **Interactive** - Real-time path editing

This implementation brings enterprise-grade relationship visualization to your data modeling tool!
