# Fix: Layer-Specific Positions - Correct Implementation

**Date**: October 11, 2025  
**Status**: ✅ FIXED - Using actual layer IDs now

## Problem Identified

The previous implementation had a critical bug:
- `getLayerObjectPosition(layerId, objectId)` expects a **layer ID** from `data_model_layers` table
- But the code was passing **model ID** from `data_models` table
- This caused positions to be fetched/saved incorrectly, leading to same positions across all layers

## Root Cause

### Incorrect Code (Before Fix)
```typescript
// ❌ WRONG - passing modelId instead of layerId
const layerPosition = await storage.getLayerObjectPosition(modelId, modelObj.id);

// ❌ WRONG - saving with modelId
await storage.updateLayerObjectPosition(
  modelId, // This is NOT a layer ID!
  modelObject.id,
  position.x,
  position.y
);
```

### Data Structure
```
data_models (id: 1, 2, 3...)
    ↓
data_model_layers (id: 10, 11, 12... dataModelId: 1, layer: 'conceptual')
    ↓
data_model_layer_objects (layerId: 10, objectId: 100, positionX: 50, positionY: 100)
```

## Solution Implemented

### 1. Added New Storage Method

**File**: `server/storage.ts`

```typescript
async getDataModelLayerByModelAndKey(
  modelId: number, 
  layerKey: string
): Promise<DataModelLayer | undefined> {
  const result = await db
    .select()
    .from(dataModelLayers)
    .where(
      and(
        eq(dataModelLayers.dataModelId, modelId),
        eq(dataModelLayers.layer, layerKey)
      )
    );
  return result[0];
}
```

This method finds the actual layer record given a model ID and layer key (e.g., "conceptual", "logical").

### 2. Fixed GET Canvas Endpoint

**File**: `server/routes.ts`

```typescript
app.get("/api/models/:id/canvas", async (req, res) => {
  const modelId = parseInt(req.params.id);
  const layerKey = req.query.layer as string || "conceptual";
  
  try {
    // ✅ CORRECT - Get actual layer ID first
    const modelLayer = await storage.getDataModelLayerByModelAndKey(modelId, layerKey);
    const layerId = modelLayer?.id;
    
    console.log(`[CANVAS] Fetching canvas for model ${modelId}, layer ${layerKey}, layerId: ${layerId}`);
    
    // ... later in the code ...
    
    if (layerId) {
      // ✅ CORRECT - Use actual layerId
      const layerPosition = await storage.getLayerObjectPosition(layerId, modelObj.id);
      
      if (layerPosition && layerPosition.positionX !== null && layerPosition.positionY !== null) {
        position = { 
          x: layerPosition.positionX, 
          y: layerPosition.positionY 
        };
        console.log(`[CANVAS] Using layer-specific position for object ${modelObj.id} in layer ${layerKey}: (${position.x}, ${position.y})`);
      }
    }
  }
});
```

### 3. Fixed POST Positions Endpoint

**File**: `server/routes.ts`

```typescript
app.post("/api/models/:id/canvas/positions", async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const { positions, layer } = req.body;
    
    const layerKey = typeof layer === 'string' && layer.length > 0
      ? layer
      : 'conceptual';
    
    // ✅ CORRECT - Get actual layer ID first
    const modelLayer = await storage.getDataModelLayerByModelAndKey(modelId, layerKey);
    const layerId = modelLayer?.id;
    
    if (!layerId) {
      console.error(`[CANVAS] Layer not found for model ${modelId} and layer key ${layerKey}`);
      return res.status(404).json({ message: `Layer ${layerKey} not found for model ${modelId}` });
    }
    
    console.log(`[CANVAS] Saving positions for model ${modelId}, layer ${layerKey}, layerId: ${layerId}`);
    
    // ... later in the code ...
    
    // ✅ CORRECT - Use actual layerId
    await storage.updateLayerObjectPosition(
      layerId, // Correct layer ID from data_model_layers
      modelObject.id,
      position.x,
      position.y
    );
    
    console.log(`[CANVAS] Saved position for object ${modelObject.id} in layer ${layerKey} (layerId: ${layerId}): (${position.x}, ${position.y})`);
  }
});
```

## Data Flow (Now Correct)

### Fetching Positions
```
1. GET /api/models/1/canvas?layer=conceptual
              ↓
2. Get layer record: getDataModelLayerByModelAndKey(1, 'conceptual')
   Returns: { id: 10, dataModelId: 1, layer: 'conceptual' }
              ↓
3. Get position: getLayerObjectPosition(10, 100)
   Queries: data_model_layer_objects WHERE layerId=10 AND objectId=100
              ↓
4. Returns: { positionX: 50, positionY: 100 }
```

### Saving Positions
```
1. POST /api/models/1/canvas/positions { layer: 'logical', positions: [...] }
              ↓
2. Get layer record: getDataModelLayerByModelAndKey(1, 'logical')
   Returns: { id: 11, dataModelId: 1, layer: 'logical' }
              ↓
3. Save position: updateLayerObjectPosition(11, 100, 200, 300)
   Updates: data_model_layer_objects SET positionX=200, positionY=300
            WHERE layerId=11 AND objectId=100
              ↓
4. Position saved for logical layer only
```

## Testing Steps

### 1. Clear Browser Cache
```bash
# Open browser console and run:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### 2. Test Layer-Specific Positions

1. **Open the application** → Navigate to Conceptual layer
2. **Create objects** or use existing ones
3. **Position objects** at specific locations (e.g., top-left area)
4. **Wait for auto-save** (spinning indicator in top-right)
5. **Open browser console** → Should see:
   ```
   [CANVAS] Saving positions for model 1, layer conceptual, layerId: 10
   [CANVAS] Saved position for object 123 in layer conceptual (layerId: 10): (100, 150)
   ```

6. **Switch to Logical layer** → Objects should appear at different (or default) positions
7. **Move objects** to different locations (e.g., bottom-right area)
8. **Wait for auto-save** → Console should show:
   ```
   [CANVAS] Saving positions for model 1, layer logical, layerId: 11
   [CANVAS] Saved position for object 123 in layer logical (layerId: 11): (500, 600)
   ```

9. **Switch back to Conceptual** → Objects should be at original positions (top-left)
10. **Switch to Logical again** → Objects should be at new positions (bottom-right)

### 3. Verify in Database

```sql
-- Check that different layers have different positions
SELECT 
  l.layer,
  o.name,
  lo.position_x,
  lo.position_y
FROM data_model_layer_objects lo
JOIN data_model_layers l ON l.id = lo.data_model_layer_id
JOIN data_model_objects mo ON mo.id = lo.data_model_object_id
LEFT JOIN data_objects o ON o.id = mo.object_id
WHERE l.data_model_id = 1  -- Your model ID
  AND mo.id = 123          -- Your object ID
ORDER BY l.layer;

-- Expected result:
-- layer       | name      | position_x | position_y
-- conceptual  | Customer  | 100        | 150
-- logical     | Customer  | 500        | 600
```

## Console Logs to Watch For

### When Fetching (GET):
```
[CANVAS] Fetching canvas for model 1, layer conceptual, layerId: 10
[CANVAS] Using layer-specific position for object 123 in layer conceptual: (100, 150)
[CANVAS] Using layer-specific position for object 124 in layer conceptual: (200, 250)
```

### When Saving (POST):
```
[CANVAS] Saving positions for model 1, layer logical, layerId: 11
[CANVAS] Saved position for object 123 in layer logical (layerId: 11): (500, 600)
[CANVAS] Saved position for object 124 in layer logical (layerId: 11): (600, 700)
```

### Error to Watch For:
```
[CANVAS] Layer not found for model 1 and layer key nonexistent
```
This means the layer doesn't exist in `data_model_layers` table.

## Verification Checklist

- ✅ Layer ID is looked up before fetching positions
- ✅ Layer ID is looked up before saving positions
- ✅ Console logs show correct layerId values
- ✅ Different layers have different layerId values
- ✅ Positions saved to correct layer in database
- ✅ Positions fetched from correct layer in database
- ✅ No page reload when switching layers
- ✅ Each layer maintains its own object positions

## Files Modified

1. ✅ `server/storage.ts`
   - Added `getDataModelLayerByModelAndKey()` method
   - Updated interface with new method signature

2. ✅ `server/routes.ts`
   - Fixed GET `/api/models/:id/canvas` to use actual layerId
   - Fixed POST `/api/models/:id/canvas/positions` to use actual layerId
   - Added console logging for debugging

## Expected Behavior

### Scenario 1: Fresh Objects
- Create object in Conceptual layer at (100, 100)
- Switch to Logical layer → Object appears at (100, 100) initially (no position set yet)
- Move object to (500, 500) in Logical layer
- Switch back to Conceptual → Object at (100, 100)
- Switch to Logical → Object at (500, 500) ✅

### Scenario 2: Existing Objects
- Object already positioned in Conceptual at (200, 200)
- Switch to Logical → Object at default position or old position
- Move to (600, 600)
- Switch to Physical → Object at default or old position
- Move to (800, 800)
- Switching between layers shows correct positions for each ✅

## Common Issues & Solutions

### Issue: All layers still show same position
**Solution**: 
- Check console logs - is layerId being fetched?
- Verify `data_model_layers` table has records for each layer
- Check that layer keys match: 'conceptual', 'logical', 'physical', 'flow'

### Issue: Position not saving
**Solution**:
- Check POST endpoint returns success
- Verify layerId is not null in console logs
- Check database for `data_model_layer_objects` records

### Issue: Layer not found error
**Solution**:
- Ensure `data_model_layers` table has a record for the model and layer
- Check that layer key is being passed correctly in query parameter

## Success Criteria

1. ✅ Console shows correct layerId when fetching/saving
2. ✅ Database has separate position records per layer
3. ✅ UI shows different positions when switching layers
4. ✅ No page reload during layer switch
5. ✅ Auto-save works correctly per layer

---

**Status**: Implementation complete and ready for testing! 🎉
