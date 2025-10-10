# Server Utilities Documentation

This directory contains utility functions and helpers extracted from the main routes file to improve code organization and maintainability.

## Directory Structure

```
server/utils/
├── validation_schemas.ts    - Zod validation schemas and type definitions
├── model_utils.ts           - Model-related utilities and type mappings
├── relationship_utils.ts    - Relationship management and synchronization
├── system_utils.ts          - System connection and configuration helpers
└── configuration_utils.ts   - Configuration management utilities
```

## Module Overview

### 1. validation_schemas.ts
Centralized location for all Zod validation schemas used in API endpoints.

**Key Schemas:**
- Configuration updates
- System object operations
- Relationship creation/updates
- Model object configurations
- Attribute and relationship inputs

**When to use:**
- Validating request payloads in route handlers
- Type-safe request body parsing
- Runtime validation of user inputs

### 2. model_utils.ts
Functions for working with data models across conceptual, logical, and physical layers.

**Key Functions:**
- `mapLogicalToPhysicalType()` - Type system conversions
- `resolveModelFamily()` - Link related models across layers
- `replicateObjectToLayer()` - Duplicate objects between layers
- `findConceptualRoot()` - Navigate model hierarchy

**When to use:**
- Creating new models at different layers
- Converting between data type systems
- Synchronizing model changes across layers
- Resolving model relationships

### 3. relationship_utils.ts
Comprehensive relationship management across model layers.

**Key Functions:**
- `synchronizeFamilyRelationships()` - Sync relationships across conceptual/logical/physical
- `determineRelationshipLevel()` - Detect object-level vs attribute-level relationships
- `findMatchingDataObjectRelationship()` - Find corresponding global relationships
- `removeFamilyRelationships()` - Clean up relationships across layers

**When to use:**
- Creating relationships in one layer that need to cascade to others
- Maintaining relationship consistency across model family
- Deleting relationships and ensuring proper cleanup
- Determining relationship metadata

### 4. system_utils.ts
External system integration and connection management.

**Key Functions:**
- `parseConnectionString()` - Parse database connection strings
- `buildDatabaseConfig()` - Create database connector configurations
- `testSystemConnectivity()` - Verify system connections
- `retrieveSystemMetadata()` - Fetch schema information from external systems

**Supported Systems:**
- PostgreSQL
- MySQL
- SQL Server
- Oracle
- Azure Data Lake Storage (ADLS)

**When to use:**
- Connecting to external data sources
- Testing system connectivity
- Retrieving database schemas
- Building system configurations

### 5. configuration_utils.ts
Application configuration management.

**Key Functions:**
- `upsertConfigurationEntry()` - Create or update configuration settings

**When to use:**
- Managing application settings
- User preferences
- System-wide configuration

## Usage Examples

### Validation Example
```typescript
import { createRelationshipRequestSchema } from './utils/validation_schemas';

app.post('/api/relationships', async (req, res) => {
  const result = createRelationshipRequestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error });
  }
  // Use validated data: result.data
});
```

### Model Family Resolution Example
```typescript
import { resolveModelFamily } from './utils/model_utils';

const family = await resolveModelFamily(modelId, storage);
// Access: family.conceptual, family.logical, family.physical
```

### Relationship Synchronization Example
```typescript
import { synchronizeFamilyRelationships } from './utils/relationship_utils';

await synchronizeFamilyRelationships({
  sourceObjectId: conceptualObjectId,
  targetObjectId: relatedObjectId,
  type: '1:N',
  relationshipLevel: 'object',
  modelId: conceptualModelId
}, storage);
// Automatically creates relationships in logical and physical layers
```

### System Connection Example
```typescript
import { testSystemConnectivity, buildDatabaseConfig } from './utils/system_utils';

const config = buildDatabaseConfig(connectionString, 'postgresql');
const isConnected = await testSystemConnectivity(config, storage);
```

## Design Principles

### Single Responsibility
Each module has a focused purpose:
- **validation_schemas.ts**: Input validation only
- **model_utils.ts**: Model operations only
- **relationship_utils.ts**: Relationship operations only
- **system_utils.ts**: External system integration only
- **configuration_utils.ts**: Configuration management only

### Type Safety
- All functions use TypeScript strict typing
- Exported types and interfaces for shared use
- Zod schemas provide runtime type checking

### Dependency Injection
- Functions accept `storage` parameter for database access
- No direct database imports in utility functions
- Easy to test with mock storage

### Error Handling
- Functions throw descriptive errors
- Callers responsible for error handling
- Use try-catch in route handlers

## Adding New Utilities

### Where to Add New Functions

1. **Validation Logic** → `validation_schemas.ts`
   - New Zod schemas
   - Type definitions
   - Enum definitions

2. **Model Operations** → `model_utils.ts`
   - Type conversions
   - Layer operations
   - Model hierarchy navigation
   - Data model attribute operations

3. **Relationship Operations** → `relationship_utils.ts`
   - Relationship creation/deletion
   - Family synchronization
   - Relationship detection
   - Cascade operations

4. **External Systems** → `system_utils.ts`
   - New connector types
   - Connection parsing
   - Metadata retrieval
   - Connectivity testing

5. **Configuration** → `configuration_utils.ts`
   - Configuration CRUD
   - Settings management
   - Preference handling

### Guidelines for New Functions

1. **Export Clearly**: Export all public functions and types
2. **Document**: Add JSDoc comments for complex functions
3. **Type Everything**: Use strict TypeScript typing
4. **Keep Focused**: Don't mix concerns across modules
5. **Test**: Consider adding unit tests for complex logic

## Maintenance

### When Refactoring
- Keep the single responsibility principle
- Update imports in routes.ts
- Maintain backward compatibility
- Update this documentation

### Common Patterns

#### Async Operations
Most utility functions are async because they interact with the database:
```typescript
export async function myUtility(id: number, storage: Storage) {
  const result = await storage.query(...);
  return result;
}
```

#### Type Guards
Use Zod for runtime type checking:
```typescript
const result = mySchema.safeParse(data);
if (!result.success) {
  throw new Error('Validation failed');
}
return result.data;
```

#### Error Propagation
Let errors bubble up to route handlers:
```typescript
export async function riskyOperation(storage: Storage) {
  // Don't catch errors here
  const result = await storage.query(...);
  return result;
}
```

## Performance Considerations

### Database Queries
- Use transactions for multi-step operations
- Batch queries when possible
- Index foreign keys properly

### Caching
Consider caching for:
- Model family resolutions (frequently accessed)
- System metadata (slow to retrieve)
- Configuration settings (rarely change)

### Optimization Tips
1. Minimize database round-trips
2. Use `Promise.all()` for parallel operations
3. Avoid N+1 query patterns
4. Index commonly queried columns

## Testing

### Unit Tests
Create test files for each utility module:
```
tests/
├── validation_schemas.test.ts
├── model_utils.test.ts
├── relationship_utils.test.ts
├── system_utils.test.ts
└── configuration_utils.test.ts
```

### Mocking Storage
```typescript
const mockStorage = {
  query: vi.fn(),
  // ... other methods
};

const result = await myUtility(123, mockStorage);
expect(mockStorage.query).toHaveBeenCalledWith(...);
```

## Related Documentation

- [Routes Refactoring Summary](../docs/routes-refactoring-summary.md)
- [API Documentation](../docs/api-documentation.md) (if exists)
- [Database Schema](../../shared/schema.ts)

## Support

For questions or issues with utilities:
1. Check function JSDoc comments
2. Review usage in routes.ts
3. Refer to this documentation
4. Check related test files

---

**Last Updated:** $(date)
**Maintainer:** Development Team
