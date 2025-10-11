# Edge Waypoint Controls - Quick Visual Guide

## 🎯 What You Can Do

### Add Turning Points ➕
**Double-click on edge segments to add waypoints**

```
Step 1: See the edge        Step 2: Hover              Step 3: Double-click
┌─────────┐                ┌─────────┐                 ┌─────────┐
│ Customer│─┐              │ Customer│─┐               │ Customer│─┐
└─────────┘ │              └─────────┘ │               └─────────┘ │
            │                          ⊕ ← Click!                  ●  NEW!
       ┌────▼────┐                     │                           │
       │  Order  │                ┌────▼────┐                 ┌────┘
       └─────────┘                │  Order  │                 │
                                  └─────────┘            ┌────▼────┐
                                                         │  Order  │
                                                         └─────────┘
```

### Move Points 🎯
**Click and drag waypoints to adjust the path**

```
Before dragging:           While dragging:            After dragging:
┌────┐                    ┌────┐                     ┌────┐
│ A  │─┐                  │ A  │─┐                   │ A  │─────┐
└────┘ │                  └────┘ │                   └────┘     │
       ●                          ● ←drag→                      ●
       │                          │                              │
  ┌────▼                     ┌────▼                         ┌────▼
  │ B  │                     │ B  │                         │ B  │
  └────┘                     └────┘                         └────┘
```

### Remove Points ❌
**Click the X button to remove waypoints**

```
Selected edge:             Click X:                   Result:
┌────┐                    ┌────┐                     ┌────┐
│ A  │─┐                  │ A  │─┐                   │ A  │─┐
└────┘ │                  └────┘ │                   └────┘ │
       ● ✕ ← Click!              ● [REMOVED]                │
       │                          │                          │
       ●                          ●                     ┌────▼
       │                          │                     │ B  │
  ┌────▼                     ┌────▼                    └────┘
  │ B  │                     │ B  │
  └────┘                     └────┘
```

## 🖱️ Mouse Actions

| What You Do | What Happens | Visual |
|-------------|--------------|--------|
| **Hover edge** | Shows waypoint controls | ⚪ circles appear |
| **Double-click segment** | Adds new waypoint | ⊕ becomes ● |
| **Click waypoint** | Selects for dragging | ● highlights |
| **Drag waypoint** | Moves turning point | ● follows cursor |
| **Click X** | Removes waypoint | ● disappears |

## 📊 Visual States

### Waypoint Appearance

```
State          Visual        Description
─────────────────────────────────────────────────
Normal         ⚪            Ready to interact
                            
Hover          ⚪ 📍         Shows grip icon
                            Can drag
                            
Dragging       ⚪····        Following cursor
                            Path updates live
                            
Selected       ⚪ ✕          Shows remove button
               (edge must be selected)
```

### Segment Add Buttons

```
State          Visual        Description
─────────────────────────────────────────────────
Hidden         ─────         Not visible
                            
Visible        ──⊙──        Small circle on segment
               (hover)       Double-click to add
                            
Active         ──⊕──        Shows plus icon
               (hover)       Ready to add waypoint
```

## 🎨 Complete Example

**Building a Complex Route:**

```
1. Start with basic edge
┌─────────┐
│ Product │─────────────┐
└─────────┘             │
                   ┌────▼─────┐
                   │ Category │
                   └──────────┘

2. Add first waypoint (double-click midpoint)
┌─────────┐
│ Product │─────┐
└─────────┘     ●
                │
           ┌────▼─────┐
           │ Category │
           └──────────┘

3. Add second waypoint to route around
┌─────────┐
│ Product │─────┐
└─────────┘     ●
                │
                ●───┐
                    │
               ┌────▼─────┐
               │ Category │
               └──────────┘

4. Drag waypoints to adjust path
┌─────────┐
│ Product │───┐
└─────────┘   │
              ●──────┐
                     │
                     ●─┐
                       │
                  ┌────▼─────┐
                  │ Category │
                  └──────────┘

5. Final polished route
┌─────────┐        ┌──────────┐
│ Product │───┐    │  Brand   │
└─────────┘   │    └──────────┘
              │
              ●──────────┐
                         │
                         ●──┐
                            │
                       ┌────▼─────┐
                       │ Category │
                       └──────────┘
```

## 🔥 Common Patterns

### Pattern 1: Route Around Obstacles
```
BEFORE (crosses nodes):
┌────────┐     ┌────────┐
│ Order  │─────X────────│ Status │
└────────┘     │        └────────┘
          ┌────▼────┐
          │ Product │
          └─────────┘

AFTER (clean routing):
┌────────┐     ┌────────┐
│ Order  │─┐   │ Status │
└────────┘ │   └────────┘
           ●──────┐
                  │
             ┌────┘
             │
        ┌────▼────┐
        │ Product │
        └─────────┘
```

### Pattern 2: Parallel Edges
```
BEFORE (tangled):
┌────┐ ╱─────╲ ┌────┐
│ A  │╱       ╲│ B  │
│    │╲       ╱│    │
└────┘ ╲─────╱ └────┘

AFTER (organized):
┌────┐           ┌────┐
│ A  │─┐       ┌─│ B  │
│    │ ●──┐ ┌──● │    │
│    │ ●──┘ └──● │    │
└────┘           └────┘
```

### Pattern 3: Hub and Spoke
```
Center node with organized connections:

        ┌────┐
        │ A  │
        └────┘
      ╱   │   ╲
     ●    ●    ●
    ╱     │     ╲
┌────┐ ┌────┐ ┌────┐
│ B  │ │ C  │ │ D  │
└────┘ └────┘ └────┘
```

## 💡 Pro Tips

### Tip 1: Use Grid Alignment
```
GOOD (aligned):          BAD (messy):
┌────┐                  ┌────┐
│ A  │─●───●           │ A  │─●╱ ●
└────┘ │   │           └────┘╱ │ ╲
       │   │                 ╱  │  ╲
  ┌────▼───▼──┐         ┌────▼───▼──┐
  │    B      │         │     B      │
  └───────────┘         └────────────┘
```

### Tip 2: Minimize Waypoints
```
GOOD (2 waypoints):     OVERKILL (5 waypoints):
┌────┐                  ┌────┐
│ A  │─●─┐              │ A  │─●─┐
└────┘   │              └────┘  ●─┐
         ●                        ●─┐
         │                          ●─┐
    ┌────▼                            ●─┐
    │ B  │                              │
    └────┘                         ┌────▼
                                   │ B  │
                                   └────┘
```

### Tip 3: Route Direction Matters
```
Left to Right (Process):   Top to Bottom (Hierarchy):
┌────┐ ● ● ┌────┐             ┌────┐
│ A  │─────│ B  │             │ A  │
└────┘     └────┘             └──●─┘
                                 │
                              ┌──●─┐
                              │ B  │
                              └────┘
```

## 🎮 Interactive Tutorial

**Try this sequence:**

1. **Create an edge** between two nodes
   ```
   ┌────┐         ┌────┐
   │ A  │─────────│ B  │
   └────┘         └────┘
   ```

2. **Hover and find midpoint**
   ```
   ┌────┐         ┌────┐
   │ A  │────⊕────│ B  │
   └────┘         └────┘
           ↑
      Double-click here!
   ```

3. **See new waypoint**
   ```
   ┌────┐         ┌────┐
   │ A  │────●────│ B  │
   └────┘         └────┘
   ```

4. **Drag it up**
   ```
   ┌────┐    ●    ┌────┐
   │ A  │─┐     ┐─│ B  │
   └────┘ └─────┘ └────┘
   ```

5. **Add more waypoints**
   ```
   ┌────┐    ●    ┌────┐
   │ A  │─●     ●─│ B  │
   └────┘         └────┘
   ```

6. **Remove if needed**
   ```
   ┌────┐    ●✕   ┌────┐
   │ A  │─┐     ┐─│ B  │
   └────┘ └─────┘ └────┘
           ↑
      Click X to remove
   ```

## ⚡ Quick Reference

```
ACTION              RESULT              UNDO
─────────────────────────────────────────────────
Double-click ⊕  →   Add waypoint ●  →   Click ✕
Click + drag ●  →   Move waypoint   →   Drag back
Click ✕         →   Remove ●        →   Re-add
```

## 🎯 Remember

✅ **Double-click** = Add waypoint  
✅ **Drag** = Move waypoint  
✅ **Click X** = Remove waypoint  
✅ **All angles stay 90°**  
✅ **Changes save automatically**  

**Now go create amazing diagrams! 🚀**
