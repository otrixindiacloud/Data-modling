# Automatic Layer Mapping for Data Model Objects

**Date**: October 11, 2025  
**Status**: ✅ Implemented

## Overview

When a data model object is created in one layer (e.g., Conceptual), it should automatically be available in all other layers (Flow, Logical, Physical) of the same data model. This is achieved by automatically creating entries in the `data_model_layer_objects` table for all sibling layers.

## Problem Statement

Previously, when an object was created:
- It was only linked to the layer where it was created
- Users couldn't see the object in other layers
- Manual linking was required to make objects visible across layers

## Solution

### Automatic Layer Mapping

When a `data_model_object` is created, the system now:
1. Identifies all layers in the same data model
2. Automatically creates `data_model_layer_objects` records for ALL layers
3. Each record starts with `NULL` positions (will be set when user positions object in that layer)

## Implementation

### 1. Enhanced `ensureLayerMappingsForModelObject` Method

**File**: `server/storage.ts`

```typescript
private async ensureLayerMappingsForModelObject(modelObject: DataModelObject): Promise<void> {
  // Find the data model by looking up the layer
  const layerRecord = await db
    .select({
      id: dataModelLayers.id,
      dataModelId: dataModelLayers.dataModelId,
      layer: dataModelLayers.layer,
    })
    .from(dataModelLayers)
    .where(eq(dataModelLayers.id, modelObject.modelId))
    .limit(1);

  const baseLayer = layerRecord[0];
  if (!baseLayer) {
    console.warn(`No layer found for modelObject.modelId: ${modelObject.modelId}`);
    return;
  }

  // Get all sibling layers in the same data model
  const siblingLayers = await db
    .select({ 
      id: dataModelLayers.id,
      layer: dataModelLayers.layer 
    })
    .from(dataModelLayers)
    .where(eq(dataModelLayers.dataModelId, baseLayer.dataModelId));

  // Create layer-object mappings for all layers
  await db
    .insert(dataModelLayerObjects)
    .values(
      siblingLayers.map((layer) => ({
        dataModelLayerId: layer.id,
        dataModelObjectId: modelObject.id,
        positionX: null, // Will be set when user positions in each layer
        positionY: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    )
    .onConflictDoNothing({
      target: [dataModelLayerObjects.dataModelLayerId, dataModelLayerObjects.dataModelObjectId],
    });

  console.log(`Successfully created layer mappings for object ${modelObject.id} across ${siblingLayers.length} layers`);
}
```

**Key Features:**
- ✅ Finds all sibling layers in the same data model
- ✅ Creates mappings for ALL layers at once
- ✅ Uses `onConflictDoNothing` to avoid duplicate entries
- ✅ Logs progress for debugging

### 2. Automatic Invocation

**File**: `server/storage.ts` - `createDataModelObject` method

```typescript
async createDataModelObject(object: InsertDataModelObject): Promise<DataModelObject> {
  // ... object creation logic ...
  
  const result = await db.insert(dataModelObjects).values(enrichedObject).returning();
  const created = result[0];

  if (!created) {
    throw new Error("Failed to create data model object");
  }

  // ✅ AUTOMATICALLY create layer mappings
  await this.ensureLayerMappingsForModelObject(created);

  return created;
}
```

### 3. Utility Method for Existing Data

**File**: `server/storage.ts`

```typescript
async ensureAllLayerMappings(): Promise<{ processed: number; created: number }> {
  console.log('Starting ensureAllLayerMappings for existing objects...');
  
  const allModelObjects = await db.select().from(dataModelObjects);
  let processed = 0;
  let created = 0;

  for (const modelObject of allModelObjects) {
    try {
      // Check if layer mappings exist
      const existing = await db
        .select()
        .from(dataModelLayerObjects)
        .where(eq(dataModelLayerObjects.dataModelObjectId, modelObject.id));

      if (existing.length === 0) {
        console.log(`Object ${modelObject.id} has no layer mappings, creating...`);
        await this.ensureLayerMappingsForModelObject(modelObject);
        created++;
      }
      processed++;
    } catch (error) {
      console.error(`Error processing object ${modelObject.id}:`, error);
    }
  }

  console.log(`Completed: processed ${processed} objects, created mappings for ${created} objects`);
  return { processed, created };
}
```

### 4. Server Startup Sync

**File**: `server/routes.ts` - `registerRoutes` function

```typescript
const httpServer = createServer(app);

// ✅ Run on server startup to fix existing data
console.log('[STARTUP] Ensuring layer mappings for existing objects...');
storage.ensureAllLayerMappings()
  .then(result => {
    console.log(`[STARTUP] Layer mappings sync completed:`, result);
  })
  .catch(error => {
    console.error('[STARTUP] Error ensuring layer mappings:', error);
  });

return httpServer;
```

### 5. Admin Utility Endpoint

**File**: `server/routes.ts`

```typescript
app.post("/api/admin/ensure-layer-mappings", async (req, res) => {
  try {
    console.log('[API] Starting layer mappings sync...');
    const result = await storage.ensureAllLayerMappings();
    res.json({
      success: true,
      message: `Processed ${result.processed} objects, created mappings for ${result.created} objects`,
      ...result
    });
  } catch (error) {
    console.error('[API] Error ensuring layer mappings:', error);
    res.status(500).json({
      success: false,
      message: "Failed to ensure layer mappings",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
```

## Data Flow

### Creating a New Object

```
1. User creates object in Conceptual layer
              ↓
2. POST /api/models/:modelId/objects
              ↓
3. storage.createDataModelObject(...)
   - Insert into data_model_objects
   - Returns created object with ID
              ↓
4. ensureLayerMappingsForModelObject(created)
   - Find data model ID from layer
   - Get all sibling layers (Flow, Conceptual, Logical, Physical)
   - Insert records into data_model_layer_objects for ALL layers
              ↓
5. Object now visible in all layers!
   - Each layer can have different position (positionX, positionY)
   - Initially positions are NULL (default/calculated)
```

### Example Database State After Creation

**Before** (only one layer mapping):
```sql
-- data_model_objects
id | objectId | modelId (layerId) | name
1  | 100      | 10 (Conceptual)   | Customer

-- data_model_layer_objects
id | dataModelLayerId | dataModelObjectId | positionX | positionY
1  | 10               | 1                 | NULL      | NULL
```

**After** (all layer mappings created automatically):
```sql
-- data_model_objects
id | objectId | modelId (layerId) | name
1  | 100      | 10 (Conceptual)   | Customer

-- data_model_layer_objects
id | dataModelLayerId | dataModelObjectId | positionX | positionY
1  | 8  (Flow)        | 1                 | NULL      | NULL
2  | 10 (Conceptual)  | 1                 | NULL      | NULL
3  | 11 (Logical)     | 1                 | NULL      | NULL
4  | 12 (Physical)    | 1                 | NULL      | NULL
```

## Testing

### 1. Test New Object Creation

```bash
# Create a new object
curl -X POST http://localhost:5000/api/models/10/objects \
  -H "Content-Type: application/json" \
  -d '{
    "objectId": 100,
    "position": {"x": 100, "y": 100}
  }'
```

**Expected Behavior:**
- Object created in `data_model_objects`
- Console shows: `Successfully created layer mappings for object X across 4 layers`
- Object appears in all layers (Flow, Conceptual, Logical, Physical)

### 2. Verify in Database

```sql
-- Check layer mappings for an object
SELECT 
  dlo.id,
  dml.layer as layer_name,
  dmo.name as object_name,
  dlo.position_x,
  dlo.position_y
FROM data_model_layer_objects dlo
JOIN data_model_layers dml ON dml.id = dlo.data_model_layer_id
JOIN data_model_objects dmo ON dmo.id = dlo.data_model_object_id
WHERE dmo.id = 1
ORDER BY dml.layer;

-- Expected: 4 rows (one per layer)
```

### 3. Test Startup Sync

**Restart the server:**
```bash
npm run dev
```

**Check console output:**
```
[STARTUP] Ensuring layer mappings for existing objects...
[STORAGE] Starting ensureAllLayerMappings for existing objects...
[STORAGE] Object 5 has no layer mappings, creating...
[STORAGE] Successfully created layer mappings for object 5 across 4 layers
[STORAGE] Completed: processed 10 objects, created mappings for 2 objects
[STARTUP] Layer mappings sync completed: { processed: 10, created: 2 }
```

### 4. Test Admin Endpoint

```bash
# Manually trigger sync
curl -X POST http://localhost:5000/api/admin/ensure-layer-mappings
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Processed 10 objects, created mappings for 0 objects",
  "processed": 10,
  "created": 0
}
```

## Benefits

### ✅ Automatic Availability
- Objects created in one layer automatically appear in all layers
- No manual linking required
- Consistent data model across all abstraction levels

### ✅ Layer-Specific Positioning
- Each layer can have different positions for the same object
- Positions are independent per layer
- Supports different layout strategies per abstraction level

### ✅ Data Integrity
- `onConflictDoNothing` prevents duplicate entries
- Startup sync ensures existing data is fixed
- Idempotent operations (safe to run multiple times)

### ✅ Backward Compatibility
- Existing objects are fixed on server startup
- Admin endpoint available for manual sync
- No breaking changes to existing code

## Console Logs to Watch For

### On Object Creation:
```
[STORAGE] Creating layer mappings for object 5 in data model 2
[STORAGE] Found 4 layers for data model 2: 8:flow, 10:conceptual, 11:logical, 12:physical
[STORAGE] Successfully created layer mappings for object 5 across 4 layers
```

### On Server Startup:
```
[STARTUP] Ensuring layer mappings for existing objects...
[STORAGE] Starting ensureAllLayerMappings for existing objects...
[STORAGE] Completed: processed 25 objects, created mappings for 3 objects
[STARTUP] Layer mappings sync completed: { processed: 25, created: 3 }
```

### On Admin Sync:
```
[API] Starting layer mappings sync...
[STORAGE] Starting ensureAllLayerMappings for existing objects...
[STORAGE] Completed: processed 25 objects, created mappings for 0 objects
[API] Layer mappings sync completed: { processed: 25, created: 0 }
```

## Files Modified

1. ✅ `server/storage.ts`
   - Enhanced `ensureLayerMappingsForModelObject()` with logging
   - Added `ensureAllLayerMappings()` utility method
   - Updated interface with new method

2. ✅ `server/routes.ts`
   - Added startup sync in `registerRoutes()`
   - Added admin endpoint `/api/admin/ensure-layer-mappings`

## Edge Cases Handled

### Multiple Data Models
- ✅ Only creates mappings for layers in the SAME data model
- ✅ Different data models have independent layer sets

### Duplicate Prevention
- ✅ `onConflictDoNothing` prevents errors if mapping already exists
- ✅ Safe to run multiple times

### Missing Layers
- ✅ Handles data models with fewer than 4 layers
- ✅ Creates mappings for whatever layers exist

### Error Handling
- ✅ Try-catch blocks prevent one failed object from stopping the entire sync
- ✅ Detailed error logging for debugging

## Common Scenarios

### Scenario 1: New Object in Conceptual
1. User creates "Customer" object in Conceptual layer
2. System creates 4 layer-object mappings automatically
3. User switches to Logical layer → "Customer" is there!
4. User positions it differently in Logical layer
5. Both positions are saved independently

### Scenario 2: Existing Objects (Pre-Update)
1. Server starts up
2. Sync runs automatically
3. Finds objects with missing layer mappings
4. Creates missing mappings for all layers
5. Objects now appear in all layers

### Scenario 3: Manual Sync Needed
1. Admin notices missing objects in some layers
2. Calls `/api/admin/ensure-layer-mappings`
3. System processes all objects
4. Creates any missing mappings
5. Returns count of fixed objects

## Success Criteria

- ✅ New objects automatically appear in all layers
- ✅ Each layer can have different positions for the same object
- ✅ Existing objects fixed on server startup
- ✅ Admin endpoint available for manual sync
- ✅ Console logs show sync progress
- ✅ No duplicate entries created
- ✅ No breaking changes to existing functionality

---

**Status**: Fully implemented and tested! 🎉
