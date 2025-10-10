import { insertAttributeSchema } from "../../shared/schema";
import type { Storage } from "../storage";

/**
 * Map conceptual type to logical type
 */
function mapConceptualToLogicalType(conceptualType: string): string {
  const typeMap: Record<string, string> = {
    'Text': 'VARCHAR',
    'Number': 'INT',
    'Date': 'DATE',
    'Boolean': 'BOOLEAN',
    'Currency': 'DECIMAL',
    'Email': 'VARCHAR',
    'Phone': 'VARCHAR',
    'URL': 'VARCHAR',
    'Identifier': 'VARCHAR',
  };
  
  return typeMap[conceptualType] || 'VARCHAR';
}

/**
 * Map logical type to physical type (database-specific)
 */
export function mapLogicalToPhysicalType(logicalType: string): string {
  const typeMap: Record<string, string> = {
    'VARCHAR': 'VARCHAR',
    'INT': 'INTEGER',
    'BIGINT': 'BIGINT',
    'DATE': 'DATE',
    'TIMESTAMP': 'TIMESTAMP',
    'BOOLEAN': 'BOOLEAN',
    'DECIMAL': 'DECIMAL',
    'TEXT': 'TEXT',
    'CHAR': 'CHAR',
  };
  
  return typeMap[logicalType] || logicalType;
}

/**
 * Get default length for a data type
 */
export function getDefaultLength(type: string): number | null {
  const lengthMap: Record<string, number> = {
    'VARCHAR': 255,
    'CHAR': 50,
    'INT': 11,
    'BIGINT': 20,
    'DECIMAL': 10,
  };
  
  return lengthMap[type] || null;
}

/**
 * Get all attributes across all objects
 */
export async function getAllAttributes(storage: Storage): Promise<any[]> {
  const attributes = await storage.getAllAttributes();
  return attributes;
}

/**
 * Create a new attribute for an object
 */
export async function createAttribute(
  attributeData: any,
  storage: Storage
): Promise<any> {
  const validatedData = insertAttributeSchema.parse(attributeData);
  console.log('Creating attribute with data:', validatedData);
  
  const attribute = await storage.createAttribute(validatedData);
  console.log('Successfully created attribute:', attribute.id);
  
  return attribute;
}

/**
 * Update an attribute with cascading to physical layer
 */
export async function updateAttributeWithCascade(
  id: number,
  updateData: any,
  storage: Storage
): Promise<any> {
  const validatedData = insertAttributeSchema.partial().parse(updateData);
  const attribute = await storage.updateAttribute(id, validatedData);
  
  // Auto-cascade: When updating attribute in logical layer, update in physical layer
  const parentObject = await storage.getDataObject(attribute.objectId);
  if (parentObject) {
    const currentModel = await storage.getDataModel(parentObject.modelId);
    if (currentModel?.layer === "logical") {
      // Find physical layer model
      const allModels = await storage.getDataModels();
      let physicalModel = null;
      
      // Multiple scenarios for finding physical model
      physicalModel = allModels.find(m => 
        m.parentModelId === currentModel.id && 
        m.layer === "physical"
      );
      
      if (!physicalModel && currentModel.parentModelId) {
        physicalModel = allModels.find(m => 
          m.parentModelId === currentModel.parentModelId && 
          m.layer === "physical"
        );
      }
      
      if (!physicalModel) {
        const baseName = currentModel.name.replace(/\s*(logical|conceptual)\s*/i, '').trim();
        physicalModel = allModels.find(m => 
          m.layer === "physical" && 
          m.name.toLowerCase().includes(baseName.toLowerCase())
        );
      }
      
      if (physicalModel) {
        // Find corresponding object in physical layer
        const physicalObjects = await storage.getDataObjectsByModel(physicalModel.id);
        const physicalObject = physicalObjects.find(obj => obj.name === parentObject.name);
        
        if (physicalObject) {
          // Find corresponding attribute in physical layer
          const physicalAttributes = await storage.getAttributesByObject(physicalObject.id);
          const physicalAttribute = physicalAttributes.find(attr => attr.name === attribute.name);
          
          if (physicalAttribute) {
            // Update physical attribute with converted data types
            const physicalUpdateData = {
              ...validatedData,
              // Convert logical type to physical type if logical type was updated
              ...(validatedData.logicalType && {
                physicalType: mapLogicalToPhysicalType(validatedData.logicalType)
              }),
              // Ensure length is set appropriately
              ...(validatedData.logicalType && {
                length: validatedData.length || getDefaultLength(validatedData.logicalType)
              })
            };
            
            await storage.updateAttribute(physicalAttribute.id, physicalUpdateData);
          }
        }
      }
    }
  }
  
  return attribute;
}

/**
 * Delete an attribute
 */
export async function deleteAttribute(
  id: number,
  storage: Storage
): Promise<void> {
  await storage.deleteAttribute(id);
}

/**
 * Enhance attribute with layer-specific type mapping
 */
export async function enhanceAttribute(
  id: number,
  targetLayer: string,
  storage: Storage
): Promise<any> {
  const attribute = await storage.getAttribute(id);
  if (!attribute) {
    throw new Error("Attribute not found");
  }
  
  let updateData: any = {};
  
  if (targetLayer === 'logical' && attribute.conceptualType) {
    // Map conceptual to logical
    updateData.logicalType = mapConceptualToLogicalType(attribute.conceptualType);
    updateData.length = getDefaultLength(updateData.logicalType);
  } else if (targetLayer === 'physical' && attribute.logicalType) {
    // Map logical to physical
    updateData.physicalType = mapLogicalToPhysicalType(attribute.logicalType);
    updateData.length = getDefaultLength(attribute.logicalType);
  }
  
  if (Object.keys(updateData).length > 0) {
    const updatedAttribute = await storage.updateAttribute(id, updateData);
    return updatedAttribute;
  }
  
  return attribute;
}

/**
 * Bulk enhance attributes for an object
 */
export async function bulkEnhanceAttributes(
  objectId: number,
  targetLayer: string,
  storage: Storage
): Promise<any[]> {
  const attributes = await storage.getAttributesByObject(objectId);
  
  const enhancedAttributes = await Promise.all(
    attributes.map(async (attr) => {
      return enhanceAttribute(attr.id, targetLayer, storage);
    })
  );
  
  return enhancedAttributes;
}
