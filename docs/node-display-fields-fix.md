# Fix: Object Node Display Details from data_model_objects

## Issue
After switching the canvas to fetch exclusively from `data_model_objects`, object nodes were not displaying details like Domain, Data Area, and System information. The node component was looking for field names that didn't match what the backend was sending.

## Root Cause
**Frontend Expectations vs Backend Response Mismatch:**

The `DataObjectNode` component expected these fields:
```typescript
data.domain          // Domain name for display
data.dataArea        // Data area name for display
data.sourceSystem    // Source system name for display
data.targetSystem    // Target system name for display
```

But the backend was sending:
```typescript
data.domainName      // ❌ Different field name
data.dataAreaName    // ❌ Different field name
data.sourceSystemId  // ❌ ID instead of name
data.targetSystemId  // ❌ ID instead of name
```

## Solution

### 1. Added System Name Resolution
The backend now resolves system IDs to system names:

```typescript
// Get source and target system names
let sourceSystemName, targetSystemName;
if (modelObj.sourceSystemId) {
  const sourceSystem = await storage.getSystem(modelObj.sourceSystemId);
  sourceSystemName = sourceSystem?.name;
}
if (modelObj.targetSystemId) {
  const targetSystem = await storage.getSystem(modelObj.targetSystemId);
  targetSystemName = targetSystem?.name;
}
```

### 2. Updated Node Data Structure
Now sends BOTH legacy field names (for node display) AND new field names (for other components):

```typescript
data: {
  // IDs for reference
  domainId: modelObj.domainId,
  dataAreaId: modelObj.dataAreaId,
  sourceSystemId: modelObj.sourceSystemId,
  targetSystemId: modelObj.targetSystemId,
  
  // Names for node display (legacy field names)
  domain: domainName,           // ✅ Node uses this
  dataArea: dataAreaName,       // ✅ Node uses this
  sourceSystem: sourceSystemName, // ✅ Node uses this
  targetSystem: targetSystemName, // ✅ Node uses this
  
  // Names for properties panel (new field names)
  domainName,                   // ✅ Properties panel uses this
  dataAreaName,                 // ✅ Properties panel uses this
  
  // Additional fields
  domainColor,
  // ... rest of fields
}
```

## Changes Made

### `/server/routes.ts` - Canvas Endpoint

**Added System Name Lookups:**
```typescript
// Get source and target system names
let sourceSystemName, targetSystemName;
if (modelObj.sourceSystemId) {
  const sourceSystem = await storage.getSystem(modelObj.sourceSystemId);
  sourceSystemName = sourceSystem?.name;
}
if (modelObj.targetSystemId) {
  const targetSystem = await storage.getSystem(modelObj.targetSystemId);
  targetSystemName = targetSystem?.name;
}
```

**Updated Node Data Fields:**
```typescript
data: {
  // ... other fields
  domain: domainName,              // NEW: For node display
  domainName,                      // Keep for properties panel
  dataArea: dataAreaName,          // NEW: For node display
  dataAreaName,                    // Keep for properties panel
  sourceSystem: sourceSystemName,  // NEW: For node display
  targetSystem: targetSystemName,  // NEW: For node display
  sourceSystemId: modelObj.sourceSystemId, // Keep for reference
  targetSystemId: modelObj.targetSystemId, // Keep for reference
  isNew: false,                    // Legacy field for compatibility
  commonProperties: null,          // Legacy field for compatibility
}
```

## How DataObjectNode Uses These Fields

### Header Display (Line 118-119)
```tsx
const sourceSystem = data.sourceSystem;
const targetSystem = data.targetSystem;
const primarySystem = targetSystem || sourceSystem;

// Shows system badge in header
{primarySystem && (
  <Badge variant="secondary">
    {primarySystem}
  </Badge>
)}
```

### Domain & Data Area Display (Line 223)
```tsx
{(data.domain || data.dataArea) && (
  <div className="flex items-center space-x-2 mt-1 text-xs opacity-90">
    {data.domain && <span>{data.domain}</span>}
    {data.domain && data.dataArea && <span>•</span>}
    {data.dataArea && <span>{data.dataArea}</span>}
  </div>
)}
```

## Data Flow

### Complete Flow from Database to Display

```
1. Database Query
   ↓
   data_model_objects (id, name, domainId, dataAreaId, sourceSystemId, targetSystemId)
   ↓
2. Backend Processing
   ↓
   Resolve IDs to Names:
   - domainId → storage.getDataDomain() → domainName
   - dataAreaId → storage.getDataArea() → dataAreaName
   - sourceSystemId → storage.getSystem() → sourceSystemName
   - targetSystemId → storage.getSystem() → targetSystemName
   ↓
3. Node Data Structure
   ↓
   {
     domain: domainName,          // Node displays this
     dataArea: dataAreaName,      // Node displays this
     sourceSystem: sourceSystemName, // Node displays this
     targetSystem: targetSystemName, // Node displays this
     domainName,                  // Properties panel uses this
     dataAreaName,                // Properties panel uses this
     sourceSystemId,              // Properties panel uses this
     targetSystemId,              // Properties panel uses this
   }
   ↓
4. Frontend Display
   ↓
   DataObjectNode renders:
   - Header: System name badge
   - Subheader: "Domain • Data Area"
```

## Example Node Data (Complete)

```typescript
{
  id: "124",
  type: "object",
  position: { x: 100, y: 100 },
  data: {
    id: 124,
    objectId: 124,
    modelObjectId: 124,
    name: "Customer",
    objectType: "entity",
    description: "Customer master data",
    
    // IDs
    domainId: 5,
    dataAreaId: 3,
    sourceSystemId: 10,
    targetSystemId: 11,
    
    // Display names (for node)
    domain: "Sales",              // ← Node displays
    dataArea: "Master Data",      // ← Node displays
    sourceSystem: "SAP ERP",      // ← Node displays
    targetSystem: "Data Warehouse", // ← Node displays
    
    // Alternative names (for properties panel)
    domainName: "Sales",
    dataAreaName: "Master Data",
    domainColor: "#FF5733",
    
    // Attributes
    attributes: [
      { id: 1, name: "CustomerID", conceptualType: "Text", ... }
    ],
    
    // Metadata
    metadata: {},
    layerSpecificConfig: {},
    isUserCreated: true,
    isNew: false,
    commonProperties: null,
  }
}
```

## Benefits

1. ✅ **Backward Compatibility** - Keeps both field naming conventions
2. ✅ **Complete Display** - All node details now visible
3. ✅ **Domain Display** - Shows domain name in node subheader
4. ✅ **Data Area Display** - Shows data area in node subheader
5. ✅ **System Display** - Shows system badge in node header
6. ✅ **No Breaking Changes** - Properties panel still works with new field names
7. ✅ **Single Source** - Still fetching exclusively from data_model_objects

## Visual Result

### Before Fix
```
┌─────────────────────┐
│ Customer         [ ]│  ← No system badge
├─────────────────────┤
│                     │  ← No domain/area shown
│ • CustomerID        │
│ • Name              │
│ • Email             │
└─────────────────────┘
```

### After Fix
```
┌─────────────────────┐
│ Customer    [SAP ERP]│  ← ✅ System badge shown
├─────────────────────┤
│ Sales • Master Data │  ← ✅ Domain & Area shown
│ • CustomerID        │
│ • Name              │
│ • Email             │
└─────────────────────┘
```

## Testing Checklist

- [x] Backend resolves system IDs to names
- [ ] Node displays domain name
- [ ] Node displays data area name
- [ ] Node displays system badge in header
- [ ] Properties panel still works with all fields
- [ ] Edit operations preserve all values
- [ ] No console errors
- [ ] All three layers (Conceptual/Logical/Physical) display correctly

## Related Files

- `/server/routes.ts` - Canvas endpoint (GET /api/models/:id/canvas)
- `/client/src/components/nodes/DataObjectNode.tsx` - Node display component
- `/server/storage.ts` - getSystem(), getDataDomain(), getDataArea() methods
- `/docs/canvas-single-source-architecture.md` - Single source architecture

## Notes

- Still fetching exclusively from `data_model_objects` (no change to architecture)
- Added system name resolution to match domain/area name resolution pattern
- Maintains dual field names for compatibility during transition
- Future: Can standardize on one set of field names after migration complete
