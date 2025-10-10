import { createRelationshipRequestSchema, updateRelationshipRequestSchema } from "./validation_schemas";
import { insertDataObjectRelationshipSchema } from "../../shared/schema";
import { synchronizeFamilyRelationships } from "./relationship_utils";
import type { Storage } from "../storage";

/**
 * Determine if relationship is object-level or attribute-level
 */
function determineRelationshipLevel(
  sourceAttributeId: number | null,
  targetAttributeId: number | null
): "object" | "attribute" {
  return sourceAttributeId !== null || targetAttributeId !== null ? "attribute" : "object";
}

/**
 * Find matching data object relationship
 */
function findMatchingDataObjectRelationship(
  relationships: any[],
  sourceObjectId: number,
  targetObjectId: number,
  relationshipLevel: "object" | "attribute",
  sourceAttributeId: number | null,
  targetAttributeId: number | null
): any | null {
  return relationships.find(rel => {
    const relLevel = rel.relationshipLevel === "attribute" ? "attribute" : "object";
    
    if (relLevel !== relationshipLevel) {
      return false;
    }
    
    if (rel.sourceDataObjectId !== sourceObjectId || rel.targetDataObjectId !== targetObjectId) {
      return false;
    }
    
    if (relationshipLevel === "attribute") {
      return (rel.sourceAttributeId ?? null) === sourceAttributeId &&
             (rel.targetAttributeId ?? null) === targetAttributeId;
    }
    
    return true;
  }) ?? null;
}

/**
 * Create a new relationship between objects
 */
export async function createRelationship(
  payload: any,
  storage: Storage
): Promise<any> {
  const validatedPayload = createRelationshipRequestSchema.parse(payload);

  if (validatedPayload.sourceObjectId === validatedPayload.targetObjectId) {
    throw new Error("Source and target objects must be different");
  }

  console.log(`[RELATIONSHIP] Looking for model layer with ID: ${validatedPayload.modelId}`);
  const model = await storage.getDataModelLayer(validatedPayload.modelId);
  console.log(`[RELATIONSHIP] Model layer found:`, model ? `Yes (${model.name})` : 'No');
  
  if (!model) {
    throw new Error("Model not found");
  }

  const modelObjects = await storage.getDataModelObjectsByModel(validatedPayload.modelId);
  console.log(`[RELATIONSHIP] Found ${modelObjects.length} objects for model layer ${validatedPayload.modelId}`);
  console.log(`[RELATIONSHIP] Looking for sourceObjectId: ${validatedPayload.sourceObjectId}, targetObjectId: ${validatedPayload.targetObjectId}`);
  console.log(`[RELATIONSHIP] Available objectIds:`, modelObjects.map(mo => mo.objectId));
  
  const sourceModelObject = modelObjects.find((modelObject) => modelObject.objectId === validatedPayload.sourceObjectId);
  const targetModelObject = modelObjects.find((modelObject) => modelObject.objectId === validatedPayload.targetObjectId);

  console.log(`[RELATIONSHIP] Source model object found:`, !!sourceModelObject);
  console.log(`[RELATIONSHIP] Target model object found:`, !!targetModelObject);

  if (!sourceModelObject || !targetModelObject) {
    throw new Error("Model objects not found for provided source/target");
  }

  // Store the global attribute IDs for the data_object_relationships table
  const globalSourceAttributeId = validatedPayload.sourceAttributeId ?? null;
  const globalTargetAttributeId = validatedPayload.targetAttributeId ?? null;
  const relationshipLevel = determineRelationshipLevel(globalSourceAttributeId, globalTargetAttributeId);

  const existingGlobalRelationships = await storage.getDataObjectRelationshipsByObject(validatedPayload.sourceObjectId);
  let dataObjectRelationship = findMatchingDataObjectRelationship(
    existingGlobalRelationships,
    validatedPayload.sourceObjectId,
    validatedPayload.targetObjectId,
    relationshipLevel,
    globalSourceAttributeId,
    globalTargetAttributeId,
  );

  if (dataObjectRelationship) {
    const updatePayload: Record<string, unknown> = {};

    if (dataObjectRelationship.type !== validatedPayload.type) {
      updatePayload.type = validatedPayload.type;
    }

    if ((dataObjectRelationship.sourceAttributeId ?? null) !== globalSourceAttributeId) {
      updatePayload.sourceAttributeId = globalSourceAttributeId;
    }

    if ((dataObjectRelationship.targetAttributeId ?? null) !== globalTargetAttributeId) {
      updatePayload.targetAttributeId = globalTargetAttributeId;
    }

    if ((dataObjectRelationship.name ?? null) !== (validatedPayload.name ?? null)) {
      updatePayload.name = validatedPayload.name ?? null;
    }

    if ((dataObjectRelationship.description ?? null) !== (validatedPayload.description ?? null)) {
      updatePayload.description = validatedPayload.description ?? null;
    }

    if (validatedPayload.metadata !== undefined) {
      updatePayload.metadata = validatedPayload.metadata ?? null;
    }

    if (
      Object.keys(updatePayload).length > 0 ||
      (dataObjectRelationship.relationshipLevel === "attribute" ? "attribute" : "object") !== relationshipLevel
    ) {
      updatePayload.relationshipLevel = relationshipLevel;
      dataObjectRelationship = await storage.updateDataObjectRelationship(
        dataObjectRelationship.id,
        insertDataObjectRelationshipSchema.partial().parse(updatePayload),
      );
    }
  } else {
    dataObjectRelationship = await storage.createDataObjectRelationship(
      insertDataObjectRelationshipSchema.parse({
        sourceDataObjectId: validatedPayload.sourceObjectId,
        targetDataObjectId: validatedPayload.targetObjectId,
        type: validatedPayload.type,
        relationshipLevel,
        sourceAttributeId: globalSourceAttributeId ?? undefined,
        targetAttributeId: globalTargetAttributeId ?? undefined,
        name: validatedPayload.name === undefined ? undefined : validatedPayload.name,
        description: validatedPayload.description === undefined ? undefined : validatedPayload.description,
        metadata: validatedPayload.metadata === undefined ? undefined : validatedPayload.metadata,
      }),
    );
  }

  const familyRelationships = await synchronizeFamilyRelationships({
    baseModel: model,
    sourceObjectId: validatedPayload.sourceObjectId,
    targetObjectId: validatedPayload.targetObjectId,
    type: validatedPayload.type,
    relationshipLevel,
    sourceAttributeId: globalSourceAttributeId,
    targetAttributeId: globalTargetAttributeId,
    sourceHandle: validatedPayload.sourceHandle ?? null,
    targetHandle: validatedPayload.targetHandle ?? null,
    name: validatedPayload.name ?? null,
    description: validatedPayload.description ?? null,
  });

  const currentRelationship = familyRelationships.get(model.id);

  return {
    ...(currentRelationship ?? {}),
    dataObjectRelationshipId: dataObjectRelationship?.id ?? null,
    syncedModelIds: Array.from(familyRelationships.keys()),
  };
}

/**
 * Update an existing relationship
 */
export async function updateRelationship(
  id: number,
  payload: any,
  storage: Storage
): Promise<any> {
  const validatedPayload = updateRelationshipRequestSchema.parse(payload);
  const existing = await storage.getDataModelObjectRelationship(id);

  if (!existing) {
    throw new Error("Relationship not found");
  }

  const [sourceModelObject, targetModelObject] = await Promise.all([
    storage.getDataModelObject(existing.sourceModelObjectId),
    storage.getDataModelObject(existing.targetModelObjectId),
  ]);

  if (!sourceModelObject || !targetModelObject) {
    throw new Error("Related model objects not found");
  }

  const model = await storage.getDataModel(existing.modelId);
  if (!model) {
    throw new Error("Model not found");
  }

  const sourceAttributeProvided = Object.prototype.hasOwnProperty.call(payload, "sourceAttributeId");
  const targetAttributeProvided = Object.prototype.hasOwnProperty.call(payload, "targetAttributeId");

  const attributeCache = new Map<number, number | null>();
  const resolveGlobalAttributeId = async (value: number | null): Promise<number | null> => {
    if (value === null || value === undefined) {
      return null;
    }
    if (attributeCache.has(value)) {
      return attributeCache.get(value)!;
    }
    const dataModelAttribute = await storage.getDataModelAttribute(value);
    if (dataModelAttribute) {
      const globalId = dataModelAttribute.attributeId ?? null;
      attributeCache.set(value, globalId);
      return globalId;
    }
    attributeCache.set(value, value);
    return value;
  };

  const existingSourceAttributeGlobal = await resolveGlobalAttributeId(existing.sourceAttributeId ?? null);
  const existingTargetAttributeGlobal = await resolveGlobalAttributeId(existing.targetAttributeId ?? null);

  const finalSourceAttributeGlobalId = sourceAttributeProvided
    ? await resolveGlobalAttributeId(validatedPayload.sourceAttributeId ?? null)
    : existingSourceAttributeGlobal;

  const finalTargetAttributeGlobalId = targetAttributeProvided
    ? await resolveGlobalAttributeId(validatedPayload.targetAttributeId ?? null)
    : existingTargetAttributeGlobal;

  const finalType = validatedPayload.type ?? existing.type;
  const finalRelationshipLevel = determineRelationshipLevel(
    finalSourceAttributeGlobalId,
    finalTargetAttributeGlobalId,
  );
  const finalName = Object.prototype.hasOwnProperty.call(payload, "name")
    ? validatedPayload.name ?? null
    : existing.name ?? null;
  const finalDescription = Object.prototype.hasOwnProperty.call(payload, "description")
    ? validatedPayload.description ?? null
    : existing.description ?? null;

  const sourceObjectId = sourceModelObject.objectId;
  const targetObjectId = targetModelObject.objectId;
  const possibleGlobalRelationships = await storage.getDataObjectRelationshipsByObject(sourceObjectId);

  let dataObjectRelationship =
    findMatchingDataObjectRelationship(
      possibleGlobalRelationships,
      sourceObjectId,
      targetObjectId,
      finalRelationshipLevel,
      finalSourceAttributeGlobalId,
      finalTargetAttributeGlobalId,
    ) ??
    findMatchingDataObjectRelationship(
      possibleGlobalRelationships,
      sourceObjectId,
      targetObjectId,
      existing.relationshipLevel === "attribute" ? "attribute" : "object",
      existingSourceAttributeGlobal,
      existingTargetAttributeGlobal,
    );

  if (dataObjectRelationship) {
    const globalUpdate: Record<string, unknown> = {};

    if (dataObjectRelationship.type !== finalType) {
      globalUpdate.type = finalType;
    }

    if (sourceAttributeProvided) {
      globalUpdate.sourceAttributeId = finalSourceAttributeGlobalId;
    }

    if (targetAttributeProvided) {
      globalUpdate.targetAttributeId = finalTargetAttributeGlobalId;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "name")) {
      globalUpdate.name = finalName;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "description")) {
      globalUpdate.description = finalDescription;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "metadata")) {
      globalUpdate.metadata = validatedPayload.metadata ?? null;
    }

    if (
      Object.keys(globalUpdate).length > 0 ||
      (dataObjectRelationship.relationshipLevel === "attribute" ? "attribute" : "object") !== finalRelationshipLevel
    ) {
      globalUpdate.relationshipLevel = finalRelationshipLevel;
      dataObjectRelationship = await storage.updateDataObjectRelationship(
        dataObjectRelationship.id,
        insertDataObjectRelationshipSchema.partial().parse(globalUpdate),
      );
    }
  } else {
    dataObjectRelationship = await storage.createDataObjectRelationship(
      insertDataObjectRelationshipSchema.parse({
        sourceDataObjectId: sourceObjectId,
        targetDataObjectId: targetObjectId,
        type: finalType,
        relationshipLevel: finalRelationshipLevel,
        sourceAttributeId: finalSourceAttributeGlobalId ?? undefined,
        targetAttributeId: finalTargetAttributeGlobalId ?? undefined,
        name: Object.prototype.hasOwnProperty.call(payload, "name")
          ? finalName
          : existing.name ?? undefined,
        description: Object.prototype.hasOwnProperty.call(payload, "description")
          ? finalDescription
          : existing.description ?? undefined,
        metadata: validatedPayload.metadata === undefined ? undefined : validatedPayload.metadata,
      }),
    );
  }

  const familyRelationships = await synchronizeFamilyRelationships({
    baseModel: model,
    sourceObjectId,
    targetObjectId,
    type: finalType,
    relationshipLevel: finalRelationshipLevel,
    sourceAttributeId: finalSourceAttributeGlobalId,
    targetAttributeId: finalTargetAttributeGlobalId,
    name: finalName,
    description: finalDescription,
  });

  const currentRelationship = familyRelationships.get(model.id);

  return {
    ...(currentRelationship ?? existing),
    dataObjectRelationshipId: dataObjectRelationship?.id ?? null,
    syncedModelIds: Array.from(familyRelationships.keys()),
  };
}

/**
 * Delete a relationship and clean up related data
 */
export async function deleteRelationship(
  id: number,
  storage: Storage
): Promise<void> {
  const existing = await storage.getDataModelObjectRelationship(id);

  if (!existing) {
    throw new Error("Relationship not found");
  }

  const [sourceModelObject, targetModelObject] = await Promise.all([
    storage.getDataModelObject(existing.sourceModelObjectId),
    storage.getDataModelObject(existing.targetModelObjectId),
  ]);

  const model = await storage.getDataModel(existing.modelId);
  if (!model) {
    throw new Error("Model not found");
  }

  const attributeCache = new Map<number, number | null>();
  const resolveGlobalAttributeId = async (value: number | null): Promise<number | null> => {
    if (value === null || value === undefined) {
      return null;
    }
    if (attributeCache.has(value)) {
      return attributeCache.get(value)!;
    }
    const dataModelAttribute = await storage.getDataModelAttribute(value);
    if (dataModelAttribute) {
      const globalId = dataModelAttribute.attributeId ?? null;
      attributeCache.set(value, globalId);
      return globalId;
    }
    attributeCache.set(value, value);
    return value;
  };

  await storage.deleteDataModelObjectRelationship(id);

  const sourceObjectId = sourceModelObject?.objectId ?? null;
  const targetObjectId = targetModelObject?.objectId ?? null;

  const sourceAttributeGlobalId = await resolveGlobalAttributeId(existing.sourceAttributeId ?? null);
  const targetAttributeGlobalId = await resolveGlobalAttributeId(existing.targetAttributeId ?? null);

  if (sourceObjectId && targetObjectId) {
    const relationshipLevel = existing.relationshipLevel === "attribute" ? "attribute" : "object";
    
    // Get related models to clean up
    const relatedModels = await storage.getDataModels();
    const familyModels = relatedModels.filter(m => 
      m.id === model.id || 
      m.parentModelId === model.id || 
      (model.parentModelId && m.parentModelId === model.parentModelId)
    );

    for (const familyModel of familyModels) {
      const familyRelationships = await storage.getDataModelObjectRelationshipsByModel(familyModel.id);
      const matchingRels = familyRelationships.filter(rel => {
        const relSourceObj = rel.sourceModelObjectId;
        const relTargetObj = rel.targetModelObjectId;
        
        // Check if it's the same relationship pattern
        return rel.id !== id && 
               (rel.relationshipLevel === "attribute" ? "attribute" : "object") === relationshipLevel;
      });

      for (const rel of matchingRels) {
        await storage.deleteDataModelObjectRelationship(rel.id);
      }
    }
  }
}
