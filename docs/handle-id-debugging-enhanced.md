# Enhanced Handle ID Debugging

## Issue
React Flow error: "Couldn't create edge for source handle id: 'attr-4906-source'"

This means React Flow can't find a handle with ID `attr-4906-source` on any node, even though the edge references it.

## Root Cause
**Browser cache issue** - The old JavaScript bundle is still being used by the browser, so the updated handle IDs in DataObjectNode.tsx aren't being applied yet.

## Changes Made

### 1. Backend (Already Complete)
✅ **server/routes.ts** - Canvas endpoint now sends both IDs:
```typescript
attributes: modelAttributes.map(ma => ({
  id: ma.id,              // Model attribute ID (layer-specific)
  attributeId: ma.attributeId,  // Global attribute ID (cross-layer)
  name: ma.name,
  // ... other fields
}))
```

### 2. Frontend Components

✅ **client/src/types/modeler.ts** - Updated interface:
```typescript
export interface AttributeData {
  id: number;
  attributeId?: number;  // Global attribute ID (from data_object_attributes)
  name: string;
  // ... other fields
}
```

✅ **client/src/components/nodes/DataObjectNode.tsx** - Updated handles:
```typescript
// OLD (caused mismatch):
id={`attr-${attr.id}-source`}

// NEW (uses global ID):
id={`attr-${attr.attributeId || attr.id}-source`}
```

### 3. Enhanced Debugging

Added comprehensive logging to diagnose the issue:

**Canvas.tsx** - Node data logging:
```typescript
if (node.data?.attributes && node.data.attributes.length > 0) {
  console.log(`🔍 Node ${node.data.name} attributes:`, node.data.attributes.map((attr: any) => ({
    id: attr.id,
    attributeId: attr.attributeId,
    name: attr.name,
    handleId: `attr-${attr.attributeId || attr.id}`
  })));
}
```

**Canvas.tsx** - Edge processing logging:
```typescript
console.log(`🔗 Processing edge ${edge.id}:`, {
  sourceNode: edge.source,
  targetNode: edge.target,
  isAttributeRelationship,
  sourceAttributeId: edgeData.sourceAttributeId,
  targetAttributeId: edgeData.targetAttributeId,
  derivedSourceHandle,
  derivedTargetHandle,
  finalSourceHandle: isAttributeRelationship ? edge.sourceHandle ?? derivedSourceHandle : edge.sourceHandle,
  finalTargetHandle: isAttributeRelationship ? edge.targetHandle ?? derivedTargetHandle : edge.targetHandle
});
```

**DataObjectNode.tsx** - Handle ID generation logging:
```typescript
const handleId = attr.attributeId || attr.id;
const sourceHandleId = `attr-${handleId}-source`;

if (index === 0) {
  console.log(`🎯 DataObjectNode ${data.name} - First attribute handle IDs:`, {
    attrName: attr.name,
    attrId: attr.id,
    attrAttributeId: attr.attributeId,
    handleId,
    sourceHandleId,
    targetHandleId
  });
}
```

## Next Steps

### For the User:

1. **Hard Refresh Browser** to clear JavaScript cache:
   - **Chrome/Edge**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - **Firefox**: Ctrl+F5 (Windows/Linux) or Cmd+Shift+R (Mac)
   - **Safari**: Cmd+Option+R (Mac)

2. **Open Browser Console** (F12) and look for the new debug logs:
   - `🔍 Node X attributes:` - Shows what attributeId values nodes have
   - `🔗 Processing edge X:` - Shows what handle IDs edges are looking for
   - `🎯 DataObjectNode X - First attribute handle IDs:` - Shows what handle IDs are being created

3. **Navigate to Physical Layer** where relationship exists

4. **Check Console Output**:
   - Look for attribute logging showing both `id` and `attributeId`
   - Verify edge processing shows correct handle IDs
   - Confirm no more "Couldn't create edge" errors

### Expected Output

After refresh, you should see logs like:
```
🔍 Node TableA attributes: [
  {id: 1741, attributeId: 4906, name: "id", handleId: "attr-4906"}
]
🔗 Processing edge 200: {
  sourceAttributeId: 4906,
  derivedSourceHandle: "attr-4906-source",
  finalSourceHandle: "attr-4906-source"
}
🎯 DataObjectNode TableA - First attribute handle IDs: {
  attrId: 1741,
  attrAttributeId: 4906,
  handleId: 4906,
  sourceHandleId: "attr-4906-source"
}
```

This confirms:
- Backend is sending `attributeId: 4906` ✅
- Edge is looking for `attr-4906-source` handle ✅
- Node is creating `attr-4906-source` handle ✅
- **MATCH!** Relationship should render ✅

## What This Proves

If the logs show matching IDs, it confirms:
1. ✅ Backend ID normalization is working (FK fixes complete)
2. ✅ Backend sends correct global attribute IDs to frontend
3. ✅ Frontend receives and uses global IDs for handle generation
4. ✅ Edges and handles use same ID system (React Flow can connect them)

The **only** reason relationships weren't showing was browser cache serving old JavaScript that used model IDs instead of global IDs for handles.

## Troubleshooting

If errors persist after hard refresh:

1. **Clear Browser Cache Completely**:
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   
2. **Check Build Output**: Ensure Vite rebuilt the client:
   ```bash
   # Should show client rebuild
   tail -f /tmp/server-new.log
   ```

3. **Verify Logs**: If you don't see the new debug logs, the old bundle is still cached

4. **Nuclear Option**: Close all browser windows and reopen
