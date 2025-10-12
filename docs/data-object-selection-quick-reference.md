# Data Object Selection - Quick Reference

## How to Use

### Creating a Data Model with Selected Objects

1. Navigate to the Data Models page
2. Click "Create New Model" button
3. Fill in the model details:
   - **Model Name**: Enter a descriptive name
   - **Target System**: Select the target system (e.g., Snowflake, Data Lake)
   - **Domain**: Choose the data domain
   - **Data Area**: Select the specific area within the domain

4. **Select Data Objects**:
   - A list of data objects will appear based on your domain/area/system selection
   - All objects are selected by default
   - Use "Select All" checkbox to toggle all objects at once
   - Or individually check/uncheck specific objects
   - The selection count badge shows how many objects are selected

5. Click "Create Model"

### What Happens

The system will:
1. Create 4 model layers (Flow, Conceptual, Logical, Physical)
2. For each selected data object:
   - Create an instance in each layer
   - Copy all attributes to each layer
   - Preserve relationships between objects (if both source and target are selected)

### Example Workflow

**Scenario**: Creating a Customer Analytics Model

1. **Model Name**: "Customer Analytics Model"
2. **Target System**: "Snowflake"
3. **Domain**: "Customer & Sales"
4. **Data Area**: "Customer Master"

5. **Available Objects** (example):
   - ✅ Customer (selected)
   - ✅ Customer Address (selected)
   - ✅ Customer Contact (selected)
   - ❌ Customer Preferences (deselected - not needed)
   - ✅ Customer Segment (selected)

6. **Result**: Model created with 4 objects and their relationships across all layers

## Tips

### Filtering Strategy
- Start with **Domain** selection (required)
- Add **Area** for more specific filtering
- **System** filter helps when objects belong to specific systems

### Selection Best Practices
- Start with all objects selected, then deselect what you don't need
- Include related objects to maintain relationships
- If you deselect a source object, relationships to/from it won't be created

### When to Use This Feature
- ✅ **Reusing existing objects** across multiple models
- ✅ **Quick model creation** with pre-defined entities
- ✅ **Ensuring consistency** across different models
- ✅ **Building subset models** from a larger catalog

### When to Create Objects Manually
- Creating entirely new objects not in the catalog
- Need custom configurations per layer
- Working with templates (when no objects selected, templates are used)

## Troubleshooting

### No Objects Appear
- **Check**: Ensure objects exist for the selected domain
- **Check**: Verify domain/area/system filters
- **Solution**: Create objects first or select different filters

### Some Objects Missing
- **Check**: Object's domain/area/system properties
- **Solution**: Update object metadata or adjust filters

### Relationships Not Created
- **Check**: Both source and target objects must be selected
- **Solution**: Include all related objects in selection

### Model Shows No Objects After Creation
- **Check**: At least one object must be selected
- **Check**: Browser console for errors
- **Solution**: Try creating again or check server logs

## API Reference

### Endpoint
```
POST /api/models/create-with-layers
```

### Request
```json
{
  "name": "Customer Analytics Model",
  "targetSystemId": 1,
  "targetSystem": "Snowflake",
  "domainId": 2,
  "dataAreaId": 5,
  "selectedObjectIds": [10, 11, 12, 15]
}
```

### Response
```json
{
  "flow": { ... },
  "conceptual": { ... },
  "logical": { ... },
  "physical": { ... },
  "templatesAdded": 0,
  "objectsAdded": 4,
  "message": "Model created with all 4 layers and 4 selected objects with their attributes and relationships"
}
```

## Related Documentation
- [Full Feature Documentation](./data-object-selection-feature.md)
- [Data Model Architecture](./data-model-goal.md)
- [Layer Generation](./layer-generation-implementation.md)
