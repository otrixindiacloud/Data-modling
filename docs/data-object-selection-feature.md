# Data Object Selection Feature for Data Model Creation

## Overview
This feature allows users to select specific Data Objects when creating a new Data Model. The system automatically populates the model with the selected objects, their attributes, and relationships across all layers (Flow, Conceptual, Logical, and Physical).

## User Experience Flow

### 1. Create Data Model Dialog
When creating a new data model, users will:
1. Enter the model name
2. Select a target system
3. Select a domain
4. Select a data area
5. **NEW**: See a filterable list of data objects matching the selected domain, area, and system
6. **NEW**: Select/deselect which objects to include (all selected by default)

### 2. Data Object Selection UI
- **Auto-population**: All matching data objects are automatically selected by default
- **Select All/Deselect All**: Checkbox to quickly toggle all objects
- **Individual Selection**: Each object has its own checkbox
- **Visual Feedback**: Shows count of selected vs. total objects
- **Object Details**: Displays object name, description, and type
- **Scrollable List**: If many objects exist, they're shown in a scrollable area

### 3. Filtering Logic
Data objects are filtered based on:
- **Domain**: Must match the selected domain (required)
- **Data Area**: If selected, objects must match this area (optional filter)
- **System**: If the target system is set, objects must match (optional filter)

## Technical Implementation

### Frontend Changes

#### File: `client/src/components/modals/AddDataModelModal.tsx`

**Key Changes:**
1. Added state management for selected objects:
   ```typescript
   const [selectedObjectIds, setSelectedObjectIds] = useState<number[]>([]);
   const [selectAll, setSelectAll] = useState(true);
   ```

2. Fetch all data objects:
   ```typescript
   const { data: allDataObjects = [] } = useQuery<DataObject[]>({
     queryKey: ["/api/objects"],
     ...
   });
   ```

3. Filter objects based on selections:
   ```typescript
   const filteredDataObjects = useMemo(() => {
     return allDataObjects.filter((obj) => {
       const domainMatch = obj.domainId === Number(selectedDomainId);
       const areaMatch = !selectedDataAreaId || obj.dataAreaId === Number(selectedDataAreaId);
       const systemMatch = !selectedTargetSystemId || obj.systemId === Number(selectedTargetSystemId);
       return domainMatch && areaMatch && systemMatch;
     });
   }, [allDataObjects, selectedDomainId, selectedDataAreaId, selectedTargetSystemId]);
   ```

4. Include selected IDs in API request:
   ```typescript
   const payload = {
     ...otherFields,
     selectedObjectIds: selectedObjectIds,
   };
   ```

5. Added UI components:
   - Checkbox for each object
   - Select All checkbox
   - Badge showing selection count
   - ScrollArea for object list

### Backend Changes

#### File: `server/utils/model_handlers.ts`

**Key Changes:**

1. Updated interface to accept selectedObjectIds:
   ```typescript
   export interface CreateModelWithLayersInput {
     ...existing fields,
     selectedObjectIds?: number[];
   }
   ```

2. New function `populateModelsWithSelectedObjects`:
   - Creates `DataModelObject` entries in all three layers (conceptual, logical, physical)
   - Copies all attributes for each object to `data_model_object_attributes`
   - Creates relationships between objects if both source and target are selected
   - Returns count of objects added

3. Modified `createModelWithLayers` function:
   - Checks if `selectedObjectIds` is provided
   - If yes, uses `populateModelsWithSelectedObjects` instead of template population
   - If no, falls back to original template-based population

### Database Operations

#### Data Flow:
1. **Read from `data_objects`**: Fetch the selected data objects
2. **Read from `data_object_attributes`**: Fetch all attributes for each object
3. **Read from `data_object_relationships`**: Fetch relationships between selected objects

4. **Write to `data_model_objects`**: Create object instances in each layer
   - Conceptual layer
   - Logical layer  
   - Physical layer

5. **Write to `data_model_object_attributes`**: Create attribute instances for each object in each layer

6. **Write to `data_model_object_relationships`**: Create relationships between objects in each layer

## API Changes

### POST `/api/models/create-with-layers`

**Request Body:**
```typescript
{
  name: string;
  targetSystem?: string;
  targetSystemId?: number;
  domainId?: number;
  dataAreaId?: number;
  selectedObjectIds?: number[];  // NEW
}
```

**Response:**
```typescript
{
  flow: DataModelLayer;
  conceptual: DataModelLayer;
  logical: DataModelLayer;
  physical: DataModelLayer;
  templatesAdded: number;
  objectsAdded: number;  // NEW
  message: string;
}
```

## Benefits

1. **Reusability**: Leverage existing data objects instead of creating from scratch
2. **Consistency**: Ensures objects are consistent across models
3. **Speed**: Quickly populate models with pre-defined objects
4. **Flexibility**: Choose exactly which objects to include
5. **Completeness**: Automatically includes all attributes and relationships

## Use Cases

1. **Enterprise Data Model**: Select objects from multiple domains/areas that represent enterprise-wide entities
2. **Department-Specific Models**: Filter by area to create department-specific data models
3. **System Integration**: Select objects associated with specific systems for integration models
4. **Incremental Modeling**: Start with a subset of objects and add more later

## Future Enhancements

1. **Search/Filter**: Add text search to find specific objects
2. **Bulk Selection**: Select objects by category or tags
3. **Preview**: Show attribute count and relationship count before creation
4. **Validation**: Warn about incomplete relationships (selected source but not target)
5. **Grouping**: Group objects by domain/area in the selection UI
