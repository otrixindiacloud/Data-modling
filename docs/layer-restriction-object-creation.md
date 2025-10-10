# Layer Restriction for Object Creation

## Date: October 7, 2025

## Issue
When clicking "Add Data Object", 3 modal forms were appearing instead of 1. This was happening because the modal was being rendered once for each layer (Conceptual, Logical, Physical).

## Root Cause
The application has 3 layers (Conceptual, Logical, Physical) and the modal component was being rendered for each layer context, resulting in 3 identical modals appearing simultaneously.

## Solution

### Design Decision
**Objects can ONLY be created in the Conceptual layer.**
- Logical layer objects are generated FROM Conceptual objects
- Physical layer objects are generated FROM Logical objects
- This follows the standard data modeling workflow: Conceptual → Logical → Physical

### Implementation

#### 1. Canvas Component (`/client/src/components/Canvas.tsx`)
Added layer validation before opening the modal:

```typescript
// Handle Add Object - ONLY allowed in Conceptual layer
const handleAddObject = useCallback(() => {
  if (currentLayer !== 'conceptual') {
    toast({
      title: "Layer Restriction",
      description: "Objects can only be added in the Conceptual layer. Logical and Physical objects are generated from Conceptual objects.",
      variant: "destructive",
    });
    return;
  }
  setShowAddObjectModal(true);
}, [currentLayer, toast]);
```

#### 2. AddDataObjectModal Component (`/client/src/components/modals/AddDataObjectModal.tsx`)

**A. Early Return Check:**
```typescript
// CRITICAL: Only render in Conceptual layer and when open
if (!open || currentLayer !== 'conceptual') {
  return null;
}
```

**B. Submit Validation:**
```typescript
// Ensure we're in Conceptual layer with a Conceptual model
if (currentLayer !== 'conceptual' || currentModel.layer !== 'conceptual') {
  toast({
    title: "Layer Restriction",
    description: "Objects can only be created in Conceptual layer. Switch to Conceptual layer to add objects.",
    variant: "destructive",
  });
  return;
}
```

**C. Updated UI Labels:**
- Title: "Add Data Object (Conceptual Layer)"
- Description: "Create a new conceptual data object. Logical and Physical layer objects will be generated from this conceptual object."

## User Workflow

### Creating Objects (Conceptual Layer Only)
1. User switches to **Conceptual layer**
2. Click "Add Data Object" button
3. Fill out object details
4. Object is created in `data_model_objects` table with `modelId` = conceptual model ID

### Generating Logical Layer Objects
1. User stays in Conceptual layer OR switches to Logical layer
2. Select a conceptual object
3. Properties panel shows "Generate Logical Object" button
4. Click to generate logical version
5. System creates object in logical model with transformed attributes

### Generating Physical Layer Objects
1. User switches to Logical layer OR Physical layer
2. Select a logical object
3. Properties panel shows "Generate Physical Object" button
4. Click to generate physical version
5. System creates object in physical model with database-specific types

## Benefits

1. **Single Source of Truth**: All objects originate from Conceptual layer
2. **No Duplicates**: Prevents 3 modals from appearing
3. **Clear Workflow**: Users understand the layer progression
4. **Consistent Data Model**: Logical and Physical objects maintain relationships to Conceptual origin
5. **Better UX**: Clear error messages guide users to correct layer

## Technical Details

### Layer Check Logic
```typescript
// Component level check (prevents rendering)
if (!open || currentLayer !== 'conceptual') {
  return null;
}

// Button click level check (shows error message)
if (currentLayer !== 'conceptual') {
  toast({ ... });
  return;
}

// Submit level check (final validation)
if (currentLayer !== 'conceptual' || currentModel.layer !== 'conceptual') {
  toast({ ... });
  return;
}
```

### Three Levels of Protection
1. **Component Render**: Modal doesn't render if not in conceptual layer
2. **Button Click**: Shows toast notification if user tries to add from wrong layer
3. **Form Submit**: Final validation before API call

## Testing Checklist

- [ ] In **Conceptual Layer**: "Add Data Object" button works, modal opens
- [ ] In **Logical Layer**: "Add Data Object" button shows error toast, modal doesn't open
- [ ] In **Physical Layer**: "Add Data Object" button shows error toast, modal doesn't open
- [ ] Only **ONE modal** appears when clicking "Add Data Object"
- [ ] Modal title shows "(Conceptual Layer)"
- [ ] Modal description mentions generating Logical/Physical objects
- [ ] Form submission validates layer before sending to API
- [ ] Generated Logical objects appear in Logical layer
- [ ] Generated Physical objects appear in Physical layer

## Related Features

- Layer-to-layer object generation (implemented earlier)
- Object generation endpoints:
  - `POST /api/objects/:id/generate-logical`
  - `POST /api/objects/:id/generate-physical`
  - `POST /api/objects/:id/generate-next-layer`

## Error Messages

**When clicking "Add Data Object" in non-Conceptual layer:**
```
Title: "Layer Restriction"
Description: "Objects can only be added in the Conceptual layer. Logical and Physical objects are generated from Conceptual objects."
```

**When attempting to submit form in wrong layer:**
```
Title: "Layer Restriction"
Description: "Objects can only be created in Conceptual layer. Switch to Conceptual layer to add objects."
```

## Future Enhancements

1. **Auto-switch to Conceptual**: Optionally switch user to Conceptual layer when they click "Add Data Object"
2. **Batch Generation**: Generate Logical AND Physical objects in one operation
3. **Visual Indicator**: Show layer badge on "Add Data Object" button
4. **Disabled State**: Disable "Add Data Object" button in non-Conceptual layers with tooltip explanation

## Files Modified

1. `/client/src/components/Canvas.tsx`
   - Added `handleAddObject()` function with layer validation
   - Updated `onAddObject` prop to use new handler

2. `/client/src/components/modals/AddDataObjectModal.tsx`
   - Added early return for non-conceptual layers
   - Added submit validation for layer check
   - Updated modal title and description
   - Added detailed console logging for debugging

3. `/docs/layer-restriction-object-creation.md` (this file)
   - Comprehensive documentation of changes

## Rollback Plan

If issues arise:
1. Remove layer checks from `handleAddObject`
2. Remove early return from `AddDataObjectModal`
3. Remove submit validation
4. Revert modal title/description changes
5. Objects will be creatable in any layer again (previous behavior)
