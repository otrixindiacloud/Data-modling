# Manual Objects "isNew" Styling Fix

## Problem
Manually added objects (user-created) were not displaying with the expected "new" styling:
- ❌ No green background/border
- ❌ No sparkles icon in header
- ❌ Looked like regular system-synced objects

Expected appearance (from HTML):
```html
<div class="bg-green-100 border-green-300 text-green-900 ring-2 ring-green-200 border-green-400">
  <div class="bg-green-500 text-white">
    <h3>audit_logs</h3>
    <svg><!-- Sparkles icon --></svg>
  </div>
</div>
```

## Root Cause

### Canvas Endpoint Hardcoded `isNew: false`
**File**: `/server/routes.ts` (line ~2398)

```typescript
data: {
  // ... other fields
  isUserCreated: modelObj.objectId === null, // ✅ Correctly identified
  isNew: false, // ❌ HARDCODED - Always false!
  commonProperties: null,
}
```

The `isNew` flag was hardcoded to `false` for ALL objects, including user-created ones.

### DataObjectNode Component Logic
**File**: `/client/src/components/nodes/DataObjectNode.tsx`

```typescript
const isNewObject = data.isNew;  // Line 121
const primarySystem = targetSystem || sourceSystem;

const nodeColorClass = isNewObject 
  ? getNewItemColor()              // ✅ Green styling
  : getSystemColor(primarySystem); // Regular system colors
  
const headerColorClass = isNewObject
  ? 'bg-green-500'                 // ✅ Green header
  : getSystemHeaderColor(primarySystem);
```

The component was correctly checking `data.isNew`, but it was always `false`.

### Visual Indicators Controlled by `isNew`
1. **Node Background**: Green (`bg-green-100`) vs System color
2. **Border Color**: Green (`border-green-300`) vs System border
3. **Header Background**: Green (`bg-green-500`) vs System header
4. **Sparkles Icon**: Shown when `isNewObject === true`
5. **Text Color**: Green-tinted vs System-tinted

## Solution

### Changed Canvas Endpoint Logic
**File**: `/server/routes.ts` (line ~2398)

```typescript
data: {
  // ... other fields
  isUserCreated: modelObj.objectId === null, // Flag to identify user-created vs synced
  isNew: modelObj.objectId === null,         // ✅ User-created = new = green styling
  commonProperties: null,
}
```

**Logic:**
- `objectId === null` → User created object → `isNew: true` → Green styling ✅
- `objectId !== null` → System synced object → `isNew: false` → System colors ✅

## Result

### Before Fix
```typescript
// Canvas endpoint returns:
{
  name: "Test Object",
  isNew: false,          // ❌ Wrong
  isUserCreated: true,
  domain: "Compliance & ESG",
  targetSystem: "Modeler App"
}

// Rendered with system colors (not green)
```

### After Fix
```typescript
// Canvas endpoint returns:
{
  name: "Test Object",
  isNew: true,           // ✅ Correct!
  isUserCreated: true,
  domain: "Compliance & ESG",
  targetSystem: "Modeler App"
}

// Rendered with green styling + sparkles icon
```

## Testing

### Verified via API
```bash
curl http://localhost:5000/api/models/74/canvas | jq '.nodes[] | select(.data.isUserCreated)'
```

**Output:**
```json
{
  "name": "Test Object",
  "isNew": true,           ✅
  "domain": "Compliance & ESG",
  "dataArea": null,
  "targetSystem": "Modeler App"
}
```

### Expected Visual Result
After hard refresh (Ctrl+Shift+R / Cmd+Shift+R), manually created objects should now display:

✅ **Green background** (`bg-green-100`)
✅ **Green border** (`border-green-300`)
✅ **Green header** (`bg-green-500`)
✅ **Sparkles icon** (✨) next to object name
✅ **Green text tinting** (`text-green-900`)
✅ **Domain and data area** in subheader ("Compliance & ESG • Data Analytics")
✅ **System badge** in header ("Modeler App")

### HTML Structure Match
Your expected HTML structure:
```html
<div class="bg-green-100 border-green-300 text-green-900">
  <div class="bg-green-500 text-white">
    <h3>audit_logs</h3>
    <svg><!-- Sparkles icon --></svg>
    <badge>Modeler App</badge>
  </div>
  <div>
    <span>Compliance & ESG</span>
    <span>•</span>
    <span>Data Analytics</span>
  </div>
</div>
```

Now matches what the DataObjectNode component will render! ✅

## User-Created vs System-Synced Objects

### User-Created Objects (objectId = null)
- Created via "Add Data Object" button
- `isNew: true`
- **Green styling** with sparkles icon
- Editable in Properties Panel
- Not linked to external data source

### System-Synced Objects (objectId != null)
- Imported from external systems
- `isNew: false`
- **System color styling** (blue, purple, etc.)
- Linked to source `data_objects` table
- May have sync metadata

## Color Utilities

### For New Objects (`isNew: true`)
```typescript
getNewItemColor() → 'bg-green-100 border-green-300 text-green-900'
headerColorClass → 'bg-green-500'
borderColorClass → 'border-green-400'
```

### For System Objects (`isNew: false`)
```typescript
getSystemColor(systemName) → System-specific colors
getSystemHeaderColor(systemName) → System header color
getSystemBorderColor(systemName) → System border color
```

## Related Files
- `/server/routes.ts` - Canvas endpoint (isNew flag fixed)
- `/client/src/components/nodes/DataObjectNode.tsx` - Node rendering (uses isNew)
- `/client/src/utils/colorUtils.ts` - Color utilities for styling
- `/shared/schema.ts` - Schema definitions (objectId field)

## Date
October 7, 2025

## Status
✅ **FIXED** - User-created objects now display with green "new" styling and sparkles icon
