# Data Model Object Attributes Not Displaying in Canvas - Fix

## Issue
Data model object attributes were not being populated/displayed in the canvas for logical & physical layers.

## Root Cause
When objects were added to a model layer (e.g., when dragging from Object Lake to a logical/physical canvas), the system was creating `data_model_objects` records but **NOT creating the corresponding `data_model_object_attributes` projection records**.

### Architecture Context
The system uses a **canonical + projection** architecture:
- **Canonical Layer**: `data_objects` + `data_object_attributes` (source of truth)
- **Projection Layer**: `data_model_objects` + `data_model_object_attributes` (layer-specific views)

When rendering the canvas, the `/api/models/:id/canvas` endpoint queries `data_model_object_attributes` to get attributes for display. If these projection records don't exist, objects appear without attributes.

## Investigation
```sql
-- Found objects with canonical attributes but no projections
SELECT 
  dmo.id as model_object_id,
  dmo.name,
  dmo.model_id,
  dml.layer,
  COUNT(doa.id) as canonical_attr_count,
  COUNT(dma.id) as projection_attr_count
FROM data_model_objects dmo
JOIN data_model_layers dml ON dmo.model_id = dml.id
LEFT JOIN data_objects data_obj ON dmo.object_id = data_obj.id
LEFT JOIN data_object_attributes doa ON doa.object_id = data_obj.id
LEFT JOIN data_model_object_attributes dma 
  ON dma.model_object_id = dmo.id AND dma.model_id = dmo.model_id
WHERE dmo.object_id IS NOT NULL
  AND dml.layer IN ('logical', 'physical')
GROUP BY dmo.id, dmo.name, dmo.model_id, dml.layer
HAVING COUNT(doa.id) > 0 AND COUNT(dma.id) = 0;
```

Example result:
- Object: "coupons" in logical layer
- Canonical attributes: 12
- Projection attributes: 0 ❌

## Solution

### 1. Backfill Existing Data
Created `scripts/backfill-attribute-projections.ts` to create missing attribute projections for existing objects.

```bash
NODE_OPTIONS='--require dotenv/config' npx tsx scripts/backfill-attribute-projections.ts
```

### 2. Fix Future Object Additions
Modified `POST /api/models/:modelId/objects` endpoint in `server/routes.ts` to automatically create attribute projections when adding objects to a model layer.

**Before:**
```typescript
// Create the data model object entry
const dataModelObject = await storage.createDataModelObject({
  objectId,
  modelId,
  ...
});

res.status(201).json(dataModelObject); // ❌ No attributes created
```

**After:**
```typescript
// Create the data model object entry
const dataModelObject = await storage.createDataModelObject({
  objectId,
  modelId,
  ...
});

// ✅ Create attribute projections
const canonicalAttributes = await storage.getAttributesByObject(objectId);
for (const canonicalAttr of canonicalAttributes) {
  await storage.createDataModelObjectAttribute({
    attributeId: canonicalAttr.id,
    modelObjectId: dataModelObject.id,
    modelId: modelId,
    name: canonicalAttr.name,
    conceptualType: canonicalAttr.conceptualType,
    logicalType: canonicalAttr.logicalType,
    physicalType: canonicalAttr.physicalType,
    // ... other fields
  });
}

res.status(201).json(dataModelObject);
```

## Verification

### Before Fix
```bash
# Query logical layer attributes
SELECT COUNT(*) FROM data_model_object_attributes WHERE model_id = 8;
# Result: 0 ❌
```

### After Fix
```bash
# Query logical layer attributes
SELECT COUNT(*) FROM data_model_object_attributes WHERE model_id = 8;
# Result: 12 ✅

# Verify attributes are returned in canvas API
curl http://localhost:5000/api/models/8/canvas?layer=logical
# Should now include attributes array for each node
```

## Impact
- ✅ Existing objects now display attributes in logical/physical canvas
- ✅ Future object additions will automatically create attribute projections
- ✅ Properties panel will show attributes for selected objects
- ✅ Attribute-level relationships can now be created in logical/physical layers

## Testing
1. Open a logical or physical layer canvas
2. Verify existing objects now show attributes
3. Drag a new object from Object Lake to the canvas
4. Verify the new object displays its attributes
5. Select an object and verify attributes appear in Properties Panel

## Related Files
- `server/routes.ts` - Fixed object addition endpoint
- `scripts/backfill-attribute-projections.ts` - Backfill script
- `docs/data-model-object-attributes-fix.md` - This documentation
