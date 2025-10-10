# Architecture Change: Separation of System-Synced vs User-Created Objects

## Date: October 7, 2025

## Summary

This document outlines a major architectural change to separate system-synced objects from user-created objects in the Data Modeling application.

## Problem Statement

Previously, the system used a dual-table architecture where:
- `data_objects` table stored global object definitions
- `data_model_objects` table stored model-specific instances

**Issue**: When users created objects via the "Add Data Object" modal, rows were inserted into BOTH tables. However, the business requirement is:
- `data_objects` should ONLY contain objects imported from System Sync (external systems)
- `data_model_objects` should contain user-created objects directly (without a `data_objects` entry)
- Same applies to attributes: `data_object_attributes` vs `data_model_attributes`

## Solution

### 1. Schema Changes

#### data_model_objects Table
Added new fields to store complete object definitions:
- `name` TEXT - Object name (required for user-created objects)
- `description` TEXT - Object description
- `object_type` TEXT - Object type
- `domain_id` INTEGER - Reference to domain
- `data_area_id` INTEGER - Reference to data area
- `source_system_id` INTEGER - Reference to source system

**Key Change**: `object_id` is now **NULLABLE**
- `object_id IS NULL` → User-created object
- `object_id IS NOT NULL` → System-synced object (references `data_objects.id`)

#### data_model_attributes Table
Added new fields to store complete attribute definitions:
- `name` TEXT - Attribute name (required for user-created attributes)
- `description` TEXT - Attribute description
- `data_type` TEXT - Base data type
- `length` INTEGER - Data type length
- `precision` INTEGER - Numeric precision
- `scale` INTEGER - Numeric scale

**Key Change**: `attribute_id` is now **NULLABLE**
- `attribute_id IS NULL` → User-created attribute
- `attribute_id IS NOT NULL` → System-synced attribute (references `data_object_attributes.id`)

### 2. Database Migration

Created migration: `/migrations/0007_separate_synced_and_user_objects.sql`

Key steps:
1. Add new fields to both tables
2. Make `object_id` and `attribute_id` nullable
3. Add CHECK constraints to ensure data integrity
4. Migrate existing data (copy from parent tables)
5. Add indexes for performance

### 3. Backend Changes

#### New Handler: `/server/utils/user_object_handlers.ts`
Created dedicated handler for user-created objects:

**Functions:**
- `createUserObject(input, storage)` - Creates objects directly in `data_model_objects`
- `updateUserObject(modelObjectId, updates, storage)` - Updates user objects
- `deleteUserObject(modelObjectId, storage)` - Deletes user objects

**Key Features:**
- NO insertion into `data_objects` table
- NO insertion into `data_object_attributes` table
- All data stored in `data_model_*` tables
- Sets `objectId` and `attributeId` to `null`

#### Updated Routes: `/server/routes.ts`

**POST /api/objects** - Changed to use `createUserObject()`
```typescript
// OLD: Used createDataObjectWithCascade() - inserted into data_objects
// NEW: Uses createUserObject() - inserts only into data_model_objects
```

**GET /api/models/:id/canvas** - Updated to handle nullable `objectId`
- Checks if `modelObject.objectId === null`
- If null, reads data from `data_model_objects` directly
- If not null, reads from `data_objects` (system-synced)

**PATCH /api/models/:id/objects/positions** - Updated position updates
- Only updates `data_objects` if `objectId` is not null

**Other endpoints** - Added null checks for `objectId` and `attributeId`

### 4. Frontend Changes

#### AddDataObjectModal.tsx
Simplified the mutation to send data directly to the new API:

**Changes:**
- Removed cascade logic (no longer needed)
- Removed model family detection
- Simplified payload to match `UserObjectInput` schema
- Added position generation
- Proper handling of system IDs (sourceSystem, targetSystem)

**New Request Format:**
```typescript
{
  modelId: number,
  name: string,
  description?: string,
  objectType: string,
  domainId?: number,
  dataAreaId?: number,
  sourceSystemId?: number,
  targetSystemId?: number,
  position: { x: number, y: number },
  attributes: Array<{
    name: string,
    conceptualType?: string,
    logicalType?: string,
    physicalType?: string,
    dataType?: string,
    nullable: boolean,
    isPrimaryKey: boolean,
    isForeignKey: boolean,
    orderIndex: number
  }>
}
```

**Response Format:**
```typescript
{
  success: true,
  modelObject: DataModelObject,
  attributes: DataModelAttribute[]
}
```

## How It Works Now

### User Creates an Object

1. User fills out "Add Data Object" form
2. Frontend sends POST to `/api/objects` with object data
3. Backend `createUserObject()` function:
   - Validates input
   - Inserts into `data_model_objects` with `objectId = null`
   - Inserts attributes into `data_model_attributes` with `attributeId = null`
4. Returns created `modelObject` and `attributes`
5. Frontend refreshes queries and shows success message

### System Sync Imports an Object

1. System Sync process runs (separate feature)
2. Inserts into `data_objects` table
3. Inserts into `data_model_objects` table with `objectId = <data_objects.id>`
4. Inserts into `data_object_attributes` table
5. Inserts into `data_model_attributes` with `attributeId = <attributes.id>`

### Querying Objects

When fetching canvas data:
```typescript
if (modelObject.objectId === null) {
  // User-created object - read from data_model_objects
  name = modelObject.name;
  description = modelObject.description;
  attributes = data_model_attributes WHERE attributeId IS NULL;
} else {
  // System-synced object - read from data_objects
  const dataObject = await getDataObject(modelObject.objectId);
  name = dataObject.name;
  description = dataObject.description;
  attributes = data_object_attributes (linked via attributeId);
}
```

## Benefits

1. **Clear Separation of Concerns**
   - System Sync data isolated in `data_objects`
   - User-created data isolated in `data_model_objects`

2. **No Unwanted Entries**
   - `data_objects` table remains clean (only system-synced data)
   - No pollution from user-created objects

3. **Flexible Architecture**
   - User objects can exist independently
   - System objects can still be referenced across models
   - Both types can coexist in the same model

4. **Better Performance**
   - Fewer joins needed for user-created objects
   - Direct queries to `data_model_objects`

5. **Easier Synchronization**
   - System Sync can focus on `data_objects` table
   - No conflicts with user-created data

## Migration Path for Existing Data

The migration automatically:
1. Adds new fields to existing tables
2. Copies data from parent tables to child tables
3. Existing objects continue to work (they have `objectId` set)
4. New objects created after migration will have `objectId = null`

## Testing Checklist

- [x] Schema migration applied successfully
- [x] Server starts without errors
- [ ] Can create new objects via "Add Data Object" modal
- [ ] New objects appear on canvas
- [ ] Objects are NOT inserted into `data_objects` table
- [ ] Attributes are NOT inserted into `data_object_attributes` table
- [ ] Objects ARE inserted into `data_model_objects` table with `objectId = null`
- [ ] Attributes ARE inserted into `data_model_attributes` table with `attributeId = null`
- [ ] Existing system-synced objects still work correctly
- [ ] Canvas displays both user-created and system-synced objects
- [ ] Position updates work for both types
- [ ] Relationships work between user-created objects

## Files Changed

### Created:
- `/migrations/0007_separate_synced_and_user_objects.sql`
- `/server/utils/user_object_handlers.ts`
- `/docs/architecture-system-sync-separation.md` (this file)

### Modified:
- `/shared/schema.ts` - Updated table definitions
- `/server/routes.ts` - Updated POST /api/objects and GET /api/models/:id/canvas
- `/client/src/components/modals/AddDataObjectModal.tsx` - Simplified mutation

## Future Considerations

1. **Layer Generation**: Update layer-to-layer generation to work with user-created objects
2. **Export**: Ensure export functionality handles both object types
3. **System Sync UI**: Add indicators to distinguish system-synced vs user-created objects
4. **Conflict Resolution**: Handle cases where user creates object with same name as synced object

## Rollback Plan

If issues arise:
1. Run migration rollback (if available)
2. Revert code changes via git
3. Restart server
4. User-created objects after migration will be lost (expected)

## Contact

For questions or issues, refer to this documentation or check the codebase comments.
