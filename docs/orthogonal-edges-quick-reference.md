# Orthogonal Edge Routing - Quick Reference

## What's New?

Your data modeling relationships now use **90-degree angles** (orthogonal routing) instead of curved lines. This gives a more professional, technical appearance similar to enterprise tools like ERwin, PowerDesigner, and Visio.

## Visual Examples

### Before vs After

**Before (Curved):**
```
┌─────────┐
│ Order   │ ╱─────╲    ┌──────────┐
│         │        ╲───│ Customer │
└─────────┘            └──────────┘
```

**After (90-Degree Angles):**
```
┌─────────┐
│ Order   │─┐
│         │ │
└─────────┘ │
            │
       ┌────┘
       │
  ┌────▼──────┐
  │ Customer  │
  └───────────┘
```

## Key Features

### 1. **All Angles are 90 Degrees**
- ✅ Only horizontal and vertical line segments
- ✅ Clean, professional appearance
- ✅ Easier to follow relationships

### 2. **User-Editable Waypoints**
When you select an edge, you'll see small circles at the turning points. You can drag these to customize the path!

```
Select edge → See waypoints → Drag to adjust

┌────┐              ┌────┐
│ A  │─┐            │ A  │─┐
└────┘ │            └────┘ │
       │                   │
       ●  ← Drag this!     ●───┐
       │                       │
  ┌────▼                  ┌────▼
  │ B  │                  │ B  │
  └────┘                  └────┘
```

### 3. **Smart Auto-Routing**
- Automatically chooses best path
- Avoids overlapping nodes when possible
- Adjusts based on node positions

## How to Use

### Creating Relationships
1. Click "Connection" mode in toolbar
2. Click and drag from one node to another
3. Edge automatically routes with 90° angles

### Adjusting Edge Path
1. **Click on the edge** to select it
2. **Drag the waypoint circles** to adjust path
3. **Angles stay at 90°** automatically
4. Changes **save automatically**

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Delete edge | Select edge → Press `Delete` |
| Double-click edge | Opens edit modal |

## Tips for Clean Diagrams

### 1. Use Grid Alignment
Your nodes snap to a 15px grid. Keep them aligned for cleaner edge paths:
```
Good:                  Avoid:
┌────┐  ┌────┐        ┌────┐   ┌────┐
│ A  │──│ B  │        │ A  │─╱ │ B  │
└────┘  └────┘        └────┘╱  └────┘
```

### 2. Organize by Flow Direction
- **Left to Right**: Sequential processes
- **Top to Bottom**: Hierarchies
- **Groups**: Related objects close together

### 3. Minimize Crossings
Use waypoints to route edges around other elements:
```
Instead of:           Use waypoints:
┌────┐    ┌────┐     ┌────┐    ┌────┐
│ A  │─┐  │ C  │     │ A  │─┐  │ C  │
└────┘ │  └────┘     └────┘ │  └────┘
    ╲  │                    │
     ╲ │                    │
  ┌───╲▼                ┌───┘
  │ B  │                │
  └────┘            ┌───▼───┐
                    │   B   │
                    └───────┘
```

## Relationship Types

All relationship types now use orthogonal routing:

### One-to-One (1:1) - Green
```
┌────────┐    ║    ║    ┌─────────┐
│  User  │════════════════│ Profile │
└────────┘               └─────────┘
```

### One-to-Many (1:N) - Blue
```
┌────────────┐    ║    ≺    ┌──────────┐
│ Department │═══════════════│ Employee │
└────────────┘               └──────────┘
```

### Many-to-Many (N:M) - Purple
```
┌─────────┐    ≺    ≺    ┌────────┐
│ Student │═══════════════│ Course │
└─────────┘               └────────┘
```

## Advanced Features

### Crow's Foot Notation
The markers at each end show cardinality:
- **║** (single line) = "One"
- **≺** (crow's foot) = "Many"
- **║║** (double line) = "One and only one"

### Hover for Details
Hover over any edge to see:
- Relationship type
- Description
- Tips for editing

### Path Persistence
Your custom waypoint positions are automatically saved to the database and will be there when you reload.

## Troubleshooting

### Edge Not Showing 90° Angles
- **Refresh the page** - The new edge type should load
- **Check browser console** for any errors
- **Clear cache** if using older version

### Can't Drag Waypoints
- **Select the edge first** by clicking on it
- **Look for white circles** with grip icons
- **Make sure you're not in connection mode**

### Path Goes Through Nodes
- **Drag waypoints** to route around nodes
- **Move nodes** to create more space
- **Use auto-layout** to reorganize diagram

## Migration Notes

### Existing Relationships
All existing relationships automatically use orthogonal routing. No action needed!

### Waypoints
Existing edges don't have waypoints by default. You can add them by:
1. Selecting the edge
2. Dragging the auto-generated waypoints
3. Positions will be saved automatically

## Best Practices Checklist

- [ ] Keep nodes aligned to grid
- [ ] Organize by flow direction
- [ ] Use waypoints to avoid crossings
- [ ] Minimize waypoint count (2-3 max)
- [ ] Test on different zoom levels
- [ ] Use auto-layout for complex diagrams

## Getting Help

### Common Questions

**Q: Can I turn off orthogonal routing?**
A: Currently, all edges use 90° angles for consistency. This matches industry-standard data modeling tools.

**Q: How many waypoints can I add?**
A: While there's no hard limit, we recommend 2-3 maximum for clarity.

**Q: Do waypoints work on mobile?**
A: Yes! Touch and drag the waypoint circles on touch devices.

**Q: Can I copy edge routing to other edges?**
A: This is a future enhancement. Currently, each edge is customized individually.

### Need More Help?

- 📖 See full documentation: `docs/orthogonal-edge-routing.md`
- 💡 Review examples: `docs/relationship-notation-guide.md`
- 🐛 Report issues: Use the feedback button in the app

## Summary

✅ **90-degree angles** for professional appearance
✅ **Draggable waypoints** for custom routing
✅ **Auto-save** preserves your customizations
✅ **Smart routing** handles most cases automatically
✅ **Industry standard** matches enterprise tools

Enjoy your improved relationship visualization! 🎉
