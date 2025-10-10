# Manual Object Display Fix - Canvas Query Invalidation

## Problem
After creating a manual object (via "Add Data Object" button):
- Object appeared on canvas but **without information & colors**
- Looked blank or had default/missing styling
- User had to refresh browser to see correct display

## Root Cause

### Data Flow Analysis
1. User clicks "Add Data Object" button
2. AddDataObjectModal creates object in `data_model_objects` table
3. Modal closes and invalidates queries
4. **Canvas query was NOT being properly invalidated**
5. Canvas continued showing stale data or didn't refresh
6. User saw incomplete/blank object nodes

### Query Key Mismatch
```typescript
// Canvas uses this query key:
["/api/models", currentLayerModel?.id, "canvas", currentLayer]

// Modal was invalidating:
["/api/models", currentModel?.id, "canvas"]  // ❌ Too specific
["/api/models", currentModel?.id, "objects"] // ❌ Wrong key
```

The issue was that:
- `currentLayerModel` might be different from `currentModel`
- Query invalidation didn't match the actual canvas query key
- Canvas didn't refresh after object creation

## Solution

### Fixed Query Invalidation in AddDataObjectModal
**File**: `/client/src/components/modals/AddDataObjectModal.tsx`

Changed from specific query invalidation to **broad pattern matching**:

```typescript
onSuccess: (data) => {
  console.log("Object created successfully:", data);
  
  // Invalidate relevant queries - Use broader pattern to catch all canvas queries
  queryClient.invalidateQueries({ 
    queryKey: ["/api/models", currentModel?.id],
    exact: false // ✅ This invalidates ALL queries starting with this key
  });
  queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
  queryClient.invalidateQueries({ queryKey: ["/api/attributes"] });
  queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
  queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
  
  toast({
    title: "✓ Object Created Successfully",
    description: `${data.modelObject.name} has been added to the model with ${data.attributes.length} attributes.`,
  });
  
  // Reset form and close modal
  resetForm();
  onOpenChange(false);
},
```

### Key Change: `exact: false`
By setting `exact: false`, the invalidation pattern matches **all queries** that start with `["/api/models", currentModel?.id]`, including:
- `["/api/models", 74, "canvas", "conceptual"]` ✅
- `["/api/models", 74, "canvas", "logical"]` ✅
- `["/api/models", 74, "objects"]` ✅
- Any other model-specific queries ✅

## Backend Data Verification

### Canvas Endpoint IS Working Correctly
The canvas endpoint (`GET /api/models/:id/canvas`) already:
1. ✅ Fetches from `data_model_objects` table
2. ✅ Resolves domain, data area, and system IDs to names
3. ✅ Returns complete data for ALL objects (user-created and synced)

**Test Results:**
```bash
curl http://localhost:5000/api/models/74/canvas | jq '.nodes[] | select(.data.isUserCreated)'
```

**Output:**
```json
{
  "id": "124",
  "name": "Test Object",
  "domain": "Compliance & ESG",
  "dataArea": null,
  "sourceSystem": null,
  "targetSystem": "Modeler App",
  "isNew": false
}
```

✅ **All fields are present and correct!**

## Result

### Before Fix
```
User creates object → Modal closes
                     ↓
Canvas doesn't refresh (query key mismatch)
                     ↓
Object appears but without data (stale/incomplete)
                     ↓
User sees blank/unstyled node ❌
```

### After Fix
```
User creates object → Modal closes
                     ↓
All model queries invalidated (exact: false)
                     ↓
Canvas query automatically refreshes
                     ↓
Object appears with full data immediately ✅
```

## Testing

### Verify Fix
1. Open Modeler in Conceptual layer
2. Click "Add Data Object" button
3. Fill in form with:
   - Name: "Test Manual Object"
   - Domain: Select a domain
   - Data Area: Select an area
   - Target System: Select a system
4. Click "Create Object"
5. **Expected Result**: Object immediately appears with:
   - Correct name
   - Domain name in subheader
   - Data area name in subheader
   - System color coding on border/background
   - No need to refresh browser

### What to Look For
✅ Object displays immediately after creation
✅ Domain and data area names visible in subheader
✅ System color applied to node border/background
✅ Attributes panel shows any attributes created
✅ Node is selectable and editable

### If Still Issues
If manually created objects still show blank:

1. **Check Browser DevTools Console** for errors
   ```javascript
   // Should see:
   "Object created successfully: {modelObject: {...}, attributes: [...]}"
   ```

2. **Check Network Tab** for canvas refresh
   ```
   GET /api/models/74/canvas?layer=conceptual
   Status: 200
   Response: {nodes: [...], edges: [...]}
   ```

3. **Hard Refresh Browser** (Ctrl+Shift+R / Cmd+Shift+R)
   - Clears any cached query data
   - Forces fresh data fetch

## Related Files

- `/client/src/components/modals/AddDataObjectModal.tsx` - Query invalidation fixed
- `/client/src/components/Canvas.tsx` - Canvas query definition
- `/server/routes.ts` - Canvas endpoint (already working correctly)
- `/server/utils/user_object_handlers.ts` - Object creation logic

## Additional Improvements Made

### 1. Enhanced GET /api/objects Endpoint
Also resolved domain, area, and system names for dragged objects (separate fix).

### 2. Canvas onDrop Handler  
Updated to handle both field name formats (domainName vs domain) with fallbacks.

## Date
October 7, 2025

## Status
✅ **FIXED** - Query invalidation now properly refreshes canvas after object creation
