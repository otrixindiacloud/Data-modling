# Relationship Issues Across Layers - Analysis & Fix

**Date**: October 11, 2025  
**Status**: 🔍 INVESTIGATING

## Problem

After refreshing the browser or switching layers, console shows:
```
[CANVAS] Found 50 relationships for layer 6
Missing model objects for relationship 69
Missing model objects for relationship 70
Missing model objects for relationship 71
...
[CANVAS] Returning 0 valid edges out of 50 total edges
```

**Impact**: Relationships (edges) are not displaying on the canvas even though they exist in the database.

## Root Cause Analysis

### Issue #1: Orphaned Relationships

The `data_model_object_relationships` table contains relationships that reference `source_model_object_id` or `target_model_object_id` values that **no longer exist** in the `data_model_objects` table.

**How this happens:**
1. Objects are deleted from `data_model_objects`
2. The relationships in `data_model_object_relationships` that reference those objects are **not automatically deleted** (no CASCADE constraint)
3. When canvas loads, it tries to find those model objects and fails

### Issue #2: Cross-Layer References (Potential)

If relationships were created before the layer-specific architecture was properly implemented, they might reference objects from different layers:

```
relationship.model_id = 6 (conceptual layer)
BUT
source_model_object.model_id = 7 (logical layer)  ❌ Wrong!
```

## Database Schema Understanding

### Relationships Table Structure
```
data_model_object_relationships
├── id (primary key)
├── model_id (references data_model_layers.id) ← Which layer this relationship belongs to
├── source_model_object_id (references data_model_objects.id)
├── target_model_object_id (references data_model_objects.id)
├── source_attribute_id (optional, for attribute-level relationships)
├── target_attribute_id (optional, for attribute-level relationships)
├── type (e.g., "1:N", "1:1", "N:M")
└── relationship_level ("object" or "attribute")
```

### Expected Behavior
For a relationship in layer 6:
```
relationship.model_id = 6
source_model_object.model_id = 6  ✅
target_model_object.model_id = 6  ✅
```

## Code Flow (Current)

### GET `/api/models/:id/canvas`

```typescript
// Step 1: Get objects for current layer
const modelObjects = await storage.getDataModelObjectsByModel(layerId); // e.g., layer 6

// Step 2: Build lookup map
const modelObjectsById = new Map(modelObjects.map(mo => [mo.id, mo]));
// Map only contains objects from layer 6

// Step 3: Get relationships for current layer
const relationships = await storage.getDataModelObjectRelationshipsByModel(layerId);
// Returns 50 relationships where model_id = 6

// Step 4: Try to resolve relationships
for (const rel of relationships) {
  const sourceModelObject = modelObjectsById.get(rel.sourceModelObjectId); // Lookup in map
  const targetModelObject = modelObjectsById.get(rel.targetModelObjectId); // Lookup in map
  
  if (!sourceModelObject || !targetModelObject) {
    console.warn(`Missing model objects for relationship ${rel.id}`); // ❌ Fails here
    return null; // Relationship is discarded
  }
}
```

**Why it fails:**
- If `rel.sourceModelObjectId = 123` but object 123 was deleted or doesn't exist in layer 6
- The map lookup returns `undefined`
- Relationship is marked as "missing" and discarded

## Diagnostic Steps

### Enhanced Logging (Added)

```typescript
if (!sourceModelObject || !targetModelObject) {
  console.warn(`[CANVAS] Missing model objects for relationship ${rel.id}:`);
  console.warn(`  - Source model object ${rel.sourceModelObjectId}: ${sourceModelObject ? 'EXISTS' : 'MISSING'}`);
  console.warn(`  - Target model object ${rel.targetModelObjectId}: ${targetModelObject ? 'EXISTS' : 'MISSING'}`);
  console.warn(`  - Relationship is in layer: ${rel.modelId}`);
  console.warn(`  - Current viewing layer: ${layerId}`);
  return null;
}
```

This will show us:
- Which specific model object IDs are missing
- Whether source or target is the problem
- Layer mismatches if any

### SQL Diagnostics (Manual)

```sql
-- Find orphaned relationships (missing source)
SELECT 
    r.id as relationship_id,
    r.model_id as layer_id,
    r.source_model_object_id,
    r.target_model_object_id
FROM data_model_object_relationships r
LEFT JOIN data_model_objects so ON r.source_model_object_id = so.id
WHERE so.id IS NULL;

-- Find orphaned relationships (missing target)
SELECT 
    r.id as relationship_id,
    r.model_id as layer_id,
    r.source_model_object_id,
    r.target_model_object_id
FROM data_model_object_relationships r
LEFT JOIN data_model_objects tgt ON r.target_model_object_id = tgt.id
WHERE tgt.id IS NULL;

-- Find cross-layer references
SELECT 
    r.id as relationship_id,
    r.model_id as rel_layer,
    so.model_id as source_layer,
    tgt.model_id as target_layer
FROM data_model_object_relationships r
JOIN data_model_objects so ON r.source_model_object_id = so.id
JOIN data_model_objects tgt ON r.target_model_object_id = tgt.id
WHERE so.model_id != r.model_id OR tgt.model_id != r.model_id;
```

## Solutions

### Solution 1: Clean Up Orphaned Relationships (Immediate)

**SQL Script to Delete Orphaned Relationships:**

```sql
-- Delete relationships where source object doesn't exist
DELETE FROM data_model_object_relationships r
WHERE NOT EXISTS (
  SELECT 1 FROM data_model_objects so 
  WHERE so.id = r.source_model_object_id
);

-- Delete relationships where target object doesn't exist
DELETE FROM data_model_object_relationships r
WHERE NOT EXISTS (
  SELECT 1 FROM data_model_objects tgt 
  WHERE tgt.id = r.target_model_object_id
);
```

**Run as migration:**
```bash
npm run db:migrate
```

### Solution 2: Add CASCADE Delete Constraint (Prevention)

**Migration to Add Constraint:**

```sql
-- Add foreign key constraint with CASCADE delete
ALTER TABLE data_model_object_relationships
DROP CONSTRAINT IF EXISTS fk_source_model_object,
ADD CONSTRAINT fk_source_model_object
  FOREIGN KEY (source_model_object_id)
  REFERENCES data_model_objects(id)
  ON DELETE CASCADE;

ALTER TABLE data_model_object_relationships
DROP CONSTRAINT IF EXISTS fk_target_model_object,
ADD CONSTRAINT fk_target_model_object
  FOREIGN KEY (target_model_object_id)
  REFERENCES data_model_objects(id)
  ON DELETE CASCADE;
```

**Benefit:** When a model object is deleted, all its relationships are automatically deleted.

### Solution 3: Improve Code Robustness (Defensive)

**Option A: Skip missing objects gracefully**

```typescript
const edges = await Promise.all(filteredRelationships.map(async rel => {
  const sourceModelObject = modelObjectsById.get(rel.sourceModelObjectId) ?? 
    (await storage.getDataModelObject(rel.sourceModelObjectId));
  const targetModelObject = modelObjectsById.get(rel.targetModelObjectId) ?? 
    (await storage.getDataModelObject(rel.targetModelObjectId));
  
  if (!sourceModelObject || !targetModelObject) {
    // Only log once in a while to avoid spam
    if (Math.random() < 0.1) {
      console.warn(`[CANVAS] Skipping orphaned relationship ${rel.id}`);
    }
    return null; // Skip this relationship
  }
  
  // Continue processing...
}));
```

**Option B: Validate layer consistency**

```typescript
// After fetching objects, verify they belong to the correct layer
if (sourceModelObject.modelId !== layerId) {
  console.warn(`[CANVAS] Source object ${sourceModelObject.id} belongs to layer ${sourceModelObject.modelId}, not ${layerId}`);
  return null;
}
if (targetModelObject.modelId !== layerId) {
  console.warn(`[CANVAS] Target object ${targetModelObject.id} belongs to layer ${targetModelObject.modelId}, not ${layerId}`);
  return null;
}
```

### Solution 4: Automatic Cleanup Job (Maintenance)

**Server Startup Task:**

```typescript
// In server/index.ts
async function cleanupOrphanedRelationships() {
  console.log('[CLEANUP] Checking for orphaned relationships...');
  
  const allRelationships = await storage.getAllDataModelObjectRelationships();
  let deletedCount = 0;
  
  for (const rel of allRelationships) {
    const sourceExists = await storage.getDataModelObject(rel.sourceModelObjectId);
    const targetExists = await storage.getDataModelObject(rel.targetModelObjectId);
    
    if (!sourceExists || !targetExists) {
      await storage.deleteDataModelObjectRelationship(rel.id);
      deletedCount++;
    }
  }
  
  console.log(`[CLEANUP] Deleted ${deletedCount} orphaned relationships`);
}

// Run on startup
await cleanupOrphanedRelationships();
```

## Testing Plan

### 1. View Console Output

After the enhanced logging is deployed, reload the page and check console:

```
[CANVAS] Missing model objects for relationship 69:
  - Source model object 123: MISSING
  - Target model object 124: EXISTS (layer: 6)
  - Relationship is in layer: 6
  - Current viewing layer: 6
```

This tells us object 123 was deleted but relationship still references it.

### 2. Test Relationship Creation

Create a new relationship and verify:
- ✅ It appears immediately
- ✅ It persists after page reload
- ✅ It appears in the correct layer only (if layer-specific)
- ✅ It appears in all layers (if cross-layer object relationship)

### 3. Test Object Deletion

Delete an object that has relationships:
- ✅ Relationships should be deleted automatically (after CASCADE fix)
- ✅ No "missing model objects" warnings
- ✅ Canvas should not show orphaned edges

## Recommended Action Plan

**Phase 1: Investigate** ✅ CURRENT
1. Deploy enhanced logging
2. Refresh browser and collect diagnostic output
3. Identify specific model object IDs that are missing

**Phase 2: Clean Data** (Next)
1. Create cleanup migration to delete orphaned relationships
2. Run migration
3. Verify relationships now load correctly

**Phase 3: Prevent Future Issues**
1. Add CASCADE delete constraints
2. Add validation in relationship creation endpoint
3. Add automated cleanup job

**Phase 4: Monitoring**
1. Monitor console logs for new orphaned relationships
2. Alert if count exceeds threshold
3. Regular database health checks

## Status

**Current**: Enhanced diagnostic logging deployed. Waiting for browser console output to identify specific missing objects.

**Next Step**: Refresh browser at http://localhost:5000 and share console output showing the detailed missing object information.

---

**Files Modified**:
- ✅ `server/routes.ts` - Added detailed diagnostic logging for missing relationships
- 📝 `scripts/check_orphaned_relationships.sql` - SQL diagnostics script
- 📝 `docs/relationship-fix-across-layers.md` - This documentation

