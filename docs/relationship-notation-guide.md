# Relationship Notation Examples

## Visual Guide to Crow's Foot Notation

This document shows how different relationship types are visually represented in the application.

## One-to-One (1:1) Relationship
```
┌─────────────┐              ┌─────────────┐
│   User      │  ║         ║  │  Profile    │
│             │════════════════│             │
│  • id       │              │  • id        │
│  • username │              │  • bio       │
└─────────────┘              └─────────────┘
```
**Notation**: Double perpendicular lines at both ends (║ ══ ║)
**Color**: Green (#10b981)
**Example**: One user has exactly one profile

## One-to-Many (1:N) Relationship
```
┌─────────────┐              ┌─────────────┐
│ Department  │  ║         ≺  │  Employee   │
│             │════════════════│             │
│  • id       │              │  • id        │
│  • name     │              │  • dept_id   │
└─────────────┘              └─────────────┘
```
**Notation**: Single line at source (║), crow's foot at target (≺)
**Color**: Blue (#3b82f6)
**Example**: One department has many employees

## Many-to-Many (N:M) Relationship
```
┌─────────────┐              ┌─────────────┐
│  Student    │  ≺         ≺  │  Course     │
│             │════════════════│             │
│  • id       │              │  • id        │
│  • name     │              │  • title     │
└─────────────┘              └─────────────┘
```
**Notation**: Crow's foot at both ends (≺ ══ ≺)
**Color**: Purple (#8b5cf6)
**Example**: Students enroll in multiple courses, courses have multiple students

## Attribute-Level Relationship
```
┌─────────────┐              ┌─────────────┐
│   Order     │              │  Customer   │
│             │  ║       ≺   │             │
│  • id       │──┼───────┼───│  • id       │
│  • cust_id  │  ⚡      ⚡   │  • name     │
│  • total    │              │  • email    │
└─────────────┘              └─────────────┘
```
**Notation**: Dashed line with ⚡ icon
**Color**: Same as relationship type, but with dashed line
**Example**: Order.cust_id references Customer.id

## Interactive Features

### 1. Edge Reconnection
```
Step 1: Select edge             Step 2: Drag handle            Step 3: Drop on new node
┌────┐      ┌────┐             ┌────┐      ┌────┐             ┌────┐      ┌────┐
│ A  │──────│ B  │             │ A  │  ╱───│ B  │             │ A  │      │ B  │
└────┘      └────┘             └────┘ ╱    └────┘             └────┘      └────┘
                                     ╱                            │
              ┌────┐                ╱        ┌────┐              │         ┌────┐
              │ C  │               ●         │ C  │              └─────────│ C  │
              └────┘                         └────┘                        └────┘
```

### 2. Hover Tooltip
```
┌─────────────┐              ┌─────────────┐
│ Department  │              │  Employee   │
│             │══════════════│             │
└─────────────┘              └─────────────┘
                   │
                   │  ┌────────────────────────────┐
                   └─→│ 🔗 Object Relationship     │
                      ├────────────────────────────┤
                      │ One-to-Many (1:N)          │
                      │ Each record in source can  │
                      │ relate to multiple records │
                      │ in target                  │
                      ├────────────────────────────┤
                      │ Tip: Double-click to edit  │
                      │ Drag handles to reconnect  │
                      └────────────────────────────┘
```

### 3. Badge Label
```
                    ┌─────┐
                    │ 1:N │  ← Compact badge showing relationship type
                    └─────┘
                      ↑
            Color-coded: Blue for 1:N
```

## Usage Instructions

### Creating a Relationship
1. Click the "Connection" mode button in toolbar
2. Click on source node's handle
3. Drag to target node's handle
4. Release to show relationship type selector
5. Choose relationship type (1:1, 1:N, or N:M)
6. Click "Confirm" to create relationship

### Editing a Relationship
1. Double-click on the relationship edge
2. Edit modal opens
3. Change relationship type
4. Add/edit name or description
5. Click "Update" to save changes

### Reconnecting a Relationship
1. Select the edge by clicking on it
2. Hover over source or target handle (circle endpoint)
3. When cursor changes to crosshair, click and drag
4. Drag to the new node's handle
5. Release to reconnect
6. Relationship updates automatically

### Deleting a Relationship
1. Double-click on the relationship edge
2. Click "Delete" button in the modal
3. Confirm deletion
   
   **OR**
   
1. Select the edge
2. Press Delete or Backspace key

## Best Practices

### Relationship Design
- ✅ Use 1:1 for unique associations (User ↔ Profile)
- ✅ Use 1:N for parent-child relationships (Department → Employees)
- ✅ Use N:M for many-to-many associations (Students ↔ Courses)
- ✅ Consider using junction tables for N:M relationships in physical layer

### Visual Organization
- 📐 Arrange related objects close together
- 🎨 Use auto-layout to organize complex diagrams
- 🔍 Zoom in for detailed relationship inspection
- 🧹 Keep canvas clean - hide unnecessary relationships using filters

### Naming Conventions
- 📝 Name relationships descriptively: "manages", "belongs_to", "enrolled_in"
- 📋 Document relationship constraints in description field
- 🏷️ Use consistent naming across layers

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Delete selected edge | `Delete` or `Backspace` |
| Toggle connection mode | `C` |
| Undo | `Ctrl+Z` / `Cmd+Z` |
| Redo | `Ctrl+Y` / `Cmd+Y` |
| Select all | `Ctrl+A` / `Cmd+A` |

## Common Patterns

### Parent-Child (1:N)
```
Category (1) → Products (N)
Department (1) → Employees (N)
Customer (1) → Orders (N)
```

### Lookup/Reference (1:1)
```
User (1) ↔ UserProfile (1)
Invoice (1) ↔ Payment (1)
Product (1) ↔ Inventory (1)
```

### Association (N:M)
```
Students (N) ↔ Courses (M)
Projects (N) ↔ Employees (M)
Tags (N) ↔ Articles (M)
```

## Troubleshooting

### Edge Not Visible
- ✓ Check if both nodes exist on canvas
- ✓ Verify layer filter settings
- ✓ Ensure relationship is created for current layer

### Cannot Reconnect Edge
- ✓ Make sure a model is selected
- ✓ Check that you're dragging from the handle (circle endpoint)
- ✓ Verify target node is valid for the relationship

### Tooltip Not Showing
- ✓ Hover directly over the edge path
- ✓ Wait a moment for tooltip to appear
- ✓ Check browser zoom level (100% recommended)

## Advanced Features

### Relationship Metadata
Store custom properties on relationships:
- Business rules
- Validation constraints
- Source system mappings
- Technical specifications

### Cross-Layer Relationships
Relationships automatically sync across layers:
- Conceptual: High-level object relationships
- Logical: Attribute-level foreign keys
- Physical: Database constraints and indexes

### Relationship History
All relationship changes are tracked:
- Creation timestamp
- Last modified date
- Change history in undo/redo timeline
- Audit trail for compliance
