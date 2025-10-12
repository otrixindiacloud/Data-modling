# Layer-Specific Object Positions Implementation

## Problem
Canvas objects were being saved with the same position across all layers. When an object appeared in multiple layers (Conceptual, Logical, Physical), moving it in one layer would affect its position in all other layers.

## Solution
Implemented layer-specific position storage using the `data_model_layer_objects` table, which represents the many-to-many relationship between layers and objects.

## Changes Made

### 1. Database Schema Changes

#### Migration: `0014_add_layer_object_positions.sql`
Added position columns to the `data_model_layer_objects` table:
- `position_x` (DOUBLE PRECISION) - X coordinate for this object in this specific layer
- `position_y` (DOUBLE PRECISION) - Y coordinate for this object in this specific layer
- Created indexes for faster position queries
- Migrated existing positions from `data_model_objects.position` to populate initial values

#### Schema Update: `shared/schema.ts`
Updated `dataModelLayerObjects` table definition to include:
```typescript
positionX: doublePrecision("position_x"),
positionY: doublePrecision("position_y"),
```

### 2. Storage Layer Changes (`server/storage.ts`)

Added three new methods to handle layer-specific positions:

#### `updateLayerObjectPosition(layerId, objectId, positionX, positionY)`
Updates the position of an object in a specific layer. This is the primary method for saving positions.

**Parameters:**
- `layerId`: The data model layer ID (e.g., conceptual, logical, physical layer)
- `objectId`: The data model object ID
- `positionX`: X coordinate on the canvas
- `positionY`: Y coordinate on the canvas

**Returns:** Updated `DataModelLayerObject` record

#### `getLayerObjectPosition(layerId, objectId)`
Retrieves the position of a specific object in a specific layer.

**Parameters:**
- `layerId`: The data model layer ID
- `objectId`: The data model object ID

**Returns:** `{ positionX: number | null; positionY: number | null }`

#### `getLayerObjectsWithPositions(layerId)`
Gets all objects with their positions for a specific layer. Useful for bulk operations.

**Parameters:**
- `layerId`: The data model layer ID

**Returns:** Array of objects with id, dataModelObjectId, positionX, positionY

### 3. Routes Changes (`server/routes.ts`)

#### Canvas GET Endpoint: `/api/models/:id/canvas`
**Updated position retrieval logic:**
1. First, tries to get position from `data_model_layer_objects` table (layer-specific)
2. Falls back to `data_model_objects.position` for backward compatibility
3. Uses default position `{ x: 100, y: 100 }` if neither exists

**Code:**
```typescript
// Get position from layer-specific storage (data_model_layer_objects table)
const layerPosition = await storage.getLayerObjectPosition(modelId, modelObj.id);
let position = { x: 100, y: 100 }; // Default position

if (layerPosition && layerPosition.positionX !== null && layerPosition.positionY !== null) {
  // Use layer-specific position if available
  position = { 
    x: layerPosition.positionX, 
    y: layerPosition.positionY 
  };
} else if (modelObj.position) {
  // Fallback to old position storage for backward compatibility
  position = modelObj.position;
}
```

#### Canvas Position Save Endpoint: `/api/models/:id/canvas/positions`
**Updated position saving logic:**
1. Saves position to `data_model_layer_objects` table (primary storage)
2. Also updates `data_model_objects.position` for backward compatibility
3. Removed complex `layerSpecificConfig` logic

**Code:**
```typescript
// Save position to data_model_layer_objects table for layer-specific storage
await storage.updateLayerObjectPosition(
  modelId, // This is the layer ID
  modelObject.id, // This is the model object ID
  position.x,
  position.y
);

// Also update data_model_objects.position for backward compatibility
await storage.updateDataModelObject(modelObject.id, { 
  position
});
```

## How It Works

### Data Model Structure
```
data_models (parent container)
  ↓
data_model_layers (conceptual, logical, physical, flow)
  ↓
data_model_layer_objects (junction table with positions)
  ↓
data_model_objects (actual object data)
```

### Position Storage Flow

**Saving:**
1. User moves an object on the canvas in Layer A
2. Frontend sends position update to `/api/models/:id/canvas/positions`
3. Backend saves position to `data_model_layer_objects` for Layer A + Object
4. Position is stored separately for each layer

**Loading:**
1. User opens a specific layer (e.g., Logical layer)
2. Backend fetches objects from `data_model_objects`
3. For each object, backend retrieves layer-specific position from `data_model_layer_objects`
4. Frontend renders objects at their layer-specific positions

### Example Scenario

**Object: "Customer"**
- In Conceptual Layer (layer_id=1): position_x=100, position_y=200
- In Logical Layer (layer_id=2): position_x=500, position_y=300
- In Physical Layer (layer_id=3): position_x=200, position_y=150

Each layer maintains its own independent canvas layout!

## Backward Compatibility

The implementation maintains backward compatibility:
- Old `data_model_objects.position` field is still updated
- If no layer-specific position exists, the system falls back to the old position field
- Existing positions were migrated to the new table structure

## Benefits

1. **Layer Independence**: Each layer can have its own canvas layout
2. **Better Organization**: Objects can be positioned optimally for each layer's purpose
3. **Data Integrity**: Position data is properly normalized in the junction table
4. **Performance**: Indexed queries for fast position retrieval
5. **Scalability**: Easy to add additional layer-specific metadata in the future

## Testing Recommendations

1. **Create an object in multiple layers**
   - Add an object to Conceptual, Logical, and Physical layers
   
2. **Move object in one layer**
   - Position it at (100, 100) in Conceptual layer
   
3. **Switch to another layer**
   - Open Logical layer
   - Object should be at its default position or previously saved position
   
4. **Move object in second layer**
   - Position it at (500, 500) in Logical layer
   
5. **Verify independence**
   - Switch back to Conceptual layer
   - Object should still be at (100, 100)
   - Switch to Logical layer
   - Object should be at (500, 500)

## Database Queries for Verification

```sql
-- Check positions for all objects in a specific layer
SELECT 
  dlo.data_model_layer_id,
  dmo.name,
  dlo.position_x,
  dlo.position_y
FROM data_model_layer_objects dlo
JOIN data_model_objects dmo ON dmo.id = dlo.data_model_object_id
WHERE dlo.data_model_layer_id = 1; -- Replace with your layer ID

-- Check if an object has different positions in different layers
SELECT 
  dml.name as layer_name,
  dmo.name as object_name,
  dlo.position_x,
  dlo.position_y
FROM data_model_layer_objects dlo
JOIN data_model_objects dmo ON dmo.id = dlo.data_model_object_id
JOIN data_model_layers dml ON dml.id = dlo.data_model_layer_id
WHERE dmo.id = 1 -- Replace with your object ID
ORDER BY dml.id;
```

### 4. Frontend Changes

#### Removed Page Reload on Layer Switch (`client/src/components/LayerNavigator.tsx`)

**Previous behavior:**
- When switching layers, the entire page would reload
- This caused flickering and loss of UI state
- Unnecessary since we have a single data model for all layers

**Updated behavior:**
```typescript
// Before:
setCurrentLayer(layer);
if (typeof window !== "undefined") {
  setTimeout(() => {
    window.location.reload();
  }, 50);
}

// After:
setCurrentLayer(layer);
// No page reload needed - React Query automatically refetches
// with layer-specific positions from data_model_layer_objects table
```

**How it works:**
1. React Query monitors the `queryKey`: `["/api/models", currentLayerModel?.id, "canvas", currentLayer]`
2. When `currentLayer` changes, React Query automatically refetches canvas data
3. The API returns layer-specific positions from `data_model_layer_objects`
4. Canvas re-renders with the new positions smoothly
5. No page reload or flickering

**Benefits:**
- ✅ Smooth layer switching without page refresh
- ✅ Preserves UI state (open panels, zoom level, etc.)
- ✅ Faster navigation between layers
- ✅ Better user experience
- ✅ Leverages React Query's caching and automatic refetching

## Architecture

### Single Data Model Approach

The application uses a **single unified data model** for all layers:
- Objects are created once in the Conceptual layer
- The same objects are shared across all layers (Flow, Conceptual, Logical, Physical)
- Only **positions** differ between layers
- No need to reload the page when switching layers

### Data Flow on Layer Switch

```
User clicks layer button
        ↓
setCurrentLayer(layer) updates Zustand store
        ↓
React Query detects queryKey change: currentLayer
        ↓
Automatic refetch: GET /api/models/:id/canvas?layer=:layer
        ↓
Server fetches from data_model_layer_objects with layer-specific positions
        ↓
Canvas re-renders with new positions (no page reload)
```

## Future Enhancements

Potential future improvements:
1. Add layer-specific visibility flags
2. Add layer-specific styling/colors
3. Add layer-specific metadata (notes, tags, etc.)
4. Implement position history/undo for each layer
5. Add auto-layout algorithms per layer
6. Layer-specific zoom and viewport state
7. Smooth animation when switching between layer positions
