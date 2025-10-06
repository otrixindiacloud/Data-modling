# Auto-Save Debugging Guide

## Problem
Position auto-save is not working after drag & drop operations on the canvas.

## Debugging Steps Added

### 1. Enhanced Logging Throughout the Flow

The code now includes comprehensive console logging at every step of the auto-save process:

#### A. When Nodes Change (`handleNodesChange`)
```
🔄 handleNodesChange called: { changesCount, changes, currentModelId, isDataLoading }
📍 Position changes detected: { count, changes }
```

**What to look for:**
- Is `handleNodesChange` being called when you move an object?
- Are position changes being detected (with `dragging: false`)?
- Is `currentModelId` set?

#### B. When Auto-Save Starts
```
💾 AUTO-SAVE: Starting position save process
⏱️ Clearing existing timeout (if applicable)
⏰ Timeout fired, starting save...
📦 Current nodes count: X
```

**What to look for:**
- Does auto-save start immediately after you release the dragged object?
- Is the timeout firing after 300ms?

#### C. Node Validation
```
⚠️ Invalid node filtered out: { id, name, hasIdentifier, modelObjectId, objectId, position }
✅ Valid nodes for save: X
❌ No valid nodes to save! (if none valid)
```

**What to look for:**
- Are nodes being filtered out as invalid?
- Do nodes have both `modelObjectId` and `objectId`?
- Are positions valid numbers?

#### D. Position Payload Creation
```
📍 Position payload for node: { nodeId, nodeName, payload }
🎯 Saving positions: { positionsCount, targetModelId, layer, positions }
❌ Cannot save - missing requirements: { positionsCount, targetModelId, layer } (if fail)
```

**What to look for:**
- Is the payload being created correctly?
- Does each payload have `modelObjectId` OR `objectId`?
- Is `targetModelId` set?

#### E. Mutation Execution
```
🚀 savePositionsMutation called: { positions, modelId, layer }
📡 Server response: { status, ok }
✅ Save successful: <result>
✨ onSuccess called
```

OR

```
❌ Save failed: <error>
💥 onError called: <error>
```

**What to look for:**
- Is the mutation being called?
- What's the server response status?
- Is save successful or failing?

#### F. Canvas Data Loading
```
📥 Loading canvas data: X nodes, Y edges
🔍 Node 0: { id, name, modelObjectId, objectId, position }
🔍 Node 1: ...
```

**What to look for:**
- Do loaded nodes have `modelObjectId` in their data?
- Are positions loaded correctly?

## Common Issues and Solutions

### Issue 1: `handleNodesChange` Not Called
**Symptom:** No logs appear when moving objects

**Possible Causes:**
- React Flow not properly connected
- Event handler not attached
- Browser console filtering logs

**Solution:**
1. Check browser console filters (ensure "Verbose" or "Info" logs are visible)
2. Verify `onNodesChange={handleNodesChange}` in ReactFlow component
3. Try moving different objects

### Issue 2: No Position Changes Detected
**Symptom:** `📍 Position changes detected: { count: 0 }`

**Possible Causes:**
- Changes have `dragging: true` (still dragging)
- Changes don't have `type: 'position'`
- Objects are being selected, not moved

**Solution:**
1. Ensure you **release** the drag (don't keep holding)
2. Try dragging longer distances
3. Check change types in the detailed logs

### Issue 3: Nodes Filtered Out as Invalid
**Symptom:** `⚠️ Invalid node filtered out` warnings

**Possible Causes:**
- Missing `modelObjectId` in node data
- Missing `objectId` in node data
- Invalid position values (NaN, undefined)

**Solution:**
1. Check the invalid node details in the warning
2. Verify nodes were created with `modelObjectId` from server
3. Check if drop handlers are capturing `modelObjectId` from response

### Issue 4: No Valid Nodes to Save
**Symptom:** `❌ No valid nodes to save!`

**Possible Causes:**
- All nodes missing identifiers
- All nodes at position (0, 0)
- Nodes not properly initialized

**Solution:**
1. Check canvas data loading logs
2. Verify server returns `modelObjectId` in node data
3. Check drop handler updates nodes with `modelObjectId`

### Issue 5: Mutation Not Called
**Symptom:** No `🚀 savePositionsMutation called` log

**Possible Causes:**
- `targetModelId` is undefined
- `positions` array is empty
- Guard condition preventing call

**Solution:**
1. Check `🎯 Saving positions` log for details
2. Verify `currentModel` or `currentLayerModel` is set
3. Ensure user selected a model before adding objects

### Issue 6: Server Error
**Symptom:** `❌ Save failed` or `💥 onError called`

**Possible Causes:**
- Invalid position data
- Model object not found in database
- Server-side validation failure

**Solution:**
1. Check server logs for details
2. Verify `modelObjectId` matches database records
3. Ensure position values are valid numbers

## Testing Checklist

### Basic Position Save Test
1. ✅ Open browser console (F12)
2. ✅ Select a model from dropdown
3. ✅ Drag an object from sidebar to canvas
4. ✅ Check logs: Does node have `modelObjectId`?
5. ✅ Move the object to a new position
6. ✅ Release drag (stop holding mouse/touch)
7. ✅ Watch for logs:
   - `🔄 handleNodesChange called`
   - `📍 Position changes detected: { count: 1 }`
   - `💾 AUTO-SAVE: Starting position save process`
   - `⏰ Timeout fired, starting save...`
   - `🚀 savePositionsMutation called`
   - `✅ Save successful`
   - `✨ onSuccess called`
8. ✅ Verify save status shows "Saved" (green)
9. ✅ Refresh page
10. ✅ Check if object is at new position

### After Drop Position Save Test
1. ✅ Drag new object from sidebar
2. ✅ Drop on canvas
3. ✅ **Immediately** drag to different position
4. ✅ Release drag
5. ✅ Watch for save logs (same as above)
6. ✅ Should see "Saving..." → "Saved"

### Multiple Objects Test
1. ✅ Add multiple objects to canvas
2. ✅ Move one object
3. ✅ Verify only that object's position is saved
4. ✅ Move another object
5. ✅ Verify save works for each

### Rapid Movement Test
1. ✅ Move object to position A
2. ✅ Immediately move to position B
3. ✅ Immediately move to position C
4. ✅ Verify debouncing: Only final position saved
5. ✅ Check for "⏱️ Clearing existing timeout" logs

## Expected Console Output (Success Case)

```
📥 Loading canvas data: 3 nodes, 2 edges
🔍 Node 0: { id: "1", name: "Customer", modelObjectId: 123, objectId: 1, position: {x: 100, y: 100} }
🔍 Node 1: { id: "2", name: "Order", modelObjectId: 124, objectId: 2, position: {x: 300, y: 100} }
🔍 Node 2: { id: "3", name: "Product", modelObjectId: 125, objectId: 3, position: {x: 500, y: 100} }

[User moves "Customer" object]

🔄 handleNodesChange called: { changesCount: 1, changes: [{ type: "position", id: "1", dragging: false, hasPosition: true }], currentModelId: 1, isDataLoading: false }
📍 Position changes detected: { count: 1, changes: [{ id: "1", position: {x: 150, y: 150} }] }
💾 AUTO-SAVE: Starting position save process
⏰ Timeout fired, starting save...
📦 Current nodes count: 3
✅ Valid nodes for save: 3
📍 Position payload for node: { nodeId: "1", nodeName: "Customer", payload: { modelObjectId: 123, objectId: 1, position: {x: 150, y: 150} } }
📍 Position payload for node: { nodeId: "2", nodeName: "Order", payload: { modelObjectId: 124, objectId: 2, position: {x: 300, y: 100} } }
📍 Position payload for node: { nodeId: "3", nodeName: "Product", payload: { modelObjectId: 125, objectId: 3, position: {x: 500, y: 100} } }
🎯 Saving positions: { positionsCount: 3, targetModelId: 1, layer: "conceptual", positions: [...] }
🚀 savePositionsMutation called: { positions: [...], modelId: 1, layer: "conceptual" }
📡 Server response: { status: 200, ok: true }
✅ Save successful: { success: true, updated: 3 }
✨ onSuccess called
```

## How to Remove Debug Logs (After Fixing)

Once you've identified and fixed the issue, you can remove the debug logs by:

1. Search for `console.log` in `Canvas.tsx`
2. Remove or comment out the debug logs
3. Keep only essential error logs (`console.error`, `console.warn`)

Or keep them for future debugging by wrapping in a debug flag:

```typescript
const DEBUG_AUTOSAVE = false; // Set to true to enable debug logs

if (DEBUG_AUTOSAVE) {
  console.log('🔄 handleNodesChange called:', ...);
}
```

## Additional Troubleshooting

### Check Browser Network Tab
1. Open DevTools → Network tab
2. Filter for "positions"
3. Move an object
4. Look for POST request to `/api/models/:id/canvas/positions`
5. Check request payload and response

### Check Server Logs
1. Look at terminal where server is running
2. Should see position save requests
3. Check for any server-side errors

### Verify Database
1. Check `data_model_objects` table
2. Verify `position` and `layerSpecificConfig` columns
3. Ensure records exist for your objects

## Still Not Working?

If after following all steps above it's still not working, collect:

1. Full console output (copy/paste)
2. Network tab screenshot showing request/response
3. Server logs
4. Node data structure from `🔍 Node` logs
5. Any error messages

This will help identify the exact point of failure.
