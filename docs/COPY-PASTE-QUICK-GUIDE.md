# Copy-Paste Quick Reference Guide

## 🎯 Quick Start

### Copy Nodes
1. **Select** one or more nodes on the canvas
2. Press **`Ctrl+C`** (Windows/Linux) or **`Cmd+C`** (Mac)
3. See confirmation: "Nodes Copied - X node(s) copied to clipboard"

### Paste Nodes
1. Press **`Ctrl+V`** (Windows/Linux) or **`Cmd+V`** (Mac)
2. Nodes appear centered in your current view
3. See confirmation: "✓ Nodes Pasted Successfully - X node(s) pasted to [layer] layer"

## 🔄 Common Workflows

### Duplicate Nodes in Same Layer
```
Select nodes → Ctrl+C → Ctrl+V → Done!
```

### Copy Across Layers
```
1. Conceptual Layer: Select nodes → Ctrl+C
2. Switch to Logical Layer
3. Ctrl+V → Nodes now in both layers!
```

### Multiple Copies
```
Select nodes → Ctrl+C → Ctrl+V → Ctrl+V → Ctrl+V
(Each paste creates new instances)
```

## ⌨️ Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Copy | `Ctrl + C` | `Cmd + C` |
| Paste | `Ctrl + V` | `Cmd + V` |
| Undo | `Ctrl + Z` | `Cmd + Z` |
| Redo | `Ctrl + Y` | `Cmd + Y` |

## 💡 Tips & Tricks

### Selecting Multiple Nodes
- **Click & Drag**: Draw selection box around nodes
- **Shift + Click**: Add individual nodes to selection
- **Ctrl + A** / **Cmd + A**: Select all nodes (coming soon)

### Positioning
- Pasted nodes appear **centered** in your viewport
- Multiple nodes maintain their **relative positions**
- Small offset added to prevent overlap

### Best Practices
1. **Zoom to fit** before pasting large groups
2. **Pan to empty space** if you want specific placement
3. **Switch layers first** before pasting for cross-layer copies
4. **Check toast messages** for confirmation of success/failure

## ⚠️ Important Notes

- ✅ A data model **must be selected** before pasting
- ✅ Pasted nodes are **new instances** (not references)
- ✅ Each layer gets its own database entry
- ❌ Relationships are **not** copied (coming in future version)
- ❌ Can't paste without copying first (obvious, but worth noting!)

## 🐛 Troubleshooting

### "No Model Selected" Error
**Solution**: Select a data model from the top navigation bar before pasting

### Nodes Don't Appear
**Solution**: Check that you copied nodes first (press Ctrl+C after selecting)

### "Failed to Paste" Error
**Solution**: 
- Verify you're connected to the server
- Check the browser console for detailed error
- Try refreshing the page and trying again

### Nodes Overlap
**Solution**: This is by design for compact pasting. Simply drag nodes apart if needed.

## 📝 Examples

### Example 1: Creating Similar Objects
You have a "Customer" object with many attributes. You want to create a "Supplier" object with similar structure:
```
1. Select Customer node → Ctrl+C
2. Ctrl+V (creates copy)
3. Double-click new node
4. Rename to "Supplier"
5. Modify attributes as needed
```

### Example 2: Layer Propagation
You've designed objects in Conceptual layer. Now create them in Logical layer:
```
1. Conceptual layer: Select all objects → Ctrl+C
2. Switch to Logical layer
3. Ctrl+V
4. All objects now in Logical layer
5. Modify for logical model specifics
```

### Example 3: Building Patterns
Create a standard pattern and reuse it:
```
1. Design pattern (e.g., Audit fields: CreatedBy, CreatedDate, etc.)
2. Select pattern nodes → Ctrl+C
3. Navigate to other objects
4. Ctrl+V to add pattern
5. Repeat as needed
```

## 🔮 Coming Soon

Features planned for future releases:
- [ ] Copy relationships along with nodes
- [ ] Paste with preserved absolute positions
- [ ] Copy multiple selections
- [ ] Clipboard preview
- [ ] Cross-model copy-paste
- [ ] Paste special options

## 📚 More Information

- Full documentation: `/docs/copy-paste-nodes-feature.md`
- Implementation details: `/docs/COPY-PASTE-IMPLEMENTATION-SUMMARY.md`
- Ask for help: Use the in-app feedback button

---

**Version**: 1.0 | **Last Updated**: October 13, 2025
