# Relationship & Attribute Architecture

## Overview
This document explains how relationships work across conceptual, logical, and physical layers, focusing on attribute-level relationships.

## Core Principles

### Relationship Level by Layer
- **Conceptual Layer**: ONLY object-level relationships (entity-to-entity)
- **Logical Layer**: ONLY attribute-level relationships (FK-to-PK mappings)
- **Physical Layer**: ONLY attribute-level relationships (FK-to-PK mappings)

**Rationale**: 
- Conceptual models show high-level entity relationships without implementation details
- Logical and physical models must specify exact attribute mappings to properly represent database schemas

## Table Architecture

### Data Model Hierarchy
```
data_models (parent model)
  └─ data_model_layers (flow, conceptual, logical, physical)
      ├─ data_model_objects (objects in each layer)
      │   └─ data_model_object_attributes (attributes for each object in each layer)
      └─ data_model_object_relationships (relationships in each layer)
```

### Key Tables

#### 1. `data_objects` (Global Objects)
- Contains master object definitions
- Shared across all models
- Has `data_object_attributes` (global attributes)

#### 2. `data_model_objects` (Layer-Specific Objects)
- Links global objects to specific model layers
- Each layer (conceptual, logical, physical) has its own records
- References `data_objects.id` via `objectId` column
- Belongs to a `data_model_layer` via `modelId`

#### 3. `data_model_object_attributes` (Layer-Specific Attributes)
- Links global attributes to model objects in specific layers
- **Critical Field**: `modelId` = `data_models.id` (parent model ID, NOT layer ID)
- References global `data_object_attributes.id` via `attributeId`
- References `data_model_objects.id` via `modelObjectId`

#### 4. `data_model_object_relationships` (Layer-Specific Relationships)
- Stores relationships between model objects in a layer
- **For Attribute Relationships**:
  - `sourceAttributeId` = `data_model_object_attributes.id`
  - `targetAttributeId` = `data_model_object_attributes.id`
  - These are **model-level attribute IDs**, not global ones
- References `data_model_layers.id` via `modelId`

#### 5. `data_object_relationships` (Global Relationships)
- Stores the "truth" about relationships between global objects
- **For Attribute Relationships**:
  - `sourceAttributeId` = `data_object_attributes.id`
  - `targetAttributeId` = `data_object_attributes.id`
  - These are **global attribute IDs**

## Relationship Flow

### Creating an Attribute-Level Relationship

1. **UI sends request** with:
   - `sourceObjectId`, `targetObjectId` (global object IDs)
   - `sourceAttributeId`, `targetAttributeId` (model attribute IDs from canvas)
   - `modelId` (layer ID where relationship is created)

2. **Backend normalizes** (`relationship_handlers.ts`):
   ```typescript
   // Convert model attribute IDs to global attribute IDs
   const modelAttr = await storage.getDataModelObjectAttribute(sourceAttributeId);
   const globalAttrId = modelAttr.attributeId; // This is the global ID
   ```

3. **Global relationship created** in `data_object_relationships`:
   ```sql
   INSERT INTO data_object_relationships (
     source_data_object_id,
     target_data_object_id,
     source_attribute_id,  -- global attribute ID
     target_attribute_id,  -- global attribute ID
     relationship_level: 'attribute'
   )
   ```

4. **Family synchronization** (`relationship_utils.ts`):
   - For each layer (conceptual, logical, physical):
     - Find corresponding `data_model_objects` 
     - Find or create `data_model_object_attributes` for the layer
     - Create `data_model_object_relationships` with **model attribute IDs**

### Critical Fix: Attribute Lookup

**Problem**: Attributes weren't being found across layers

**Root Cause**: Using wrong ID for lookup
```typescript
// WRONG - using layer ID
findDataModelAttributeId(attributes, modelToSync.id, ...)

// CORRECT - using parent model ID  
findDataModelAttributeId(attributes, modelToSync.dataModelId, ...)
```

The `data_model_object_attributes.modelId` stores the **parent model ID** (from `data_models`), not the layer ID (from `data_model_layers`).

### Model Attribute Creation

When syncing relationships across layers, if attributes don't exist:

```typescript
const newModelAttr = await storage.createDataModelObjectAttribute({
  attributeId: globalAttributeId,        // Link to global attribute
  modelObjectId: sourceModelObject.id,   // Model object in this layer
  modelId: modelToSync.dataModelId,      // PARENT MODEL ID (critical!)
  conceptualType: globalAttr.conceptualType,
  logicalType: globalAttr.logicalType,
  physicalType: globalAttr.physicalType,
  // ... other properties
});
```

## Canvas Rendering

### Loading Relationships

When the canvas loads (`GET /api/models/:id/canvas`):

1. **Filter by layer type**:
   - **Conceptual**: Only show relationships without attribute IDs (`rel.sourceAttributeId == null && rel.targetAttributeId == null`)
   - **Logical/Physical**: Only show relationships WITH both attribute IDs (`rel.sourceAttributeId != null && rel.targetAttributeId != null && rel.relationshipLevel === 'attribute'`)

2. **Map model attribute IDs to global IDs**:
   ```typescript
   const sourceModelAttr = await storage.getDataModelObjectAttribute(rel.sourceAttributeId);
   const globalSourceAttributeId = sourceModelAttr?.attributeId;
   ```

3. **Send to UI** with global attribute IDs for handle generation:
   ```typescript
   sourceHandle: `attr-${globalAttributeId}-source`
   targetHandle: `attr-${globalAttributeId}-target`
   ```

### Enforcement Rules

The system enforces layer-appropriate relationships at multiple levels:

1. **Backend Validation** (`relationship_handlers.ts`):
   ```typescript
   if ((model.layer === "logical" || model.layer === "physical") && relationshipLevel === "object") {
     throw new Error("Object-level relationships are not allowed in logical/physical layers");
   }
   ```

2. **Family Sync** (`relationship_utils.ts`):
   - Skips logical/physical layers if attributes can't be resolved
   - Only creates relationships in layers where proper attributes exist

3. **Canvas Filter** (`routes.ts`):
   - Filters out inappropriate relationships when loading canvas
   - Ensures UI only shows valid relationships for each layer

### Why This Architecture?

1. **Global Truth**: `data_object_relationships` maintains the single source of truth
2. **Layer Flexibility**: Each layer can have different visualization/positioning
3. **Type Evolution**: Attributes can have different types per layer (conceptual → logical → physical)
4. **Sync Guarantee**: Changes propagate automatically across all layers

## Testing Checklist

- [ ] Create attribute relationship in physical layer
- [ ] Verify it appears immediately in UI
- [ ] Refresh page - relationship should persist
- [ ] Check all 3 layers show appropriate relationships
- [ ] Verify `data_model_object_relationships` has correct model attribute IDs
- [ ] Verify `data_object_relationships` has correct global attribute IDs

## Common Issues

### Relationships disappear after reload
- **Symptom**: Edge shows up, but vanishes on page refresh
- **Cause**: `sourceAttributeId` or `targetAttributeId` is NULL in `data_model_object_relationships`
- **Fix**: Ensure attributes are looked up using `dataModelId`, not layer `id`

### FK constraint violation
- **Symptom**: Error creating relationship with foreign key violation
- **Cause**: Trying to insert model attribute ID into `data_object_relationships`
- **Fix**: Normalize model attribute IDs to global attribute IDs before insert

### Attributes not syncing across layers
- **Symptom**: Relationship works in one layer but not others
- **Cause**: `findDataModelAttributeId` can't find attributes in other layers
- **Fix**: Use consistent `dataModelId` for lookup and creation
