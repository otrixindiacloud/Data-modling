#!/bin/bash

# Script to extract utility functions from routes.ts to separate utils files
# This keeps routes.ts as a single file but moves helper code to utils/

BACKUP_FILE="/workspaces/Data-modling/server/routes.ts.backup"
UTILS_DIR="/workspaces/Data-modling/server/utils"

echo "Creating utils directory structure..."
mkdir -p "$UTILS_DIR"

echo "Creating validation_schemas.ts..."
cat > "$UTILS_DIR/validation_schemas.ts" << 'EOF'
import { z } from "zod";

// Configuration schemas
export const configurationUpdateSchema = z
  .object({
    value: z.any().optional(),
    description: z.string().optional(),
  })
  .refine((data) => data.value !== undefined || data.description !== undefined, {
    message: "At least one of value or description is required",
  });

export const systemObjectUpdateSchema = z.object({
  domainId: z.number().int().positive().nullable().optional(),
  dataAreaId: z.number().int().positive().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const systemSyncRequestSchema = z.object({
  modelId: z.number().int().positive(),
  direction: z.enum(["source", "target"] as const).default("source").optional(),
  includeAttributes: z.boolean().default(true).optional(),
  domainId: z.number().int().positive().nullable().optional(),
  dataAreaId: z.number().int().positive().nullable().optional(),
  metadataOnly: z.boolean().default(false).optional(),
});

export const modelingAgentRequestSchema = z
  .object({
    rootModelId: z.number().int().positive().optional(),
    modelName: z.string().min(1).optional(),
    businessDescription: z.string().min(1),
    instructions: z.string().min(1),
    targetDatabase: z.string().min(1).optional(),
    sqlPlatforms: z.array(z.string().min(1)).optional(),
    allowDrop: z.boolean().optional(),
    generateSql: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.rootModelId) || Boolean(data.modelName), {
    message: "Provide either rootModelId or modelName",
    path: ["rootModelId"],
  });

export const relationshipTypeEnum = z.enum(["1:1", "1:N", "N:1", "N:M", "M:N"] as const);

export const createRelationshipRequestSchema = z.object({
  sourceObjectId: z.number().int().positive(),
  targetObjectId: z.number().int().positive(),
  type: relationshipTypeEnum,
  modelId: z.number().int().positive(),
  sourceAttributeId: z.number().int().positive().nullable().optional(),
  targetAttributeId: z.number().int().positive().nullable().optional(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
});

export const updateRelationshipRequestSchema = z
  .object({
    type: relationshipTypeEnum.optional(),
    sourceAttributeId: z.number().int().positive().nullable().optional(),
    targetAttributeId: z.number().int().positive().nullable().optional(),
    sourceHandle: z.string().nullable().optional(),
    targetHandle: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const modelObjectConfigSchema = z
  .object({
    position: positionSchema.nullable().optional(),
    targetSystemId: z.number().int().positive().nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
    isVisible: z.boolean().optional(),
    layerSpecificConfig: z.record(z.any()).nullable().optional(),
  })
  .partial();

export const perLayerModelObjectConfigSchema = z
  .object({
    conceptual: modelObjectConfigSchema.optional(),
    logical: modelObjectConfigSchema.optional(),
    physical: modelObjectConfigSchema.optional(),
  })
  .partial();

export const attributeInputSchema = z
  .object({
    name: z.string().min(1),
    conceptualType: z.string().nullable().optional(),
    logicalType: z.string().nullable().optional(),
    physicalType: z.string().nullable().optional(),
    dataType: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    nullable: z.boolean().optional(),
    isPrimaryKey: z.boolean().optional(),
    isForeignKey: z.boolean().optional(),
    length: z.number().int().nullable().optional(),
    precision: z.number().int().nullable().optional(),
    scale: z.number().int().nullable().optional(),
    orderIndex: z.number().int().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

export const relationshipInputSchema = z
  .object({
    targetObjectId: z.number().int().positive(),
    type: relationshipTypeEnum.default("1:N").optional(),
    relationshipLevel: z.enum(["object", "attribute"] as const).optional(),
    sourceAttributeName: z.string().nullable().optional(),
    targetAttributeName: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
  })
  .strict();

export type AttributeInput = z.infer<typeof attributeInputSchema>;
export type RelationshipInput = z.infer<typeof relationshipInputSchema>;
export type ModelObjectConfigInput = z.infer<typeof modelObjectConfigSchema>;
export type SystemObjectDirection = "source" | "target";
export type RelationshipLevel = "object" | "attribute";
export type ModelLayer = "conceptual" | "logical" | "physical";
EOF

echo "Creating model_utils.ts..."
cat > "$UTILS_DIR/model_utils.ts" << 'EOF'
import { storage } from "../storage";
import type {
  DataModel,
  DataModelObject,
  DataModelAttribute,
  DataModelObjectRelationship,
  DataObject,
  Attribute,
  InsertDataObject,
  InsertAttribute,
  InsertDataModelObject,
  InsertDataModelAttribute,
} from "@shared/schema";
import type { AttributeInput, ModelObjectConfigInput, ModelLayer } from "./validation_schemas";

// Data type mapping functions
export function mapLogicalToPhysicalType(logicalType: string | null): string {
  if (!logicalType) return "VARCHAR(255)";
  
  const typeMap: { [key: string]: string } = {
    "VARCHAR": "VARCHAR(255)",
    "INTEGER": "INT",
    "DECIMAL": "DECIMAL(10,2)",
    "DATE": "DATE",
    "DATETIME": "DATETIME",
    "BOOLEAN": "TINYINT(1)",
    "TEXT": "TEXT",
    "BLOB": "BLOB",
    "JSON": "JSON",
    "UUID": "CHAR(36)",
    "ENUM": "ENUM",
    "Text": "VARCHAR(255)",
    "Number": "INTEGER",
    "Date": "DATE",
    "DateTime": "TIMESTAMP",
    "Time": "TIME",
    "Boolean": "BOOLEAN",
    "Binary": "BLOB",
    "Email": "VARCHAR(255)",
    "Phone": "VARCHAR(20)",
    "URL": "VARCHAR(500)",
    "Currency": "DECIMAL(12,2)",
    "Percentage": "DECIMAL(5,2)",
    "Integer": "INTEGER",
    "BigInteger": "BIGINT",
    "Float": "FLOAT",
    "Double": "DOUBLE",
    "String": "VARCHAR(255)",
    "LongText": "TEXT",
    "MediumText": "MEDIUMTEXT"
  };
  
  return typeMap[logicalType] || "VARCHAR(255)";
}

export function mapConceptualToLogicalType(conceptualType: string | null): string {
  if (!conceptualType) return "VARCHAR";
  
  const typeMap: { [key: string]: string } = {
    "Text": "VARCHAR",
    "Number": "INTEGER",
    "Date": "DATE",
    "Boolean": "BOOLEAN",
    "Currency": "DECIMAL",
    "Percentage": "DECIMAL",
    "Email": "VARCHAR",
    "Phone": "VARCHAR",
    "URL": "VARCHAR",
    "Image": "VARCHAR",
    "Document": "VARCHAR",
    "Location": "VARCHAR"
  };
  
  return typeMap[conceptualType] || "VARCHAR";
}

export function getDefaultLength(dataType: string | null): number | null {
  if (!dataType) return null;
  
  const lengthMap: { [key: string]: number } = {
    "Text": 255,
    "String": 255,
    "Email": 255,
    "Phone": 20,
    "URL": 500,
    "UUID": 36,
    "Currency": 12,
    "Percentage": 5,
    "Decimal": 10
  };
  
  return lengthMap[dataType] || null;
}

// Model family resolution
export interface ModelFamily {
  conceptual: DataModel;
  logical?: DataModel;
  physical?: DataModel;
  members: DataModel[];
}

export function findConceptualRoot(
  model: DataModel,
  modelById: Map<number, DataModel>,
): DataModel {
  let current: DataModel = model;
  const visited = new Set<number>();

  while (current.layer !== "conceptual" && current.parentModelId) {
    const parentId = current.parentModelId;
    if (visited.has(parentId)) {
      break;
    }

    visited.add(parentId);
    const parent = modelById.get(parentId);
    if (!parent) {
      break;
    }
    current = parent;
  }

  return current.layer === "conceptual" ? current : model;
}

export async function resolveModelFamily(model: DataModel): Promise<ModelFamily> {
  const allModels = await storage.getDataModels();
  const modelById = new Map(allModels.map((entry) => [entry.id, entry]));
  const conceptualRoot = findConceptualRoot(model, modelById);

  const members = allModels.filter((candidate) => {
    const candidateRoot = findConceptualRoot(candidate, modelById);
    return candidateRoot.id === conceptualRoot.id;
  });

  let logical = members.find((entry) => entry.layer === "logical");
  let physical = members.find((entry) => entry.layer === "physical");

  if (model.layer === "logical") {
    logical = model;
  }

  if (model.layer === "physical") {
    physical = model;
  }

  return {
    conceptual: conceptualRoot,
    logical,
    physical,
    members,
  };
}

export function findDataModelAttributeId(
  attributes: DataModelAttribute[],
  modelId: number,
  modelObjectId: number,
  attributeId: number,
): number | undefined {
  const match = attributes.find(
    (entry) => entry.modelId === modelId && entry.modelObjectId === modelObjectId && entry.attributeId === attributeId,
  );
  return match?.id;
}

export interface LayerCreationResult {
  layer: ModelLayer;
  model: DataModel;
  object: DataObject;
  modelObject: DataModelObject;
  attributes: Attribute[];
  dataModelAttributes: DataModelAttribute[];
}

export function mergeLayerConfig(base: ModelObjectConfigInput, override?: ModelObjectConfigInput): ModelObjectConfigInput {
  if (!override) {
    return base;
  }

  const merged: ModelObjectConfigInput = {
    ...base,
  };

  if (override.position !== undefined) {
    merged.position = override.position;
  }
  if (override.targetSystemId !== undefined) {
    merged.targetSystemId = override.targetSystemId;
  }
  if (override.metadata !== undefined) {
    merged.metadata = override.metadata;
  }
  if (override.isVisible !== undefined) {
    merged.isVisible = override.isVisible;
  }
  if (override.layerSpecificConfig !== undefined) {
    merged.layerSpecificConfig = override.layerSpecificConfig;
  }

  return merged;
}

export async function replicateObjectToLayer(params: {
  layer: ModelLayer;
  conceptualModel: DataModel;
  conceptualObject: DataObject;
  targetModel: DataModel;
  baseObjectPayload: InsertDataObject;
  attributeInputs: AttributeInput[];
  config: ModelObjectConfigInput;
  modelObjectsCache: Map<number, DataModelObject[]>;
  attributesCache: Map<number, Attribute[]>;
}): Promise<LayerCreationResult> {
  const {
    layer,
    conceptualModel,
    conceptualObject,
    targetModel,
    baseObjectPayload,
    attributeInputs,
    config,
    modelObjectsCache,
    attributesCache,
  } = params;

  const metadataBase =
    typeof baseObjectPayload.metadata === "object" && baseObjectPayload.metadata !== null
      ? { ...baseObjectPayload.metadata }
      : {};

  const clonePayload: InsertDataObject = {
    ...baseObjectPayload,
    modelId: targetModel.id,
    metadata: {
      ...metadataBase,
      originConceptualObjectId: conceptualObject.id,
      originConceptualModelId: conceptualModel.id,
    },
    position: config.position ?? baseObjectPayload.position ?? null,
  };

  if (config.targetSystemId !== undefined) {
    clonePayload.targetSystemId = config.targetSystemId;
  } else if (targetModel.targetSystemId !== null && targetModel.targetSystemId !== undefined) {
    clonePayload.targetSystemId = targetModel.targetSystemId;
  }

  const clonedObject = await storage.createDataObject(clonePayload);

  const modelObjectPayload: InsertDataModelObject = {
    objectId: clonedObject.id,
    modelId: targetModel.id,
    targetSystemId:
      config.targetSystemId ??
      clonePayload.targetSystemId ??
      (targetModel.targetSystemId ?? null),
    position: config.position ?? clonePayload.position ?? null,
    metadata: {
      ...(config.metadata ?? {}),
      originConceptualObjectId: conceptualObject.id,
      originConceptualModelId: conceptualModel.id,
      layer,
    },
    isVisible: config.isVisible ?? true,
    layerSpecificConfig: {
      ...(config.layerSpecificConfig ?? {}),
      layer,
      originConceptualObjectId: conceptualObject.id,
      originConceptualModelId: conceptualModel.id,
    },
  } satisfies InsertDataModelObject;

  const modelObject = await storage.createDataModelObject(modelObjectPayload);

  if (!modelObjectsCache.has(targetModel.id)) {
    modelObjectsCache.set(targetModel.id, []);
  }
  modelObjectsCache.get(targetModel.id)!.push(modelObject);

  const createdAttributes: Attribute[] = [];
  const createdDataModelAttributes: DataModelAttribute[] = [];

  for (let index = 0; index < attributeInputs.length; index++) {
    const attributeInput = attributeInputs[index];

    const attributePayload: InsertAttribute = {
      name: attributeInput.name,
      objectId: clonedObject.id,
      conceptualType:
        attributeInput.conceptualType ??
        attributeInput.logicalType ??
        attributeInput.physicalType ??
        attributeInput.dataType ??
        undefined,
      logicalType:
        attributeInput.logicalType ??
        attributeInput.conceptualType ??
        attributeInput.physicalType ??
        attributeInput.dataType ??
        undefined,
      physicalType:
        attributeInput.physicalType ??
        attributeInput.logicalType ??
        attributeInput.conceptualType ??
        attributeInput.dataType ??
        undefined,
      dataType: attributeInput.dataType ?? undefined,
      length: attributeInput.length ?? undefined,
      precision: attributeInput.precision ?? undefined,
      scale: attributeInput.scale ?? undefined,
      nullable: attributeInput.nullable,
      isPrimaryKey: attributeInput.isPrimaryKey,
      isForeignKey: attributeInput.isForeignKey,
      orderIndex: attributeInput.orderIndex ?? index,
      description: attributeInput.description ?? undefined,
    } satisfies InsertAttribute;

    const attribute = await storage.createAttribute(attributePayload);
    createdAttributes.push(attribute);

    if (!attributesCache.has(clonedObject.id)) {
      attributesCache.set(clonedObject.id, []);
    }
    attributesCache.get(clonedObject.id)!.push(attribute);

    const dataModelAttributePayload: InsertDataModelAttribute = {
      attributeId: attribute.id,
      modelObjectId: modelObject.id,
      modelId: targetModel.id,
      conceptualType: attributeInput.conceptualType ?? attribute.conceptualType ?? null,
      logicalType: attributeInput.logicalType ?? attribute.logicalType ?? null,
      physicalType: attributeInput.physicalType ?? attribute.physicalType ?? null,
      nullable: attributeInput.nullable ?? attribute.nullable ?? true,
      isPrimaryKey: attributeInput.isPrimaryKey ?? attribute.isPrimaryKey ?? false,
      isForeignKey: attributeInput.isForeignKey ?? attribute.isForeignKey ?? false,
      orderIndex: attributeInput.orderIndex ?? attribute.orderIndex ?? index,
      layerSpecificConfig: {
        ...(attributeInput.metadata ?? {}),
        originConceptualObjectId: conceptualObject.id,
        originConceptualModelId: conceptualModel.id,
        originConceptualAttributeName: attributeInput.name,
      },
    } satisfies InsertDataModelAttribute;

    const dataModelAttribute = await storage.createDataModelAttribute(dataModelAttributePayload);
    createdDataModelAttributes.push(dataModelAttribute);
  }

  return {
    layer,
    model: targetModel,
    object: clonedObject,
    modelObject,
    attributes: createdAttributes,
    dataModelAttributes: createdDataModelAttributes,
  } satisfies LayerCreationResult;
}
EOF

echo "Creating relationship_utils.ts..."
cat > "$UTILS_DIR/relationship_utils.ts" << 'EOF'
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
EOF

echo "Creating system_utils.ts..."
cat > "$UTILS_DIR/system_utils.ts" << 'EOF'
import { dataConnectors, type ADLSConnectionConfig, type DatabaseConnectionConfig, type TableMetadata } from "../services/dataConnectors";
import type { System } from "@shared/schema";

export function coerceNumericId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

export function extractPreferredDomainId(system: System, override?: number | null): number | null {
  if (typeof override === "number") {
    return override;
  }

  const configuration = (system.configuration ?? {}) as Record<string, unknown>;
  const direct = coerceNumericId(configuration.domainId);
  if (direct !== null) {
    return direct;
  }

  const domainIds = Array.isArray(configuration.domainIds)
    ? (configuration.domainIds as unknown[])
        .map((value) => coerceNumericId(value))
        .filter((value): value is number => value !== null)
    : [];

  if (domainIds.length > 0) {
    return domainIds[0];
  }

  return null;
}

export function extractPreferredDataAreaIds(system: System, override?: number[] | null): number[] {
  if (override && override.length) {
    return override.filter((value) => Number.isFinite(value));
  }

  const configuration = (system.configuration ?? {}) as Record<string, unknown>;
  const areaIds = Array.isArray(configuration.dataAreaIds)
    ? (configuration.dataAreaIds as unknown[])
        .map((value) => coerceNumericId(value))
        .filter((value): value is number => value !== null)
    : [];

  return areaIds;
}

export function mapToDatabaseConnectorType(type?: string): DatabaseConnectionConfig["type"] {
  const normalized = (type ?? "").toLowerCase();
  if (normalized.includes("postgres")) {
    return "postgres";
  }
  if (normalized.includes("mysql") || normalized.includes("maria")) {
    return "mysql";
  }
  if (normalized.includes("hana")) {
    return "sap_hana";
  }
  if (normalized.includes("oracle")) {
    return "oracle";
  }
  if ((normalized.includes("sql") || normalized.includes("mssql")) && !normalized.includes("nosql")) {
    return "sql_server";
  }
  return "generic_sql";
}

export function parseConnectionString(connectionString?: string | null): DatabaseConnectionConfig | null {
  if (!connectionString) {
    return null;
  }

  const trimmed = connectionString.trim();

  if (trimmed.includes("://")) {
    try {
      const uri = new URL(trimmed);
      const protocol = uri.protocol.replace(":", "");
      const mappedType = mapToDatabaseConnectorType(protocol);
      const defaultPorts: Record<DatabaseConnectionConfig["type"], number> = {
        sql_server: 1433,
        postgres: 5432,
        mysql: 3306,
        oracle: 1521,
        sap_hana: 30015,
        generic_sql: 1433,
      };

      const database = decodeURIComponent(uri.pathname.replace(/^\//, "")) || "default";
      const username = decodeURIComponent(uri.username || "");
      const password = decodeURIComponent(uri.password || "");
      const host = uri.hostname;
      const port = uri.port ? Number(uri.port) : defaultPorts[mappedType] ?? 1433;
      const sslMode = uri.searchParams.get("sslmode") ?? undefined;
      const schema = uri.searchParams.get("schema") ?? undefined;

      if (!host || !username) {
        return null;
      }

      return {
        type: mappedType,
        host,
        port,
        database,
        username,
        password,
        sslMode,
        schema,
      } satisfies DatabaseConnectionConfig;
    } catch (error) {
      console.warn("Failed to parse connection URI, falling back to key-value parser:", error);
    }
  }

  const segments = trimmed
    .split(";")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const values = new Map<string, string>();
  for (const segment of segments) {
    const [key, ...rest] = segment.split("=");
    if (!key || rest.length === 0) continue;
    values.set(key.trim().toLowerCase(), rest.join("=").trim());
  }

  const host = values.get("server") ?? values.get("data source") ?? values.get("host");
  const database = values.get("database") ?? values.get("initial catalog") ?? "default";
  const username = values.get("user id") ?? values.get("uid") ?? values.get("username");
  const password = values.get("password") ?? values.get("pwd") ?? "";
  const portValue = values.get("port");
  const port = portValue ? Number(portValue) : NaN;

  if (!host || !username) {
    return null;
  }

  return {
    type: "sql_server",
    host,
    port: Number.isFinite(port) ? Number(port) : 1433,
    database,
    username,
    password,
  } satisfies DatabaseConnectionConfig;
}

export function buildDatabaseConfig(
  configuration: Record<string, unknown> | null | undefined,
  connectionString?: string | null,
  systemType?: string
): DatabaseConnectionConfig | null {
  if (configuration) {
    const host = (configuration.host as string) ?? (configuration.hostname as string);
    const username = (configuration.username as string) ?? (configuration.user as string) ?? (configuration.userName as string);

    if (host && username) {
      const database = (configuration.database as string) ?? (configuration.db as string) ?? "default";
      const portRaw = configuration.port ?? configuration.portNumber ?? configuration.portnum;
      const numericPort =
        portRaw === "" || portRaw === null || typeof portRaw === "undefined"
          ? NaN
          : Number(portRaw);
      const password = (configuration.password as string) ?? (configuration.pass as string) ?? (configuration.secret as string) ?? "";
      const mappedType = mapToDatabaseConnectorType((configuration.type as string) ?? systemType);
      const schema = (configuration.schema as string) ?? undefined;
      const sslMode = (configuration.sslMode as string) ?? (configuration.sslmode as string) ?? undefined;
      const defaultPorts: Record<DatabaseConnectionConfig["type"], number> = {
        sql_server: 1433,
        postgres: 5432,
        mysql: 3306,
        oracle: 1521,
        sap_hana: 30015,
        generic_sql: 1433,
      };
      const resolvedPort = Number.isFinite(numericPort)
        ? Number(numericPort)
        : defaultPorts[mappedType] ?? 1433;

      return {
        type: mappedType,
        host,
        port: resolvedPort,
        database,
        username,
        password,
        schema,
        sslMode,
      } satisfies DatabaseConnectionConfig;
    }
  }

  return parseConnectionString(connectionString);
}

export function buildAdlsConfig(
  configuration: Record<string, unknown> | null | undefined,
): ADLSConnectionConfig | null {
  if (!configuration) {
    return null;
  }

  const storageAccount = (configuration.storageAccount as string) ?? (configuration.accountName as string) ?? (configuration.account as string);
  const containerName = (configuration.containerName as string) ?? (configuration.container as string);

  if (!storageAccount || !containerName) {
    return null;
  }

  return {
    type: "adls_gen2",
    storageAccount,
    containerName,
    path: ((configuration.path as string) ?? (configuration.directory as string) ?? "") || "",
    sasToken: (configuration.sasToken as string) ?? (configuration.sas_token as string) ?? undefined,
    accessKey: (configuration.accessKey as string) ?? (configuration.access_key as string) ?? undefined,
  } satisfies ADLSConnectionConfig;
}

export async function testSystemConnectivity(
  system: System,
  override?: {
    type?: string;
    configuration?: Record<string, unknown>;
    connectionString?: string | null;
  }
): Promise<{ connected: boolean; message?: string }> {
  const effectiveType = (override?.type ?? system.type ?? "").toLowerCase();
  const configuration = (override?.configuration ?? system.configuration ?? {}) as Record<string, unknown>;
  const connectionString = override?.connectionString ?? system.connectionString ?? null;

  if (effectiveType === "adls") {
    const adlsConfig = buildAdlsConfig(configuration);
    if (!adlsConfig) {
      return { connected: false, message: "Missing ADLS configuration" };
    }

    const connected = await dataConnectors.testADLSConnection(adlsConfig);
    return { connected, message: connected ? undefined : "Connection test failed" };
  }

  const dbConfig = buildDatabaseConfig(configuration, connectionString, effectiveType);
  if (!dbConfig) {
    return { connected: false, message: "Missing connection details" };
  }

  const connected = await dataConnectors.testDatabaseConnection(dbConfig);
  return { connected, message: connected ? undefined : "Connection test failed" };
}

export async function retrieveSystemMetadata(
  system: System,
  options?: {
    configurationOverride?: Record<string, unknown>;
    connectionStringOverride?: string | null;
  }
): Promise<TableMetadata[]> {
  const effectiveType = (system.type ?? "").toLowerCase();
  const configuration = (options?.configurationOverride ?? system.configuration ?? {}) as Record<string, unknown>;
  const connectionString = options?.connectionStringOverride ?? system.connectionString ?? null;

  if (effectiveType === "adls") {
    const adlsConfig = buildAdlsConfig(configuration);
    if (!adlsConfig) {
      return [];
    }
    return await dataConnectors.listADLSDatasets(adlsConfig);
  }

  const dbConfig =
    buildDatabaseConfig(configuration, connectionString, system.type) ?? ({
      type: "sql_server",
      host: "localhost",
      port: 1433,
      database: "default",
      username: system.name ?? "system",
      password: "",
    } satisfies DatabaseConnectionConfig);

  return await dataConnectors.extractDatabaseMetadata(dbConfig);
}
EOF

echo "Creating configuration_utils.ts..."
cat > "$UTILS_DIR/configuration_utils.ts" << 'EOF'
import { storage } from "../storage";
import { insertConfigurationSchema } from "@shared/schema";

export async function upsertConfigurationEntry(input: unknown) {
  const validatedData = insertConfigurationSchema.parse(input);
  const existing = await storage.getConfigurationByCategoryAndKey(
    validatedData.category,
    validatedData.key
  );

  const fallbackDescription = `${validatedData.category}.${validatedData.key} configuration`;

  if (existing) {
    const updated = await storage.updateConfiguration(existing.id, {
      value: validatedData.value,
      description:
        validatedData.description ?? existing.description ?? fallbackDescription,
    });

    return { configuration: updated, created: false as const };
  }

  const created = await storage.createConfiguration(validatedData);
  return { configuration: created, created: true as const };
}
EOF

echo "All utility files created successfully!"
echo ""
echo "Created files:"
echo "  - utils/validation_schemas.ts"
echo "  - utils/model_utils.ts"
echo "  - utils/relationship_utils.ts"
echo "  - utils/system_utils.ts"
echo "  - utils/configuration_utils.ts"
echo ""
echo "Next step: Update routes.ts to import from these utility files"
