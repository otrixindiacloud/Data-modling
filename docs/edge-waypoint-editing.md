# Edge Waypoint Editing - User Guide

## Overview

You can now **add, move, and remove turning points** (waypoints) on relationship edges to customize the routing path. This gives you complete control over how edges flow through your diagram without affecting node positions.

## Visual Demo

### Before Adding Waypoints
```
┌─────────┐
│ Order   │─────┐
└─────────┘     │
                │
           ┌────▼──────┐
           │ Customer  │
           └───────────┘
```

### After Adding Waypoints
```
┌─────────┐
│ Order   │─┐
└─────────┘ │
            │
            ●───┐  ← Added waypoint
                │
                ●─┐  ← Added waypoint
                  │
             ┌────▼──────┐
             │ Customer  │
             └───────────┘
```

## Key Features

### 1. **Add Waypoints** - Expand Edge Path
Double-click on any edge segment to add a new turning point.

**How it works:**
- **Hover** over an edge to see small circles at segment midpoints
- **Double-click** a circle to add a waypoint at that location
- The edge path expands to include your new turning point
- All angles remain at 90 degrees

```
Step 1: Hover          Step 2: Double-click      Step 3: Result
┌────┐                ┌────┐                     ┌────┐
│ A  │─┐              │ A  │─┐                   │ A  │─┐
└────┘ │              └────┘ │                   └────┘ │
       ●  ← Click!            ●                          ●
       │                      │                          │
  ┌────▼                 ┌────▼                     ┌────┘
  │ B  │                 │ B  │                     │
  └────┘                 └────┘                ┌────▼
                                               │ B  │
                                               └────┘
```

### 2. **Move Waypoints** - Adjust Path
Drag any waypoint to reposition it and reshape the edge path.

**How it works:**
- **Click and hold** on a waypoint (white circle with grip icon)
- **Drag** to move it to a new position
- The edge path updates in real-time
- **Release** to save the new position

```
Before:                After dragging:
┌────┐                ┌────┐
│ A  │─┐              │ A  │─┐
└────┘ │              └────┘ │
       ●                      │
       │                      ●─────┐
  ┌────▼                            │
  │ B  │                       ┌────▼
  └────┘                       │ B  │
                               └────┘
```

### 3. **Remove Waypoints** - Simplify Path
Click the red X button on any waypoint to remove it.

**How it works:**
- **Select** the edge by clicking on it
- **Hover** over a waypoint to see the red X button
- **Click** the X button to remove that waypoint
- The edge path automatically adjusts

```
Before:                After removing:
┌────┐                ┌────┐
│ A  │─┐              │ A  │─┐
└────┘ │              └────┘ │
       ● ✕ ← Click!          │
       │                      │
       ●                 ┌────▼
       │                 │ B  │
  ┌────▼                └────┘
  │ B  │
  └────┘
```

## Step-by-Step Instructions

### Adding Your First Waypoint

1. **Create or select a relationship edge**
   - You should see the edge line connecting two nodes

2. **Hover over the edge**
   - Small circles appear at the midpoint of each segment
   - These are potential waypoint locations

3. **Double-click on a circle**
   - A new waypoint is created at that location
   - The edge path expands to include this turning point

4. **The waypoint is automatically saved**
   - No need to click save - changes persist immediately

### Customizing Edge Routes

**Example: Route around other nodes**

```
Problem: Edge crosses through other nodes
┌────────┐           ┌─────────┐
│ Order  │─────✕─────│ Payment │
└────────┘     │     └─────────┘
               │
          ┌────▼────┐
          │ Product │
          └─────────┘

Solution: Add waypoints to route around
┌────────┐           ┌─────────┐
│ Order  │─┐    ┌────│ Payment │
└────────┘ │    │    └─────────┘
           │    │
           ●────┘
           │
           │
      ┌────▼────┐
      │ Product │
      └─────────┘
```

### Best Practices

#### 1. **Minimize Waypoints**
- Use only as many waypoints as needed
- Simpler paths are easier to understand
- Recommended: 1-3 waypoints per edge

```
Good:                  Avoid:
┌────┐                ┌────┐
│ A  │─┐              │ A  │─┐
└────┘ │              └────┘ │
       ●                      ●─┐
       │                        ●─┐
  ┌────▼                          ●─┐
  │ B  │                            ●─┐
  └────┘                              │
                                 ┌────▼
                                 │ B  │
                                 └────┘
```

#### 2. **Align Waypoints**
- Use the grid snapping to keep waypoints aligned
- Aligned paths look more professional

```
Good:                  Less organized:
┌────┐ ┌────┐        ┌────┐  ┌────┐
│ A  │─●───│ C  │    │ A  │─●╱ │ C  │
└────┘ │   └────┘    └────┘╱ │ └────┘
       │                   ╱  │
       ●              ●───●   │
       │              │       │
  ┌────▼         ┌───▼────┐
  │ B  │         │   B    │
  └────┘         └────────┘
```

#### 3. **Avoid Unnecessary Crossings**
- Use waypoints to route edges around intersections
- Keep relationships clear and traceable

```
Before:                After:
   ╲                   ┌────┐
┌───╲───┐             │  A  │─┐
│  A │  │             └────┘ │
└───╱───┘                    ●───┐
   ╱                             │
  ×  ← Confusing!          ┌─────┘
 ╱                         │
┌───────┐             ┌────▼───┐
│   B   │             │   B    │
└───────┘             └────────┘
```

## Visual Indicators

### Waypoint States

| State | Appearance | Description |
|-------|------------|-------------|
| **Normal** | ⚪ White circle with colored border | Waypoint exists on path |
| **Hover** | ⚪ Larger circle with grip icon | Ready to drag |
| **Dragging** | ⚪ Follows cursor | Being repositioned |
| **Selected** | ⚪ with ❌ | Can be removed |

### Segment Add Points

| State | Appearance | Description |
|-------|------------|-------------|
| **Normal** | ⚪ Small semi-transparent circle | Potential waypoint location |
| **Hover** | ⚪ Larger with ➕ icon | Double-click to add |
| **Active** | ⚪ Highlighted in edge color | Ready to add waypoint |

## Keyboard & Mouse Controls

### Mouse Actions

| Action | Result |
|--------|--------|
| **Hover edge** | Shows add-waypoint circles and waypoint controls |
| **Double-click segment** | Adds new waypoint at that location |
| **Click + Drag waypoint** | Moves waypoint to new position |
| **Click X button** | Removes waypoint |
| **Click edge** | Selects edge and shows all controls |

### Tips for Smooth Editing

1. **Zoom in** for precise waypoint placement
2. **Use grid snapping** for aligned waypoints
3. **Start with fewer waypoints** and add more if needed
4. **Test at different zoom levels** to ensure clarity

## Common Use Cases

### 1. **Avoid Node Overlaps**
Add waypoints to route edges around nodes that block the direct path.

### 2. **Organize Complex Diagrams**
Use waypoints to group related edges and keep them parallel.

```
Without waypoints:       With waypoints:
┌────┐                  ┌────┐
│ A  │──┐               │ A  │─┐
└────┘  │               └────┘ │
        ├──┐                   ●───┐
┌────┐  │  │            ┌────┐ │   │
│ B  │──┘  │            │ B  │─●   │
└────┘     │            └────┘ │   │
           │                   │   │
      ┌────▼───┐           ┌───▼───▼┐
      │   C    │           │    C   │
      └────────┘           └────────┘
```

### 3. **Highlight Data Flow**
Route edges to show the direction of data flow in your system.

### 4. **Separate Bidirectional Relationships**
Use waypoints to show separate paths for two-way relationships.

## Persistence & Data

### Automatic Saving
- **All waypoint changes are saved automatically** to the database
- Changes persist across page reloads
- No manual save button needed

### Database Storage
- Waypoints are stored in the `metadata` field of relationships
- Format: `{ waypoints: [{ x: 100, y: 200 }, ...] }`
- Can be exported with your data model

### Performance
- Waypoints have minimal performance impact
- Recommended limit: 10 waypoints per edge (2-3 is optimal)
- Large diagrams with many waypoints load quickly

## Troubleshooting

### Waypoint Won't Drag
**Problem:** Clicking waypoint doesn't initiate drag

**Solutions:**
- Make sure edge is selected (click on it first)
- Check you're not in "Add Node" or "Connection" mode
- Try zooming in for easier clicking

### Can't Add Waypoint
**Problem:** Double-clicking segment doesn't add waypoint

**Solutions:**
- Make sure you're double-clicking on the small circle
- Edge must be hovered for circles to appear
- Try clicking slower - wait between clicks

### Edge Path Looks Wrong
**Problem:** Edge doesn't route through waypoints correctly

**Solutions:**
- Try removing and re-adding waypoints
- Check if waypoints are too close together
- Refresh the page to reload edge calculations

### Waypoints Not Saving
**Problem:** Waypoints disappear after page reload

**Solutions:**
- Check browser console for API errors
- Ensure database connection is working
- Verify relationship has a valid ID

## Advanced Techniques

### 1. **Parallel Edge Routing**
Create multiple parallel edges with consistent waypoints:
- Add first edge with waypoints
- Create second edge
- Add waypoints at similar positions

### 2. **Edge Grouping**
Group related edges together:
- Route edges through common waypoints
- Creates visual hierarchy in diagram

### 3. **Curved Effect**
Approximate curves using multiple waypoints:
```
Sharp turn:            Smooth curve:
┌────┐                ┌────┐
│ A  │─┐              │ A  │─┐
└────┘ │              └────┘ │
       ●                      ●─┐
       │                        ●┐
  ┌────▼                         ●
  │ B  │                         │
  └────┘                    ┌────▼
                            │ B  │
                            └────┘
```

## Quick Reference Card

### ➕ Add Waypoint
1. Hover over edge
2. Double-click on segment circle
3. New waypoint created

### 🎯 Move Waypoint
1. Click and hold waypoint
2. Drag to new position
3. Release to save

### ❌ Remove Waypoint
1. Select edge
2. Click X button on waypoint
3. Waypoint removed

### 💡 Pro Tips
- Keep it simple: 1-3 waypoints per edge
- Use grid snapping for alignment
- Test different zoom levels
- Remove unnecessary waypoints

## Examples Gallery

### Example 1: Database Schema
```
┌──────────┐
│ User     │─┐
└──────────┘ │
             ●───┐
                 │
            ┌────▼────┐
            │ Address │
            └─────────┘
```

### Example 2: Process Flow
```
┌────────┐     ┌─────────┐
│ Start  │─────│ Process │─┐
└────────┘     └─────────┘ │
                           ●───┐
                               │
                          ┌────▼───┐
                          │  End   │
                          └────────┘
```

### Example 3: Complex Routing
```
┌────┐           ┌────┐
│ A  │─┐     ┌───│ D  │
└────┘ │     │   └────┘
       ●─────●
       │     │
  ┌────▼ ┌───▼──┐
  │ B  │ │  C   │
  └────┘ └──────┘
```

## Summary

✅ **Double-click** segment to add waypoint  
✅ **Drag** waypoint to move it  
✅ **Click X** to remove waypoint  
✅ **Automatic saving** - changes persist  
✅ **90-degree angles** maintained  
✅ **Full control** over edge routing  

**You can now create professional, organized diagrams with complete control over how your relationships flow!** 🎉

## Related Documentation

- 📘 [Orthogonal Edge Routing Guide](./orthogonal-edge-routing.md)
- 📗 [Relationship Notation Guide](./relationship-notation-guide.md)
- 📕 [Quick Reference](./orthogonal-edges-quick-reference.md)
