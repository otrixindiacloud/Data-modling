# Drag & Drop Position Auto-Save Fix

## Problem
After dropping objects on the canvas via drag & drop, when users immediately moved the objects, the positions were not being auto-saved. The auto-save system was working for existing objects but not for newly dropped ones.

## Root Cause
When objects were dropped on the canvas, they were created in the database and added to the local React state. However, the critical `modelObjectId` (the `data_model_object.id` from the database) was not being captured from the server response and attached to the node's data.

Without the `modelObjectId`, when the position auto-save system tried to save the node's position, it couldn't properly identify which database record to update.

## Solution
Updated all drag & drop handlers to capture the `modelObjectId` from the server response and update the node's data before adding it to the state.

### Changes Made

#### 1. Regular Drag & Drop (onDrop handler)
**File**: `client/src/components/Canvas.tsx`

**Before**:
```typescript
.then((result) => {
  // Add to local state only after successful database operation
  setNodes((nds) => [...nds, newNode]);
  // ... rest of the code
})
```

**After**:
```typescript
.then((result) => {
  // Update node with modelObjectId from server response
  const nodeWithModelObjectId = {
    ...newNode,
    data: {
      ...newNode.data,
      modelObjectId: result?.id || result?.modelObjectId
    }
  };
  
  // Add to local state with updated modelObjectId
  setNodes((nds) => [...nds, nodeWithModelObjectId]);
  // ... rest of the code
})
```

#### 2. Touch Drop Handler
**File**: `client/src/components/Canvas.tsx`

**Before**:
```typescript
.then((result) => {
  // Invalidate canvas query to refresh data
  queryClient.invalidateQueries({ ... });
  // ... rest of the code (node not added to state)
})
```

**After**:
```typescript
.then((result) => {
  // Update node with modelObjectId from server response
  const nodeWithModelObjectId = {
    ...newNode,
    data: {
      ...newNode.data,
      modelObjectId: result?.id || result?.modelObjectId
    }
  };
  
  // Add to local state with updated modelObjectId for immediate interaction
  setNodes((nds) => [...nds, nodeWithModelObjectId]);
  
  // Invalidate canvas query to refresh data
  queryClient.invalidateQueries({ ... });
  // ... rest of the code
})
```

#### 3. Data Area Drag & Drop
**File**: `client/src/components/Canvas.tsx`

**Before**:
```typescript
Promise.all(nodesToAdd.map(async (node: any) => {
  return fetch(`/api/models/${targetModelId}/objects`, { ... });
}))
.then(responses => {
  // Check responses but don't extract modelObjectIds
  const failedRequests = responses.filter(response => !response.ok);
  // ... rest of the code
})
```

**After**:
```typescript
Promise.all(nodesToAdd.map(async (node: any) => {
  const response = await fetch(`/api/models/${targetModelId}/objects`, { ... });
  // Return both response and node for later processing
  return { response, nodeId: node.id };
}))
.then(async (results) => {
  // Check responses
  const failedRequests = results.filter(r => !r.response.ok);
  
  // Parse all responses to get modelObjectIds
  const parsedResults = await Promise.all(
    results.map(async (r) => ({
      nodeId: r.nodeId,
      data: await r.response.json()
    }))
  );
  
  // Update nodes with modelObjectIds from server
  setNodes((nds) => 
    nds.map((node) => {
      const result = parsedResults.find((r) => r.nodeId === node.id);
      if (result) {
        return {
          ...node,
          data: {
            ...node.data,
            modelObjectId: result.data?.id || result.data?.modelObjectId
          }
        };
      }
      return node;
    })
  );
  // ... rest of the code
})
```

#### 4. Touch Data Area Drop
Applied the same pattern as #3 above for touch-based data area drops.

## How It Works Now

### Flow After Drop:
1. **User drops object** on canvas
2. **Position is sent** to server: `POST /api/models/:id/objects` with position
3. **Server creates** `data_model_object` record and returns it with `id` field
4. **Client captures** the `modelObjectId` (the `id` from response)
5. **Node is updated** with `modelObjectId` before being added to state
6. **User moves object** immediately after drop
7. **Auto-save triggers** after 300ms
8. **Position save includes** both `objectId` AND `modelObjectId`
9. **Server updates** the correct record using `modelObjectId`

### Key Data Flow:
```
Drop → Server Creates Record → Returns { id: 123, objectId: 456, ... }
     → Client Updates Node: { data: { objectId: 456, modelObjectId: 123 } }
     → Node Added to State with Both IDs
     → User Moves Node
     → Auto-save Triggered
     → POST /api/models/:id/canvas/positions
        { modelObjectId: 123, objectId: 456, position: { x, y } }
     → Server Finds Record by modelObjectId OR objectId
     → Position Updated Successfully ✓
```

## Server Endpoint Reference

### Object Creation Endpoint
**POST** `/api/models/:modelId/objects`

**Request**:
```json
{
  "objectId": 456,
  "position": { "x": 100, "y": 200 },
  "targetSystem": null,
  "isVisible": true,
  "layerSpecificConfig": {
    "position": { "x": 100, "y": 200 },
    "layer": "conceptual"
  }
}
```

**Response**:
```json
{
  "id": 123,              // ← This is the modelObjectId we need!
  "objectId": 456,
  "modelId": 1,
  "position": { "x": 100, "y": 200 },
  "targetSystemId": null,
  "isVisible": true,
  "layerSpecificConfig": { ... }
}
```

### Position Save Endpoint
**POST** `/api/models/:modelId/canvas/positions`

**Request**:
```json
{
  "positions": [
    {
      "modelObjectId": 123,  // ← Used to identify record
      "objectId": 456,       // ← Fallback identifier
      "position": { "x": 150, "y": 250 }
    }
  ],
  "layer": "conceptual"
}
```

## Testing

### Test Case 1: Single Object Drop
1. ✅ Drag an object from sidebar to canvas
2. ✅ Drop it at position (100, 100)
3. ✅ Immediately move it to (200, 200)
4. ✅ Wait 300ms
5. ✅ Verify "Saving..." then "Saved" indicator appears
6. ✅ Refresh page and verify object is at (200, 200)

### Test Case 2: Data Area Drop
1. ✅ Drag entire data area to canvas (multiple objects)
2. ✅ Wait for all objects to be created
3. ✅ Immediately move one of the objects
4. ✅ Verify position auto-saves
5. ✅ Refresh and verify position persisted

### Test Case 3: Touch Drop
1. ✅ On touch device, add object via touch/tap
2. ✅ Immediately drag the object to new position
3. ✅ Verify auto-save works
4. ✅ Refresh and verify position persisted

### Test Case 4: Rapid Drops
1. ✅ Quickly drop multiple objects
2. ✅ Move each one immediately after drop
3. ✅ Verify all positions auto-save
4. ✅ Verify no race conditions or errors

## Benefits

1. **Immediate Interaction**: Users can now drop and immediately move objects without losing position data
2. **No Manual Save**: Positions are automatically saved after drops
3. **Consistent Behavior**: Newly dropped objects behave the same as existing objects
4. **Better UX**: No confusion about whether positions are saved after drops
5. **Data Integrity**: Every node has both `objectId` and `modelObjectId` for reliable identification

## Technical Notes

- The `modelObjectId` is the primary key of the `data_model_object` table
- The `objectId` is the foreign key to the `data_object` table
- Both IDs are needed because:
  - `modelObjectId` uniquely identifies the object within a specific model
  - `objectId` identifies the global data object definition
- The position save endpoint uses `modelObjectId` when available, falls back to `objectId`

## Related Files
- `client/src/components/Canvas.tsx` - Main canvas component with all drop handlers
- `server/routes.ts` - Server endpoints for object creation and position saving
- `docs/auto-save-improvements.md` - Previous auto-save enhancements

## Future Enhancements
1. Add optimistic position updates during drag
2. Implement position delta compression for efficiency
3. Add conflict resolution for concurrent position updates
4. Consider websocket for real-time position sync across users
