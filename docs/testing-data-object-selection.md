# Testing Data Object Selection Feature

## Pre-requisites

Before testing, ensure you have:
1. At least one Data Domain created
2. At least one Data Area within that domain
3. At least one System created
4. **At least one Data Object** with:
   - Assigned domain
   - Assigned data area (optional but helps with filtering)
   - Assigned system (optional but helps with filtering)
   - Some attributes

## How to Create Test Data Objects

If you don't have data objects yet, create them first:

1. Go to **Systems Management** page
2. Select a system
3. Go to the **Objects** tab
4. Click **Add Object**
5. Fill in:
   - Name: e.g., "Customer"
   - Domain: Select a domain
   - Data Area: Select an area
   - System: Will be auto-assigned to current system
6. Add some attributes (optional but recommended)
7. Save the object

Repeat for a few more objects (e.g., "Order", "Product")

## Testing Steps

### Step 1: Open Create Data Model Dialog

1. Go to the **Data Models** page
2. Click **"Create New Model"** button
3. Fill in basic information:
   - **Model Name**: e.g., "Test Customer Model"
   - **Target System**: Select any system
   - **Domain**: Select the domain where you created objects
   - **Data Area**: Select the area where you created objects

### Step 2: Check Console Logs

Open browser DevTools (F12) and check the Console tab. You should see:

```
[AddDataModelModal] Filtered data objects: X [{id: Y, name: "..."}]
[AddDataModelModal] Auto-selecting object IDs: [...]
```

If you see `Filtered data objects: 0`, it means:
- No objects exist for the selected domain/area/system combination
- The objects' domain/area/system properties don't match your selection

### Step 3: Verify Object List Appears

In the modal, you should see:
- A section titled **"Data Objects"**
- A "Select All" checkbox
- A badge showing "X of Y selected"
- A scrollable list of objects with checkboxes

**If you don't see this section:**
- No objects match your filters
- Check that objects have the correct domain/area/system assigned

### Step 4: Select/Deselect Objects

1. Try unchecking "Select All" - all objects should be deselected
2. Check "Select All" again - all should be selected
3. Try unchecking individual objects
4. Note the count badge updates

### Step 5: Create the Model

1. Click **"Create Model"** button
2. Check browser console for:
```
[AddDataModelModal] Sending payload: {...}
[AddDataModelModal] Selected object IDs: [1, 2, 3]
```

3. Check server terminal/logs for:
```
[ROUTES] Received create-with-layers request: {...}
[MODEL_HANDLERS] Populating model with X selected data objects...
[MODEL_HANDLERS] Selected object IDs: [...]
[POPULATE_OBJECTS] Starting population...
[POPULATE_OBJECTS] Processing data object ID: X
[POPULATE_OBJECTS] Found data object: "..."
[POPULATE_OBJECTS] Creating conceptual model object...
[POPULATE_OBJECTS] Created conceptual model object ID: Y
```

### Step 6: Verify Objects in Model

1. The model should be created and opened
2. Check the canvas - you should see the objects
3. Open the **Data Explorer** panel (right side)
4. You should see the objects listed
5. Click on an object to see its attributes

## Debugging Common Issues

### Issue 1: No Objects Displayed in Selection List

**Check:**
```sql
SELECT id, name, domainId, dataAreaId, systemId FROM data_objects;
```

Ensure:
- Objects have `domainId` set
- `domainId` matches the domain you selected in the form

**Fix:**
- Update objects to have correct domain/area/system IDs
- Or select different domain/area/system in the form

### Issue 2: Objects Displayed But Not Sent to Server

**Check browser console:**
Look for the payload being sent. If `selectedObjectIds` is empty `[]`, the issue is in the frontend.

**Possible causes:**
- `selectAll` state is false
- Effect hook not running

**Quick fix:**
Try manually checking/unchecking "Select All" checkbox

### Issue 3: Objects Sent But Not Created in Database

**Check server logs:**
Look for errors like:
- `Data object X not found` - Object doesn't exist in data_objects table
- Database constraint errors - Check foreign key constraints

**Verify database:**
```sql
-- Check if data_model_objects were created
SELECT id, modelId, objectId, name FROM data_model_objects 
WHERE modelId IN (SELECT id FROM data_model_layers WHERE name = 'Test Customer Model');

-- Check if attributes were created
SELECT dmo.name as object_name, dmoa.name as attribute_name
FROM data_model_object_attributes dmoa
JOIN data_model_objects dmo ON dmoa.modelObjectId = dmo.id
WHERE dmo.modelId IN (SELECT id FROM data_model_layers WHERE name = 'Test Customer Model');
```

### Issue 4: Empty Array Sent (selectedObjectIds: [])

This happens when objects are displayed but not properly selected.

**Check:**
1. Browser console - look for auto-selection logs
2. Try manually clicking "Select All"

**Debug:**
Add this in browser console:
```javascript
// Check component state
// (React DevTools or add console.log in component)
```

## Expected Database Records

After creating a model with 2 selected objects, you should have:

1. **4 model layers** (flow, conceptual, logical, physical) in `data_model_layers`
2. **6 model objects** (2 objects × 3 layers*) in `data_model_objects`
   - *Note: Flow layer typically doesn't have objects
3. **N attributes per layer** in `data_model_object_attributes`
4. **Relationships** in `data_model_object_relationships` (if objects had relationships)

## Success Indicators

✅ Objects are visible in the selection list
✅ Console shows correct object IDs being sent
✅ Server logs show objects being processed
✅ Model opens with objects visible on canvas
✅ Database has records in `data_model_objects`
✅ Attributes are visible in the properties panel

## Contact/Report

If objects are displayed but still not populating:
1. Share browser console output
2. Share server terminal output
3. Share database query results for:
   - `SELECT * FROM data_objects LIMIT 5;`
   - `SELECT * FROM data_model_objects LIMIT 5;`
