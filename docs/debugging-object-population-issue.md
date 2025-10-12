# Debugging: Data Objects Not Populating to data_model_objects

## Quick Diagnostic Checklist

Run through these checks in order:

### ✅ 1. Do data_objects exist?
```sql
SELECT id, name, domainId, dataAreaId, systemId 
FROM data_objects 
LIMIT 10;
```
**Expected:** At least one row
**If empty:** Create data objects first via Systems Management

### ✅ 2. Are objects displayed in UI?
- Open "Create New Model" dialog
- Select domain and area
- **Look for "Data Objects" section**
- Should show a list with checkboxes

**If not shown:** Objects don't match your domain/area/system filters

### ✅ 3. Are objects being selected?
**Browser Console should show:**
```
[AddDataModelModal] Filtered data objects: 3 [{id: 1, name: "Customer"}, ...]
[AddDataModalModal] Auto-selecting object IDs: [1, 2, 3]
```

**If object IDs array is empty:** Selection logic not working

### ✅ 4. Are object IDs sent to server?
**Browser Console should show:**
```
[AddDataModelModal] Sending payload: {
  name: "...",
  selectedObjectIds: [1, 2, 3]  <-- Should NOT be empty
}
```

**If selectedObjectIds is []:** Frontend issue - objects not selected

### ✅ 5. Does server receive object IDs?
**Server Terminal should show:**
```
[ROUTES] Received create-with-layers request: {
  "selectedObjectIds": [1, 2, 3]  <-- Should see IDs here
}
[MODEL_HANDLERS] Populating model with 3 selected data objects...
[MODEL_HANDLERS] Selected object IDs: [1, 2, 3]
```

**If not shown:** Check server is running and request is reaching it

### ✅ 6. Are objects being created?
**Server Terminal should show:**
```
[POPULATE_OBJECTS] Starting population...
[POPULATE_OBJECTS] Processing data object ID: 1
[POPULATE_OBJECTS] Found data object: Customer
[POPULATE_OBJECTS] Creating conceptual model object...
[POPULATE_OBJECTS] Created conceptual model object ID: 123
```

**If errors occur here:** Database or data integrity issue

### ✅ 7. Verify in database
```sql
-- Check most recent model
SELECT id, name, layer FROM data_model_layers 
ORDER BY createdAt DESC LIMIT 5;

-- Check objects in that model (use the ID from above)
SELECT id, modelId, objectId, name 
FROM data_model_objects 
WHERE modelId = YOUR_MODEL_ID;
```

**Expected:** Should see rows for each selected object

---

## Common Issues and Fixes

### Issue A: "Filtered data objects: 0"

**Problem:** No objects match the filters

**Root Causes:**
1. Objects don't have domainId set
2. domainId doesn't match selected domain
3. Area/system filters are too restrictive

**Fix 1 - Update object metadata:**
```sql
-- Check what domains exist
SELECT id, name FROM data_domains;

-- Check objects and their domains
SELECT id, name, domainId, dataAreaId, systemId 
FROM data_objects;

-- Update objects to have correct domainId
UPDATE data_objects 
SET domainId = YOUR_DOMAIN_ID 
WHERE id IN (1, 2, 3);
```

**Fix 2 - Relax filters:**
- Try selecting just domain (no specific area)
- Don't filter by system if not needed

---

### Issue B: Objects shown but selectedObjectIds is []

**Problem:** Objects visible but not being selected

**Root Cause:** `selectAll` state issue or effect hook not firing

**Fix - Force selection:**

Add this temporarily to the component:
```typescript
// In AddDataModelModal.tsx, after the filteredDataObjects useMemo
useEffect(() => {
  console.log('Filtered objects changed:', filteredDataObjects);
  console.log('Select all state:', selectAll);
  if (filteredDataObjects.length > 0) {
    const ids = filteredDataObjects.map(obj => obj.id);
    console.log('Setting selected IDs to:', ids);
    setSelectedObjectIds(ids);
  }
}, [filteredDataObjects]);
```

---

### Issue C: Server receives empty array

**Problem:** Request reaches server but `selectedObjectIds: []`

**Debug frontend:**
```typescript
// Add in the mutation function
const payload = {
  name: data.name,
  targetSystem: data.targetSystem,
  targetSystemId: Number(data.targetSystemId),
  domainId: Number(data.domainId),
  dataAreaId: Number(data.dataAreaId),
  selectedObjectIds: selectedObjectIds,
};

// Add these logs
console.log('Current selectedObjectIds state:', selectedObjectIds);
console.log('Filtered objects:', filteredDataObjects);
console.log('Payload being sent:', payload);
```

**If selectedObjectIds state is empty:**
- Check if useEffect is running
- Check React DevTools component state

---

### Issue D: Server logs "Data object X not found"

**Problem:** Object ID doesn't exist in database

**Verify:**
```sql
SELECT id FROM data_objects WHERE id IN (1, 2, 3);
```

**Fix:** Ensure IDs match actual database records

---

### Issue E: Objects created but not visible in model

**Problem:** Records in DB but not shown on canvas

**Check:**
1. Are you looking at the right model/layer?
2. Query the specific model:
```sql
SELECT dml.name, dml.layer, dmo.name as object_name
FROM data_model_objects dmo
JOIN data_model_layers dml ON dmo.modelId = dml.id
WHERE dml.name = 'YOUR_MODEL_NAME';
```

**Check positions:**
```sql
SELECT id, modelId, name, position 
FROM data_model_objects 
WHERE modelId = YOUR_MODEL_ID;
```

**Fix:** Objects might be created with null positions. The canvas should still show them but you might need to arrange them.

---

## Manual Test Script

Run this in browser console after opening Create Model dialog:

```javascript
// 1. Check what's available
console.log('All data objects:', window.__allDataObjects);

// 2. Check filtered
console.log('Filtered objects:', window.__filteredDataObjects);

// 3. Check selected
console.log('Selected IDs:', window.__selectedObjectIds);

// 4. Force selection (if needed)
// This is pseudo-code - actual implementation depends on React DevTools
```

---

## Server-Side Debug Query

If objects are being processed but not created, add try-catch:

```typescript
// In populateModelsWithSelectedObjects function
try {
  const createdConceptual = await storage.createDataModelObject(conceptualModelObject);
  console.log('[POPULATE_OBJECTS] Created conceptual model object ID: ${createdConceptual.id}');
} catch (error) {
  console.error('[POPULATE_OBJECTS] Error creating conceptual object:', error);
  console.error('[POPULATE_OBJECTS] Payload was:', conceptualModelObject);
  throw error;
}
```

---

## Nuclear Option: Force Creation

If all else fails, manually create a test record:

```sql
-- 1. Get a model ID
SELECT id, name FROM data_model_layers WHERE layer = 'conceptual' LIMIT 1;

-- 2. Get a data object
SELECT id, name FROM data_objects LIMIT 1;

-- 3. Manually create relationship
INSERT INTO data_model_objects (
  objectId, modelId, name, isVisible, metadata, layerSpecificConfig
) VALUES (
  1,  -- objectId from step 2
  1,  -- modelId from step 1
  'Test Object',
  true,
  '{}',
  '{}'
);

-- 4. Verify
SELECT * FROM data_model_objects ORDER BY id DESC LIMIT 1;
```

If this works, the issue is in the API/handler code.
If this fails, there's a database constraint issue.

---

## Get Help

When asking for help, provide:

1. **Browser Console Output** (full)
2. **Server Terminal Output** (with our debug logs)
3. **Database State:**
```sql
-- Number of objects
SELECT COUNT(*) as object_count FROM data_objects;

-- Number of model objects
SELECT COUNT(*) as model_object_count FROM data_model_objects;

-- Sample object
SELECT * FROM data_objects LIMIT 1;

-- Recent model
SELECT * FROM data_model_layers ORDER BY createdAt DESC LIMIT 1;
```

4. **What you see in UI:**
   - Screenshot of Create Model dialog
   - Whether Data Objects section appears
   - How many objects are shown
   - Selection count

This will help diagnose exactly where the flow is breaking!
