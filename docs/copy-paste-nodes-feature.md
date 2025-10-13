# Copy-Paste Nodes Feature

## Overview
The copy-paste functionality allows users to duplicate object nodes within the same layer or across different layers (Conceptual, Logical, Physical) in the data modeling canvas.

## Features

### 1. Copy Nodes (Ctrl+C / Cmd+C)
- **Action**: Select one or more nodes on the canvas and press `Ctrl+C` (Windows/Linux) or `Cmd+C` (Mac)
- **Behavior**: 
  - Copies all selected nodes to the clipboard
  - Preserves node data including:
    - Object name
    - Domain and data area information
    - Attributes
    - Source and target systems
    - Custom styling
  - Shows a toast notification with the count of copied nodes

### 2. Paste Nodes (Ctrl+V / Cmd+V)
- **Action**: Press `Ctrl+V` (Windows/Linux) or `Cmd+V` (Mac) to paste copied nodes
- **Behavior**:
  - Creates new node instances with unique IDs
  - Positions nodes centered in the current viewport
  - Applies small offset to each pasted node to avoid overlap
  - Automatically saves nodes to the database
  - Creates new `data_model_object` entries for the current layer
  - Shows success/failure toast notification
  - Supports cross-layer pasting (copy from Conceptual, paste to Logical)

## Usage Examples

### Example 1: Duplicate Nodes in Same Layer
1. Select one or more nodes in the Conceptual layer
2. Press `Ctrl+C` to copy
3. Press `Ctrl+V` to paste
4. Nodes appear in the center of your current view

### Example 2: Copy Nodes Across Layers
1. In the Conceptual layer, select nodes to copy
2. Press `Ctrl+C` to copy
3. Switch to the Logical layer using the layer navigator
4. Press `Ctrl+V` to paste
5. Copied nodes now exist in both layers as separate instances

## Implementation Details

### State Management
- **Store**: `modelerStore.ts`
  - `copiedNodes`: Array storing copied node data
  - `copyNodes(nodeIds)`: Copies specified nodes to clipboard
  - `getCopiedNodes()`: Retrieves copied nodes from clipboard
  - `clearCopiedNodes()`: Clears the clipboard

### Canvas Component
- **Keyboard Shortcuts**: Enhanced keyboard handler in `Canvas.tsx`
  - Copy: `(Ctrl/Cmd) + C`
  - Paste: `(Ctrl/Cmd) + V`
- **Paste Handler**: `handlePasteNodes(copiedNodes)`
  - Calculates viewport center for paste position
  - Generates new unique node IDs
  - Offsets positions to prevent overlapping
  - Saves to database with layer-specific configuration
  - Updates nodes with `modelObjectId` from server

### API Integration
- **Endpoint**: `POST /api/models/:modelId/canvas/add-object`
- **Payload**:
  ```json
  {
    "objectId": number,
    "layerSpecificConfig": {
      "position": { "x": number, "y": number },
      "layer": "conceptual" | "logical" | "physical"
    }
  }
  ```

## Keyboard Shortcuts Summary

| Action | Shortcut (Windows/Linux) | Shortcut (Mac) |
|--------|-------------------------|----------------|
| Copy selected nodes | `Ctrl + C` | `Cmd + C` |
| Paste copied nodes | `Ctrl + V` | `Cmd + V` |
| Undo | `Ctrl + Z` | `Cmd + Z` |
| Redo | `Ctrl + Y` or `Ctrl + Shift + Z` | `Cmd + Y` or `Cmd + Shift + Z` |

## Visual Feedback

### Copy Operation
- Toast notification: "Nodes Copied - X node(s) copied to clipboard"

### Paste Operation (Success)
- Toast notification: "✓ Nodes Pasted Successfully - X node(s) pasted to [layer] layer"

### Paste Operation (Failure)
- Toast notification: "Failed to Paste Nodes - Could not save pasted nodes to the database"
- Pasted nodes are automatically removed from canvas on failure

## Limitations & Notes

1. **Model Selection Required**: You must have a data model selected before pasting
2. **Layer Context**: Pasted nodes are saved to the currently active layer
3. **New Database Entries**: Pasting creates new `data_model_object` entries (not references)
4. **Selection State**: Pasted nodes are not automatically selected
5. **Position Calculation**: Nodes are pasted centered on the current viewport with slight offsets

## Future Enhancements

Potential improvements for future versions:
- Copy-paste with relationship preservation
- Copy multiple selections with relative positioning
- Paste with original positions (not centered)
- Cross-model copy-paste
- Clipboard preview/history
- Copy-paste of edges/relationships
- Paste special (attributes only, structure only, etc.)

## Testing Guide

### Test Case 1: Single Node Copy-Paste
1. Add a node to the canvas
2. Select it and press `Ctrl+C`
3. Verify copy notification appears
4. Press `Ctrl+V`
5. Verify new node appears centered in viewport
6. Verify paste success notification appears

### Test Case 2: Multiple Node Copy-Paste
1. Add multiple nodes to the canvas
2. Select all nodes (click and drag or Shift+Click)
3. Press `Ctrl+C`
4. Verify notification shows correct count
5. Press `Ctrl+V`
6. Verify all nodes are pasted with proper spacing

### Test Case 3: Cross-Layer Copy-Paste
1. In Conceptual layer, select and copy nodes
2. Switch to Logical layer
3. Paste nodes
4. Verify nodes appear in Logical layer
5. Verify original nodes still exist in Conceptual layer
6. Verify both have unique database IDs

### Test Case 4: Error Handling
1. Try pasting without a model selected
2. Verify appropriate error message
3. Try pasting without copying first
4. Verify no action occurs

## Code References

- **Store**: `/client/src/store/modelerStore.ts` (lines 139-145, 461-474)
- **Canvas Component**: `/client/src/components/Canvas.tsx`
  - Keyboard handler: Lines ~1390-1430
  - Paste handler: Lines ~920-1055
- **Types**: `/client/src/types/modeler.ts` (CanvasNode interface)

## Version History

- **v1.0** (2025-10-13): Initial implementation with basic copy-paste functionality
