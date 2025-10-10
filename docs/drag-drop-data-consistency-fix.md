# Drag & Drop Data Consistency Fix

## Problem
When dragging an object from the right panel (Data Sources Sidebar) to the canvas:
1. Object initially displayed correctly with domain, data area, and system info
2. **Immediately after drop**, object appearance changed (lost metadata)
3. This happened because:
   - **Drag operation**: Used data from `data_objects` table (with only IDs)
   - **Canvas refresh**: Fetched from `data_model_objects` table (with resolved names)

## Root Cause

### Data Flow Mismatch
```
Drag from Sidebar → Uses /api/objects → Returns data_objects (only IDs)
                                         ↓
                    Canvas creates node with obj.domainName (undefined!)
                                         ↓
                    Save to database succeeds
                                         ↓
Canvas Refresh → Uses /api/models/:id/canvas → Returns data_model_objects (with resolved names)
                                         ↓
                    Canvas updates node with correct data
                                         ↓
                    **Visual "flicker" as data changes**
```

### The Issue
1. **GET /api/objects** returned objects with only `domainId`, `dataAreaId`, `sourceSystemId`, `targetSystemId`
2. **Canvas onDrop** tried to use `object.domainName`, `object.dataAreaName` (which didn't exist)
3. Node was created with `domain: undefined`, `dataArea: undefined`
4. **GET /api/models/:id/canvas** returned objects with resolved names
5. Canvas refreshed and updated nodes with correct data
6. User saw the "flicker" or "change" in appearance

## Solution

### 1. Enhanced GET /api/objects Endpoint
**File**: `/server/routes.ts`

Added name resolution to match the canvas endpoint pattern:

```typescript
app.get("/api/objects", async (req, res) => {
  try {
    const objects = await storage.getAllDataObjects();
    
    // Enhance objects with resolved names for domain, dataArea, and systems
    const enhancedObjects = await Promise.all(objects.map(async (obj) => {
      let domainName, dataAreaName, sourceSystemName, targetSystemName;
      
      if (obj.domainId) {
        const domain = await storage.getDataDomain(obj.domainId);
        domainName = domain?.name;
      }
      if (obj.dataAreaId) {
        const dataArea = await storage.getDataArea(obj.dataAreaId);
        dataAreaName = dataArea?.name;
      }
      if (obj.sourceSystemId) {
        const sourceSystem = await storage.getSystem(obj.sourceSystemId);
        sourceSystemName = sourceSystem?.name;
      }
      if (obj.targetSystemId) {
        const targetSystem = await storage.getSystem(obj.targetSystemId);
        targetSystemName = targetSystem?.name;
      }
      
      return {
        ...obj,
        domainName,
        dataAreaName,
        sourceSystem: sourceSystemName,
        targetSystem: targetSystemName,
      };
    }));
    
    res.json(enhancedObjects);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch all objects" });
  }
});
```

### 2. Updated Canvas onDrop Handler
**File**: `/client/src/components/Canvas.tsx`

Updated to handle both old and new field formats with fallbacks:

```typescript
const newNode = {
  id: object.id.toString(),
  type: 'dataObject',
  position,
  data: {
    name: object.name,
    objectId: object.id,
    domain: object.domainName || object.domain || 'Uncategorized',
    dataArea: object.dataAreaName || object.dataArea || null,
    attributes: object.attributes || [],
    sourceSystem: object.sourceSystem || null,
    targetSystem: object.targetSystem || null,
    isNew: object.isNew || false
  }
};
```

## Result

### Before
```
User drags object → Node shows "Uncategorized" / "General"
                    ↓
Canvas refreshes → Node updates to show correct domain/area
                    ↓
User sees visual "flicker" or change
```

### After
```
User drags object → Node shows correct domain/area immediately
                    ↓
Canvas refreshes → Node data matches, no visual change
                    ↓
Seamless, consistent user experience ✓
```

## Benefits

1. ✅ **Consistent Display**: Objects show correct metadata from the moment they're dropped
2. ✅ **No Visual Flicker**: No sudden changes after canvas refresh
3. ✅ **Better UX**: Users see expected data immediately
4. ✅ **Data Integrity**: Both drag source and canvas use same data structure
5. ✅ **Future-Proof**: Fallback handling ensures compatibility

## Testing

### Verify Fix
1. Open Data Sources Sidebar
2. Drag an object from `data_objects` table to canvas
3. **Expected**: Object immediately shows:
   - Correct domain name in subheader
   - Correct data area name in subheader
   - Correct system color coding
4. **No flicker** or change in appearance after drop

### Test Data
```bash
# Check what /api/objects returns
curl http://localhost:5000/api/objects | jq '.[0] | {name, domainName, dataAreaName, sourceSystem, targetSystem}'

# Example output:
{
  "name": "audit_logs",
  "domainName": "Compliance & ESG",
  "dataAreaName": "Data Analytics",
  "sourceSystem": "Modeler App",
  "targetSystem": null
}
```

## Related Files

- `/server/routes.ts` - Enhanced GET /api/objects endpoint
- `/client/src/components/Canvas.tsx` - Updated onDrop handler
- `/client/src/components/DataSourcesSidebar.tsx` - Drag source (unchanged)
- `/client/src/components/nodes/DataObjectNode.tsx` - Display component (unchanged)

## Date
October 7, 2025
