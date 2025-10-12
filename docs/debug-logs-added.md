# Debug Logs Added - Data Object Population Issue

## Changes Made

Added comprehensive debug logging to track data object population from UI to database.

### Frontend Logging (AddDataModelModal.tsx)

**Location 1: Filtered Objects**
```typescript
console.log('[AddDataModelModal] Filtered data objects:', filtered.length, filtered.map(o => ({ id: o.id, name: o.name })));
```
Shows which objects match the domain/area/system filters.

**Location 2: Auto-Selection**
```typescript
console.log('[AddDataModelModal] Auto-selecting object IDs:', ids);
```
Shows which object IDs are being selected by default.

**Location 3: Payload Being Sent**
```typescript
console.log('[AddDataModelModal] Sending payload:', payload);
console.log('[AddDataModelModal] Selected object IDs:', selectedObjectIds);
```
Shows what's being sent to the server.

### Backend Logging

**Location 1: Routes (routes.ts)**
```typescript
console.log('[ROUTES] Received create-with-layers request:', JSON.stringify(input, null, 2));
```
Shows what the server receives.

**Location 2: Model Handlers (model_handlers.ts)**
```typescript
console.log('[MODEL_HANDLERS] Populating model with ${selectedObjectIds.length} selected data objects...');
console.log('[MODEL_HANDLERS] Selected object IDs:', selectedObjectIds);
```
Shows when population starts and which IDs are being processed.

**Location 3: Population Function**
```typescript
console.log('[POPULATE_OBJECTS] Starting population...');
console.log('[POPULATE_OBJECTS] Processing data object ID: ${dataObjectId}');
console.log('[POPULATE_OBJECTS] Found data object:', dataObject.name);
console.log('[POPULATE_OBJECTS] Creating conceptual model object...');
console.log('[POPULATE_OBJECTS] Created conceptual model object ID: ${createdConceptual.id}');
```
Shows each step of object creation.

## How to Use These Logs

### Step 1: Open Browser DevTools
- Press F12
- Go to Console tab
- Look for messages starting with `[AddDataModelModal]`

### Step 2: Check Server Terminal
- Look for messages starting with:
  - `[ROUTES]`
  - `[MODEL_HANDLERS]`
  - `[POPULATE_OBJECTS]`

### Step 3: Identify Where It Breaks

The logs follow this flow:

```
FRONTEND:
1. [AddDataModelModal] Filtered data objects: ...
2. [AddDataModelModal] Auto-selecting object IDs: ...
3. [AddDataModelModal] Sending payload: ...

BACKEND:
4. [ROUTES] Received create-with-layers request: ...
5. [MODEL_HANDLERS] Populating model with X selected data objects...
6. [POPULATE_OBJECTS] Starting population...
7. [POPULATE_OBJECTS] Processing data object ID: X
8. [POPULATE_OBJECTS] Found data object: ...
9. [POPULATE_OBJECTS] Creating conceptual model object...
10. [POPULATE_OBJECTS] Created conceptual model object ID: ...
```

**Find where the flow stops** to identify the issue.

## Common Scenarios

### Scenario A: Stops at Step 1
**Symptom:** `Filtered data objects: 0`
**Problem:** No objects match your filters
**See:** [debugging-object-population-issue.md](./debugging-object-population-issue.md) - Issue A

### Scenario B: Stops at Step 2
**Symptom:** Shows objects but `Auto-selecting object IDs: []`
**Problem:** Selection logic not working
**See:** [debugging-object-population-issue.md](./debugging-object-population-issue.md) - Issue B

### Scenario C: Stops at Step 4
**Symptom:** Frontend logs show IDs but server receives empty array
**Problem:** Network/serialization issue
**Check:** Network tab in DevTools, look at request payload

### Scenario D: Error at Step 8
**Symptom:** `Data object X not found`
**Problem:** Object doesn't exist in database
**See:** [debugging-object-population-issue.md](./debugging-object-population-issue.md) - Issue D

### Scenario E: Completes but no objects in model
**Symptom:** All logs succeed but objects not visible
**Problem:** Canvas/UI issue or looking at wrong model
**See:** [debugging-object-population-issue.md](./debugging-object-population-issue.md) - Issue E

## Next Steps

1. **Try creating a model with objects selected**
2. **Capture all console and terminal output**
3. **Share the logs** to identify where the flow breaks
4. **Consult** the debugging guide for specific issues

## Files Modified

- `client/src/components/modals/AddDataModelModal.tsx` - Frontend logging
- `server/routes.ts` - Route logging
- `server/utils/model_handlers.ts` - Handler and population logging

## Reference Documents

- [testing-data-object-selection.md](./testing-data-object-selection.md) - Complete testing guide
- [debugging-object-population-issue.md](./debugging-object-population-issue.md) - Detailed debugging steps
- [data-object-selection-feature.md](./data-object-selection-feature.md) - Feature documentation
- [data-object-selection-quick-reference.md](./data-object-selection-quick-reference.md) - Quick reference
