import { storage } from "../storage";
import type {
  DataModel,
  DataModelObject,
  DataModelAttribute,
  DataModelObjectRelationship,
  DataObjectRelationship,
  InsertDataModelObjectRelationship,
  InsertDataObjectRelationship,
} from "@shared/schema";
import { resolveModelFamily, findDataModelAttributeId } from "./model_utils";
import type { RelationshipLevel } from "./validation_schemas";

export function determineRelationshipLevel(
  sourceAttributeId: number | null,
  targetAttributeId: number | null,
): RelationshipLevel {
  return sourceAttributeId !== null && targetAttributeId !== null ? "attribute" : "object";
}

export function buildRelationshipKey(
  sourceObjectId: number,
  targetObjectId: number,
  relationshipLevel: RelationshipLevel,
  sourceAttributeId: number | null,
  targetAttributeId: number | null,
): string {
  return [
    sourceObjectId,
    targetObjectId,
    relationshipLevel,
    sourceAttributeId ?? "null",
    targetAttributeId ?? "null",
  ].join("|");
}

export function findMatchingDataObjectRelationship(
  relationships: DataObjectRelationship[],
  sourceObjectId: number,
  targetObjectId: number,
  relationshipLevel: RelationshipLevel,
  sourceAttributeId: number | null,
  targetAttributeId: number | null,
): DataObjectRelationship | undefined {
  const match = relationships.find(
    (relationship) =>
      relationship.sourceDataObjectId === sourceObjectId &&
      relationship.targetDataObjectId === targetObjectId &&
      relationship.relationshipLevel === relationshipLevel &&
      (relationship.sourceAttributeId ?? null) === sourceAttributeId &&
      (relationship.targetAttributeId ?? null) === targetAttributeId,
  );

  if (match) {
    return match;
  }

  return relationships.find(
    (relationship) =>
      relationship.sourceDataObjectId === targetObjectId &&
      relationship.targetDataObjectId === sourceObjectId &&
      relationship.relationshipLevel === relationshipLevel &&
      (relationship.sourceAttributeId ?? null) === targetAttributeId &&
      (relationship.targetAttributeId ?? null) === sourceAttributeId,
  );
}

export interface RelationshipSyncInput {
  baseModel: DataModel;
  sourceObjectId: number;
  targetObjectId: number;
  type: string;
  relationshipLevel: RelationshipLevel;
  sourceAttributeId: number | null;
  targetAttributeId: number | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  name?: string | null;
  description?: string | null;
}

export async function synchronizeFamilyRelationships(
  params: RelationshipSyncInput,
): Promise<Map<number, DataModelObjectRelationship>> {
  const family = await resolveModelFamily(params.baseModel);
  const dataModelAttributes = await storage.getDataModelAttributes();
  const relationshipsByModelId = new Map<number, DataModelObjectRelationship>();
  const modelObjectsCache = new Map<number, DataModelObject[]>();
  const relationshipsCache = new Map<number, DataModelObjectRelationship[]>();

  const getModelObjects = async (modelId: number): Promise<DataModelObject[]> => {
    if (!modelObjectsCache.has(modelId)) {
      modelObjectsCache.set(modelId, await storage.getDataModelObjectsByModel(modelId));
    }
    return modelObjectsCache.get(modelId)!;
  };

  const getModelRelationships = async (modelId: number): Promise<DataModelObjectRelationship[]> => {
    if (!relationshipsCache.has(modelId)) {
      relationshipsCache.set(modelId, await storage.getDataModelObjectRelationshipsByModel(modelId));
    }
    return relationshipsCache.get(modelId)!;
  };

  const updateRelationshipCache = (modelId: number, relationships: DataModelObjectRelationship[]) => {
    relationshipsCache.set(modelId, relationships);
  };

  const modelsToSync = [family.conceptual, family.logical, family.physical].filter(
    (entry): entry is DataModel => Boolean(entry),
  );

  for (const modelToSync of modelsToSync) {
    const modelObjects = await getModelObjects(modelToSync.id);
    const sourceModelObject = modelObjects.find((entry) => entry.objectId === params.sourceObjectId);
    const targetModelObject = modelObjects.find((entry) => entry.objectId === params.targetObjectId);

    if (!sourceModelObject || !targetModelObject) {
      continue;
    }

    let expectedLevel: RelationshipLevel = params.relationshipLevel;
    let sourceModelAttributeId: number | undefined;
    let targetModelAttributeId: number | undefined;

    if (
      expectedLevel === "attribute" &&
      params.sourceAttributeId !== null &&
      params.targetAttributeId !== null
    ) {
      sourceModelAttributeId = findDataModelAttributeId(
        dataModelAttributes,
        modelToSync.id,
        sourceModelObject.id,
        params.sourceAttributeId,
      );
      targetModelAttributeId = findDataModelAttributeId(
        dataModelAttributes,
        modelToSync.id,
        targetModelObject.id,
        params.targetAttributeId,
      );

      if (!sourceModelAttributeId || !targetModelAttributeId) {
        console.log(`Model attributes not found for model ${modelToSync.id}, creating them...`);
        
        if (!sourceModelAttributeId && params.sourceAttributeId) {
          const globalAttr = await storage.getAttribute(params.sourceAttributeId);
          if (globalAttr) {
            const newModelAttr = await storage.createDataModelAttribute({
              attributeId: params.sourceAttributeId,
              modelObjectId: sourceModelObject.id,
              modelId: modelToSync.id,
              conceptualType: globalAttr.conceptualType,
              logicalType: globalAttr.logicalType,
              physicalType: globalAttr.physicalType,
              nullable: globalAttr.nullable,
              isPrimaryKey: globalAttr.isPrimaryKey,
              isForeignKey: globalAttr.isForeignKey,
              orderIndex: globalAttr.orderIndex,
            });
            sourceModelAttributeId = newModelAttr.id;
            dataModelAttributes.push(newModelAttr);
          }
        }
        
        if (!targetModelAttributeId && params.targetAttributeId) {
          const globalAttr = await storage.getAttribute(params.targetAttributeId);
          if (globalAttr) {
            const newModelAttr = await storage.createDataModelAttribute({
              attributeId: params.targetAttributeId,
              modelObjectId: targetModelObject.id,
              modelId: modelToSync.id,
              conceptualType: globalAttr.conceptualType,
              logicalType: globalAttr.logicalType,
              physicalType: globalAttr.physicalType,
              nullable: globalAttr.nullable,
              isPrimaryKey: globalAttr.isPrimaryKey,
              isForeignKey: globalAttr.isForeignKey,
              orderIndex: globalAttr.orderIndex,
            });
            targetModelAttributeId = newModelAttr.id;
            dataModelAttributes.push(newModelAttr);
          }
        }
        
        if (!sourceModelAttributeId || !targetModelAttributeId) {
          expectedLevel = "object";
        }
      }
    } else {
      expectedLevel = "object";
    }

    const existingRelationships = await getModelRelationships(modelToSync.id);
    const levelMatches = (relationship: DataModelObjectRelationship): boolean => {
      const currentLevel: RelationshipLevel =
        relationship.relationshipLevel === "attribute" ? "attribute" : "object";
      if (expectedLevel === "attribute") {
        return (
          currentLevel === "attribute" &&
          (relationship.sourceAttributeId ?? undefined) === sourceModelAttributeId &&
          (relationship.targetAttributeId ?? undefined) === targetModelAttributeId
        );
      }
      return currentLevel === "object";
    };

    const existing = existingRelationships.find(
      (relationship) =>
        relationship.sourceModelObjectId === sourceModelObject.id &&
        relationship.targetModelObjectId === targetModelObject.id &&
        levelMatches(relationship),
    );

    if (existing) {
      const updatePayload: Partial<InsertDataModelObjectRelationship> = {};
      if (existing.type !== params.type) {
        updatePayload.type = params.type;
      }

      const currentLevel: RelationshipLevel =
        existing.relationshipLevel === "attribute" ? "attribute" : "object";
      if (currentLevel !== expectedLevel) {
        updatePayload.relationshipLevel = expectedLevel;
      }

      if ((existing.sourceAttributeId ?? undefined) !== sourceModelAttributeId) {
        updatePayload.sourceAttributeId = sourceModelAttributeId;
      }

      if ((existing.targetAttributeId ?? undefined) !== targetModelAttributeId) {
        updatePayload.targetAttributeId = targetModelAttributeId;
      }

      if ((existing.sourceHandle ?? null) !== (params.sourceHandle ?? null)) {
        updatePayload.sourceHandle = params.sourceHandle ?? null;
      }

      if ((existing.targetHandle ?? null) !== (params.targetHandle ?? null)) {
        updatePayload.targetHandle = params.targetHandle ?? null;
      }

      if ((existing.name ?? null) !== (params.name ?? null)) {
        updatePayload.name = params.name ?? null;
      }

      if ((existing.description ?? null) !== (params.description ?? null)) {
        updatePayload.description = params.description ?? null;
      }

      if (Object.keys(updatePayload).length > 0) {
        const updated = await storage.updateDataModelObjectRelationship(existing.id, updatePayload);
        relationshipsByModelId.set(modelToSync.id, updated);
        updateRelationshipCache(
          modelToSync.id,
          existingRelationships.map((entry) => (entry.id === updated.id ? updated : entry)),
        );
      } else {
        relationshipsByModelId.set(modelToSync.id, existing);
      }

      continue;
    }

    const created = await storage.createDataModelObjectRelationship({
      sourceModelObjectId: sourceModelObject.id,
      targetModelObjectId: targetModelObject.id,
      type: params.type,
      relationshipLevel: expectedLevel,
      sourceAttributeId: sourceModelAttributeId,
      targetAttributeId: targetModelAttributeId,
      sourceHandle: params.sourceHandle ?? undefined,
      targetHandle: params.targetHandle ?? undefined,
      modelId: modelToSync.id,
      layer: modelToSync.layer as "conceptual" | "logical" | "physical",
      name: params.name === undefined ? undefined : params.name,
      description: params.description === undefined ? undefined : params.description,
    });

    relationshipsByModelId.set(modelToSync.id, created);
    updateRelationshipCache(modelToSync.id, [...existingRelationships, created]);
  }

  return relationshipsByModelId;
}

export async function removeFamilyRelationships(params: RelationshipSyncInput): Promise<void> {
  const family = await resolveModelFamily(params.baseModel);
  const dataModelAttributes = await storage.getDataModelAttributes();
  const modelsToSync = [family.conceptual, family.logical, family.physical].filter(
    (entry): entry is DataModel => Boolean(entry),
  );

  for (const modelToSync of modelsToSync) {
    const modelObjects = await storage.getDataModelObjectsByModel(modelToSync.id);
    const sourceModelObject = modelObjects.find((entry) => entry.objectId === params.sourceObjectId);
    const targetModelObject = modelObjects.find((entry) => entry.objectId === params.targetObjectId);

    if (!sourceModelObject || !targetModelObject) {
      continue;
    }

    let expectedLevel: RelationshipLevel = params.relationshipLevel;
    let sourceModelAttributeId: number | undefined;
    let targetModelAttributeId: number | undefined;

    if (
      expectedLevel === "attribute" &&
      params.sourceAttributeId !== null &&
      params.targetAttributeId !== null
    ) {
      sourceModelAttributeId = findDataModelAttributeId(
        dataModelAttributes,
        modelToSync.id,
        sourceModelObject.id,
        params.sourceAttributeId,
      );
      targetModelAttributeId = findDataModelAttributeId(
        dataModelAttributes,
        modelToSync.id,
        targetModelObject.id,
        params.targetAttributeId,
      );

      if (!sourceModelAttributeId || !targetModelAttributeId) {
        expectedLevel = "object";
      }
    } else {
      expectedLevel = "object";
    }

    const relationships = await storage.getDataModelObjectRelationshipsByModel(modelToSync.id);

    const matches = relationships.filter((relationship) => {
      if (
        relationship.sourceModelObjectId !== sourceModelObject.id ||
        relationship.targetModelObjectId !== targetModelObject.id
      ) {
        return false;
      }

      const currentLevel: RelationshipLevel =
        relationship.relationshipLevel === "attribute" ? "attribute" : "object";

      if (expectedLevel === "attribute") {
        return (
          currentLevel === "attribute" &&
          (relationship.sourceAttributeId ?? undefined) === sourceModelAttributeId &&
          (relationship.targetAttributeId ?? undefined) === targetModelAttributeId
        );
      }

      return currentLevel === "object";
    });

    await Promise.all(matches.map((relationship) => storage.deleteDataModelObjectRelationship(relationship.id)));
  }
}
