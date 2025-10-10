import { aiEngine } from "../services/aiEngine";
import { modelingAgentService } from "../services/modelingAgent";
import { modelingAgentRequestSchema } from "./validation_schemas";
import type { Storage } from "../storage";

/**
 * Execute modeling agent with payload
 */
export async function executeModelingAgent(payload: any): Promise<any> {
  const validatedPayload = modelingAgentRequestSchema.parse(payload);
  const result = await modelingAgentService.run(validatedPayload);
  return result;
}

/**
 * Suggest domain classification for an object
 */
export async function suggestDomainClassification(
  objectName: string,
  attributes: any[]
): Promise<any> {
  const suggestions = await aiEngine.suggestDomainClassification(objectName, attributes);
  return suggestions;
}

/**
 * Suggest relationships between objects in a model
 */
export async function suggestRelationshipsForModel(
  modelId: number,
  layer: string,
  storage: Storage
): Promise<any[]> {
  console.log("Generating relationship suggestions for model:", modelId, "layer:", layer);
  
  const objects = await storage.getDataObjectsByModel(modelId);
  console.log("Found objects:", objects.length);
  
  const allAttributes: any[] = [];
  for (const obj of objects) {
    const attrs = await storage.getAttributesByObject(obj.id);
    allAttributes.push(...attrs);
  }
  console.log("Found attributes:", allAttributes.length);
  
  let suggestions: any[] = [];
  
  if (layer === "conceptual") {
    // For conceptual layer, suggest object-to-object relationships
    suggestions = await aiEngine.suggestRelationships(objects, allAttributes);
  } else if (layer === "logical" || layer === "physical") {
    // For logical/physical layers, base suggestions on existing conceptual relationships
    const existingRelationships = await storage.getDataModelObjectRelationshipsByModel(modelId);
    const conceptualRelationships = existingRelationships.filter(rel => !rel.sourceAttributeId && !rel.targetAttributeId);
    
    if (conceptualRelationships.length > 0) {
      // Convert conceptual relationships to attribute-level suggestions
      suggestions = await aiEngine.suggestAttributeRelationshipsFromConceptual(conceptualRelationships, objects, allAttributes);
    } else {
      // If no conceptual relationships exist, suggest direct attribute relationships
      suggestions = await aiEngine.suggestRelationships(objects, allAttributes);
    }
  }
  
  console.log("Generated suggestions:", suggestions.length);
  return suggestions;
}

/**
 * Suggest type mappings for attributes
 */
export async function suggestTypeMappings(
  conceptualType: string,
  attributeName: string,
  context?: any
): Promise<any> {
  const suggestions = await aiEngine.suggestTypeMappings(conceptualType, attributeName, context);
  return suggestions;
}

/**
 * Suggest normalization improvements for a model
 */
export async function suggestNormalizationImprovements(
  modelId: number,
  storage: Storage
): Promise<any> {
  const objects = await storage.getDataObjectsByModel(modelId);
  
  const allAttributes: any[] = [];
  for (const obj of objects) {
    const attrs = await storage.getAttributesByObject(obj.id);
    allAttributes.push(...attrs);
  }
  
  const suggestions = aiEngine.suggestNormalizationImprovements(objects, allAttributes);
  return suggestions;
}
