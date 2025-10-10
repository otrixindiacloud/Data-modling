import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { aiEngine } from "./services/aiEngine";
import { dataConnectors, type ADLSConnectionConfig, type DatabaseConnectionConfig, type TableMetadata } from "./services/dataConnectors";
import { generateHeuristicForeignKeys } from "./services/relationshipHeuristics";
import { exportService } from "./services/exportService";
import { modelingAgentService } from "./services/modelingAgent";

// Helper functions for data type conversion
function mapLogicalToPhysicalType(logicalType: string | null): string {
  if (!logicalType) return "VARCHAR(255)";
  
  const typeMap: { [key: string]: string } = {
    // Logical to Physical type mapping
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
    // Conceptual to Physical (for backward compatibility)
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

function mapConceptualToLogicalType(conceptualType: string | null): string {
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

function getDefaultLength(dataType: string | null): number | null {
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
import { 
  insertDataModelSchema,
  insertDataDomainSchema,
  insertDataAreaSchema,
  insertDataObjectSchema,
  insertAttributeSchema,
  insertDataObjectRelationshipSchema,
  insertDataModelObjectRelationshipSchema,
  insertSystemSchema,
  insertConfigurationSchema,
  type DataModel,
  type DataModelObject,
  type DataModelObjectAttribute,
  type DataModelObjectRelationship,
  type DataModelProperty,
  type DataObject,
  type DataDomain,
  type DataArea,
  type DataObjectRelationship,
  type Attribute,
  type System,
  type InsertDataObject,
  type InsertAttribute,
  type InsertDataModelObject,
  type InsertDataModelObjectAttribute,
  type InsertDataObjectRelationship
} from "@shared/schema";
import { getTargetSystemTemplate } from "./services/targetSystemTemplates";
import multer from "multer";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });

const configurationUpdateSchema = z
  .object({
    value: z.any().optional(),
    description: z.string().optional(),
  })
  .refine((data) => data.value !== undefined || data.description !== undefined, {
    message: "At least one of value or description is required",
  });

const systemObjectUpdateSchema = z.object({
  domainId: z.number().int().positive().nullable().optional(),
  dataAreaId: z.number().int().positive().nullable().optional(),
  description: z.string().nullable().optional(),
});

const systemSyncRequestSchema = z.object({
  modelId: z.number().int().positive(),
  direction: z.enum(["source", "target"] as const).default("source").optional(),
  includeAttributes: z.boolean().default(true).optional(),
  domainId: z.number().int().positive().nullable().optional(),
  dataAreaId: z.number().int().positive().nullable().optional(),
  metadataOnly: z.boolean().default(false).optional(),
});


const modelingAgentRequestSchema = z
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

type SystemObjectDirection = "source" | "target";

const relationshipTypeEnum = z.enum(["1:1", "1:N", "N:1", "N:M", "M:N"] as const);

const createRelationshipRequestSchema = z.object({
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

const updateRelationshipRequestSchema = z
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

function determineRelationshipLevel(
  sourceAttributeId: number | null,
  targetAttributeId: number | null,
): "object" | "attribute" {
  return sourceAttributeId !== null && targetAttributeId !== null ? "attribute" : "object";
}

function buildRelationshipKey(
  sourceObjectId: number,
  targetObjectId: number,
  relationshipLevel: "object" | "attribute",
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

function findMatchingDataObjectRelationship(
  relationships: DataObjectRelationship[],
  sourceObjectId: number,
  targetObjectId: number,
  relationshipLevel: "object" | "attribute",
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

type RelationshipLevel = "object" | "attribute";

interface ModelFamily {
  conceptual: DataModel;
  logical?: DataModel;
  physical?: DataModel;
  members: DataModel[];
}

function findConceptualRoot(
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

async function resolveModelFamily(model: DataModel): Promise<ModelFamily> {
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

function findDataModelAttributeId(
  attributes: DataModelObjectAttribute[],
  modelId: number,
  modelObjectId: number,
  attributeId: number,
): number | undefined {
  const match = attributes.find(
    (entry) => entry.modelId === modelId && entry.modelObjectId === modelObjectId && entry.attributeId === attributeId,
  );
  return match?.id;
}

interface RelationshipSyncInput {
  baseModel: DataModel;
  sourceObjectId: number;
  targetObjectId: number;
  type: string;
  relationshipLevel: RelationshipLevel;
  sourceAttributeId: number | null;
  targetAttributeId: number | null;
  name?: string | null;
  description?: string | null;
}

async function synchronizeFamilyRelationships(
  params: RelationshipSyncInput,
): Promise<Map<number, DataModelObjectRelationship>> {
  const family = await resolveModelFamily(params.baseModel);
  const dataModelAttributes = await storage.getDataModelObjectAttributes();
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
      // Try to find model-specific attribute IDs
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

      // If model attributes don't exist, create them
      if (!sourceModelAttributeId || !targetModelAttributeId) {
        console.log(`Model attributes not found for model ${modelToSync.id}, creating them...`);
        
        if (!sourceModelAttributeId && params.sourceAttributeId) {
          const globalAttr = await storage.getAttribute(params.sourceAttributeId);
          if (globalAttr) {
            const newModelAttr = await storage.createDataModelObjectAttribute({
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
            const newModelAttr = await storage.createDataModelObjectAttribute({
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
        
        // If we still don't have model attribute IDs, fall back to object level
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

async function removeFamilyRelationships(params: RelationshipSyncInput): Promise<void> {
  const family = await resolveModelFamily(params.baseModel);
  const dataModelAttributes = await storage.getDataModelObjectAttributes();
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
      // Try to find model-specific attribute IDs
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

      // If model attributes don't exist, we can't match them, so skip this level
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

function coerceNumericId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function extractPreferredDomainId(system: System, override?: number | null): number | null {
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

type ModelLayer = "conceptual" | "logical" | "physical";

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const modelObjectConfigSchema = z
  .object({
    position: positionSchema.nullable().optional(),
    targetSystemId: z.number().int().positive().nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
    isVisible: z.boolean().optional(),
    layerSpecificConfig: z.record(z.any()).nullable().optional(),
  })
  .partial();

const perLayerModelObjectConfigSchema = z
  .object({
    conceptual: modelObjectConfigSchema.optional(),
    logical: modelObjectConfigSchema.optional(),
    physical: modelObjectConfigSchema.optional(),
  })
  .partial();

const attributeInputSchema = z
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

const relationshipInputSchema = z
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

type AttributeInput = z.infer<typeof attributeInputSchema>;
type RelationshipInput = z.infer<typeof relationshipInputSchema>;
type ModelObjectConfigInput = z.infer<typeof modelObjectConfigSchema>;

interface LayerCreationResult {
  layer: ModelLayer;
  model: DataModel;
  object: DataObject;
  modelObject: DataModelObject;
  attributes: Attribute[];
  dataModelAttributes: DataModelObjectAttribute[];
}

function mergeLayerConfig(base: ModelObjectConfigInput, override?: ModelObjectConfigInput): ModelObjectConfigInput {
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

async function replicateObjectToLayer(params: {
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
    const createdDataModelAttributes: DataModelObjectAttribute[] = [];

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

    const dataModelAttributePayload: InsertDataModelObjectAttribute = {
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
    } satisfies InsertDataModelObjectAttribute;

    const dataModelAttribute = await storage.createDataModelObjectAttribute(dataModelAttributePayload);
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

function extractPreferredDataAreaIds(system: System, override?: number[] | null): number[] {
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

function mapToDatabaseConnectorType(type?: string): DatabaseConnectionConfig["type"] {
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

function parseConnectionString(connectionString?: string | null): DatabaseConnectionConfig | null {
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

function buildDatabaseConfig(
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

function buildAdlsConfig(
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

async function testSystemConnectivity(
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

async function retrieveSystemMetadata(
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

async function upsertConfigurationEntry(input: unknown) {
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

  return { configuration: created, created: true as const };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Data Models
  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getDataModels();
      res.json(models);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch models" });
    }
  });

  app.get("/api/models/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const model = await storage.getDataModel(id);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
      }
      res.json(model);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch model" });
    }
  });

  app.post("/api/models", async (req, res) => {
    try {
      const validatedData = insertDataModelSchema.parse(req.body);
      const model = await storage.createDataModel(validatedData);
      res.status(201).json(model);
    } catch (error) {
      res.status(400).json({ message: "Invalid model data" });
    }
  });

  // Create model with all 3 layers (Conceptual, Logical, Physical)
  app.post("/api/models/create-with-layers", async (req, res) => {
    try {
      const { name, targetSystem, targetSystemId, domainId, dataAreaId } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Model name is required" });
      }

      const parseOptionalNumber = (value: unknown): number | null => {
        if (value === undefined || value === null || value === "") {
          return null;
        }
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
      };

      const systems = await storage.getSystems();
      const parsedTargetSystemId = parseOptionalNumber(targetSystemId);
      let targetSystemRecord = parsedTargetSystemId
        ? systems.find((s) => s.id === parsedTargetSystemId)
        : undefined;

      if (!targetSystemRecord && targetSystem) {
        targetSystemRecord = systems.find((s) => s.name === targetSystem);
      }

      const selectedTargetSystem = targetSystemRecord?.name || targetSystem || "Data Lake";
      const resolvedTargetSystemId = targetSystemRecord?.id ?? null;

      const parsedDomainId = parseOptionalNumber(domainId);
      let domainRecord = parsedDomainId ? await storage.getDataDomain(parsedDomainId) : null;
      if (parsedDomainId && !domainRecord) {
        return res.status(400).json({ message: "Selected domain does not exist" });
      }

      const parsedDataAreaId = parseOptionalNumber(dataAreaId);
      let dataAreaRecord = parsedDataAreaId ? await storage.getDataArea(parsedDataAreaId) : null;
      if (parsedDataAreaId && !dataAreaRecord) {
        return res.status(400).json({ message: "Selected data area does not exist" });
      }

      if (dataAreaRecord) {
        if (domainRecord && dataAreaRecord.domainId !== domainRecord.id) {
          return res.status(400).json({ message: "Selected data area does not belong to the provided domain" });
        }
        if (!domainRecord) {
          domainRecord = await storage.getDataDomain(dataAreaRecord.domainId) ?? null;
        }
      }

      const resolvedDomainId = domainRecord?.id ?? null;
      const resolvedDataAreaId = dataAreaRecord?.id ?? null;

      // Create conceptual model first (parent model)
      const conceptualModel = await storage.createDataModel({
        name: name,
        layer: "conceptual",
        targetSystemId: resolvedTargetSystemId,
        domainId: resolvedDomainId,
        dataAreaId: resolvedDataAreaId,
      });

      // Create logical model linked to conceptual
      const logicalModel = await storage.createDataModel({
        name: name,
        layer: "logical", 
        parentModelId: conceptualModel.id,
        targetSystemId: resolvedTargetSystemId,
        domainId: resolvedDomainId,
        dataAreaId: resolvedDataAreaId,
      });

      // Create physical model linked to conceptual
      const physicalModel = await storage.createDataModel({
        name: name,
        layer: "physical",
        parentModelId: conceptualModel.id,
        targetSystemId: resolvedTargetSystemId,
        domainId: resolvedDomainId,
        dataAreaId: resolvedDataAreaId,
      });

      // Get template objects and attributes for the selected target system
      const template = getTargetSystemTemplate(selectedTargetSystem);
      if (template) {
        console.log(`Adding template objects for ${selectedTargetSystem}...`);
        
        // Create domains and data areas from template
        const createdDomains = new Map<string, number>();
        const createdAreas = new Map<string, number>();
        
        for (const domainName of template.defaultDomains) {
          // Check if domain already exists
          let domain = await storage.getDataDomainByName(domainName);
          if (!domain) {
            domain = await storage.createDataDomain({
              name: domainName,
              description: `${domainName} domain for ${selectedTargetSystem}`
            });
          }
          createdDomains.set(domainName, domain.id);
          
          // Create data areas for this domain
          const areasForDomain = template.defaultDataAreas[domainName] || [];
          for (const areaName of areasForDomain) {
            try {
              // Check if area already exists
              let area = await storage.getDataAreaByName(areaName, domain.id);
              if (!area) {
                area = await storage.createDataArea({
                  name: areaName,
                  domainId: domain.id,
                  description: `${areaName} area in ${domainName} domain`
                });
              }
              createdAreas.set(`${domainName}:${areaName}`, area.id);
            } catch (error) {
              console.log(`Error creating area ${areaName}:`, error);
            }
          }
        }

        // Helper function to get system ID from name
        const getSystemId = async (systemName: string) => {
          const systems = await storage.getSystems();
          const system = systems.find(s => s.name === systemName);
          return system?.id || null;
        };

        // Create template objects and attributes in all three layers
        for (const templateObj of template.objects) {
          const domainId = createdDomains.get(templateObj.domainName);
          const areaId = createdAreas.get(`${templateObj.domainName}:${templateObj.dataAreaName}`);
          
          if (!domainId) {
            console.log(`Domain ${templateObj.domainName} not found, skipping object ${templateObj.name}`);
            continue;
          }

          const basePosition = templateObj.position || { x: 0, y: 0 };
          const templateMetadata: Record<string, any> = {
            createdFromTemplate: true,
            templateName: selectedTargetSystem,
            templateObjectType: templateObj.type,
          };

          const layerConfigBase: Record<string, any> = {
            position: basePosition,
            template: selectedTargetSystem,
          };

          // Create object in conceptual layer
          const conceptualObject = await storage.createDataObject({
            name: templateObj.name,
            modelId: conceptualModel.id,
            domainId: domainId,
            dataAreaId: areaId,
            sourceSystemId: await getSystemId(templateObj.sourceSystem),
            targetSystemId: resolvedTargetSystemId,
            isNew: false,
            position: basePosition
          });

          await storage.createDataModelObject({
            objectId: conceptualObject.id,
            modelId: conceptualModel.id,
            targetSystemId: resolvedTargetSystemId,
            position: basePosition,
            metadata: templateMetadata,
            isVisible: true,
            layerSpecificConfig: {
              ...layerConfigBase,
              layer: "conceptual"
            } as Record<string, any>
          });

          // Create object in logical layer
          const logicalObject = await storage.createDataObject({
            name: templateObj.name,
            modelId: logicalModel.id,
            domainId: domainId,
            dataAreaId: areaId,
            sourceSystemId: await getSystemId(templateObj.sourceSystem),
            targetSystemId: resolvedTargetSystemId,
            isNew: false,
            position: basePosition
          });

          await storage.createDataModelObject({
            objectId: logicalObject.id,
            modelId: logicalModel.id,
            targetSystemId: resolvedTargetSystemId,
            position: basePosition,
            metadata: templateMetadata,
            isVisible: true,
            layerSpecificConfig: {
              ...layerConfigBase,
              layer: "logical"
            } as Record<string, any>
          });

          // Create object in physical layer
          const physicalObject = await storage.createDataObject({
            name: templateObj.name,
            modelId: physicalModel.id,
            domainId: domainId,
            dataAreaId: areaId,
            sourceSystemId: await getSystemId(templateObj.sourceSystem),
            targetSystemId: resolvedTargetSystemId,
            isNew: false,
            position: basePosition
          });

          await storage.createDataModelObject({
            objectId: physicalObject.id,
            modelId: physicalModel.id,
            targetSystemId: resolvedTargetSystemId,
            position: basePosition,
            metadata: templateMetadata,
            isVisible: true,
            layerSpecificConfig: {
              ...layerConfigBase,
              layer: "physical"
            } as Record<string, any>
          });

          // Create attributes for logical and physical layers (conceptual layer doesn't show attributes)
          for (const templateAttr of templateObj.attributes) {
            // Create attribute in logical layer
            await storage.createAttribute({
              name: templateAttr.name,
              objectId: logicalObject.id,
              conceptualType: templateAttr.conceptualType,
              logicalType: templateAttr.logicalType,
              physicalType: templateAttr.physicalType,
              length: templateAttr.length,
              nullable: templateAttr.nullable,
              isPrimaryKey: templateAttr.isPrimaryKey,
              isForeignKey: templateAttr.isForeignKey,
              isNew: false,
              orderIndex: templateAttr.orderIndex
            });

            // Create attribute in physical layer
            await storage.createAttribute({
              name: templateAttr.name,
              objectId: physicalObject.id,
              conceptualType: templateAttr.conceptualType,
              logicalType: templateAttr.logicalType,
              physicalType: templateAttr.physicalType,
              length: templateAttr.length,
              nullable: templateAttr.nullable,
              isPrimaryKey: templateAttr.isPrimaryKey,
              isForeignKey: templateAttr.isForeignKey,
              isNew: false,
              orderIndex: templateAttr.orderIndex
            });
          }

          // Create relationships in all layers if they exist in template
          // Note: The relationship creation should happen after all objects are created
        }
        
        console.log(`Successfully added ${template.objects.length} template objects to all layers`);
      }

      res.status(201).json({
        conceptual: conceptualModel,
        logical: logicalModel,
        physical: physicalModel,
        templatesAdded: template ? template.objects.length : 0,
        message: `Model created with all 3 layers${template ? ` and ${template.objects.length} template objects from ${selectedTargetSystem}` : ""}`
      });
    } catch (error: any) {
      console.error("Error creating model with layers:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          message: "Invalid model data", 
          details: error.errors,
          errors: error.errors 
        });
      } else {
        res.status(500).json({ 
          message: error.message || "Failed to create model with layers" 
        });
      }
    }
  });

  app.put("/api/models/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDataModelSchema.partial().parse(req.body);
      const model = await storage.updateDataModel(id, validatedData);
      res.json(model);
    } catch (error) {
      res.status(400).json({ message: "Failed to update model" });
    }
  });

  app.delete("/api/models/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDataModel(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete model" });
    }
  });

  // Data Domains
  app.get("/api/domains", async (req, res) => {
    try {
      const domains = await storage.getDataDomains();
      res.json(domains);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch domains" });
    }
  });

  app.post("/api/domains", async (req, res) => {
    try {
      console.log("Creating domain with data:", req.body);
      const validatedData = insertDataDomainSchema.parse(req.body);
      const domain = await storage.createDataDomain(validatedData);
      res.status(201).json(domain);
    } catch (error: any) {
      console.error("Domain creation error:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          message: "Invalid domain data", 
          details: error.errors,
          errors: error.errors 
        });
      } else if (error.code === '23505' || error.message?.includes('UNIQUE constraint failed') || error.message?.includes('duplicate key')) {
        res.status(409).json({ 
          message: "Domain name already exists", 
          details: "A domain with this name already exists. Please choose a different name."
        });
      } else {
        res.status(500).json({ 
          message: error.message || "Failed to create domain" 
        });
      }
    }
  });

  app.patch("/api/domains/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDataDomainSchema.partial().parse(req.body);
      const domain = await storage.updateDataDomain(id, validatedData);
      res.json(domain);
    } catch (error) {
      res.status(400).json({ message: "Failed to update domain" });
    }
  });

  // PUT endpoint for /api/domains/:id (full update)
  app.put("/api/domains/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("Updating domain", id, "with data:", req.body);
      const validatedData = insertDataDomainSchema.parse(req.body);
      const domain = await storage.updateDataDomain(id, validatedData);
      res.json(domain);
    } catch (error: any) {
      console.error("Failed to update domain:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          message: "Invalid domain data", 
          details: error.errors,
          errors: error.errors 
        });
      } else if (error.code === '23505' || error.message?.includes('UNIQUE constraint failed') || error.message?.includes('duplicate key')) {
        res.status(409).json({ 
          message: "Domain name already exists", 
          details: "A domain with this name already exists. Please choose a different name."
        });
      } else {
        res.status(500).json({ 
          message: error.message || "Failed to update domain" 
        });
      }
    }
  });

  // DELETE endpoint for /api/domains/:id
  app.delete("/api/domains/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDataDomain(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete domain:", error);
      res.status(500).json({ message: "Failed to delete domain" });
    }
  });

  // Data Areas
  app.get("/api/domains/:domainId/areas", async (req, res) => {
    try {
      const domainParam = req.params.domainId;
      let domainId: number;
      
      // Check if domainParam is a number or a domain name
      if (isNaN(parseInt(domainParam))) {
        // It's a domain name, find the domain by name
        const domain = await storage.getDataDomainByName(domainParam);
        if (!domain) {
          return res.status(404).json({ message: "Domain not found" });
        }
        domainId = domain.id;
      } else {
        // It's a numeric domain ID
        domainId = parseInt(domainParam);
      }
      
      const areas = await storage.getDataAreasByDomain(domainId);
      res.json(areas);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch data areas" });
    }
  });

  app.get("/api/areas", async (req, res) => {
    try {
      const areas = await storage.getDataAreas();
      res.json(areas);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch areas" });
    }
  });

  app.post("/api/areas", async (req, res) => {
    try {
      const validatedData = insertDataAreaSchema.parse(req.body);
      const area = await storage.createDataArea(validatedData);
      res.status(201).json(area);
    } catch (error) {
      res.status(400).json({ message: "Invalid area data" });
    }
  });

  app.patch("/api/areas/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDataAreaSchema.partial().parse(req.body);
      const area = await storage.updateDataArea(id, validatedData);
      res.json(area);
    } catch (error) {
      res.status(400).json({ message: "Failed to update area" });
    }
  });

  app.delete("/api/areas/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDataArea(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete area:", error);
      res.status(500).json({ message: "Failed to delete area" });
    }
  });

  // Data Objects
  app.get("/api/models/:modelId/objects", async (req, res) => {
    try {
      const modelId = parseInt(req.params.modelId);
      const objects = await storage.getDataObjectsByModel(modelId);
      res.json(objects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch objects" });
    }
  });

  // Add existing object to a model (creates data_model_object entry)
  app.post("/api/models/:modelId/objects", async (req, res) => {
    try {
      const modelId = parseInt(req.params.modelId);
      const { objectId, position, targetSystem, isVisible, layerSpecificConfig } = req.body;
      
      if (!objectId || typeof objectId !== 'number') {
        return res.status(400).json({ message: "Valid objectId is required" });
      }
      
      // Check if object already exists in this specific model
      const existingModelObjects = await storage.getDataModelObjects();
      const existingEntry = existingModelObjects.find(mo => mo.objectId === objectId && mo.modelId === modelId);
      
      if (existingEntry) {
        return res.status(409).json({ message: "Object already exists in this model" });
      }
      
      // Verify the object exists globally
      const globalObject = await storage.getDataObject(objectId);
      if (!globalObject) {
        return res.status(404).json({ message: "Object not found" });
      }
      
      // Create the data model object entry
      const dataModelObject = await storage.createDataModelObject({
        objectId,
        modelId,
        targetSystemId: targetSystem || null,
        position: position || null,
        metadata: {},
        isVisible: isVisible !== undefined ? isVisible : true,
        layerSpecificConfig: layerSpecificConfig || {}
      });
      
      res.status(201).json(dataModelObject);
    } catch (error) {
      console.error("Error adding object to model:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;
      console.error("Error details:", {
        modelId: req.params.modelId,
        objectId: req.body.objectId,
        error: message,
        stack,
      });
      res.status(500).json({ 
        message: "Failed to add object to model",
        error: message 
      });
    }
  });

  app.get("/api/objects", async (req, res) => {
    try {
      const objects = await storage.getAllDataObjects();
      res.json(objects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch all objects" });
    }
  });

  app.get("/api/objects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const object = await storage.getDataObject(id);
      if (!object) {
        return res.status(404).json({ message: "Object not found" });
      }
      res.json(object);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch object" });
    }
  });

  app.post("/api/objects", async (req, res) => {
    try {
      console.log("Received object creation request:", req.body);

      const {
        attributes: rawAttributes,
        relationships: rawRelationships,
        cascade: cascadeFlag,
        modelObjectConfig: rawModelObjectConfig,
        layerModelObjectConfig: rawLayerModelObjectConfig,
        modelObjectConfigs: rawLegacyLayerConfig,
        ...objectPayload
      } = (req.body ?? {}) as Record<string, unknown>;

      const validatedData = insertDataObjectSchema.parse(objectPayload);

      const attributeInputs: AttributeInput[] = Array.isArray(rawAttributes)
        ? z.array(attributeInputSchema).parse(rawAttributes)
        : [];

      const relationshipInputs: RelationshipInput[] = Array.isArray(rawRelationships)
        ? z.array(relationshipInputSchema).parse(rawRelationships)
        : [];

      const baseModelObjectConfig: ModelObjectConfigInput =
        rawModelObjectConfig && typeof rawModelObjectConfig === "object"
          ? modelObjectConfigSchema.parse(rawModelObjectConfig)
          : {};

      const layerConfigSource =
        rawLayerModelObjectConfig && typeof rawLayerModelObjectConfig === "object"
          ? rawLayerModelObjectConfig
          : rawLegacyLayerConfig;

      const perLayerConfig =
        layerConfigSource && typeof layerConfigSource === "object"
          ? perLayerModelObjectConfigSchema.parse(layerConfigSource)
          : {};

      const cascadeEnabled = cascadeFlag !== false;

      const baseModel = await storage.getDataModel(validatedData.modelId);
      if (!baseModel) {
        return res.status(404).json({ message: "Model not found" });
      }

      const modelObjectsCache = new Map<number, DataModelObject[]>();
      const attributesCache = new Map<number, Attribute[]>();
      const dataObjectCache = new Map<number, DataObject | null>();
  const fullyLoadedModelIds = new Set<number>();

      const resolveLayerConfig = (layer: ModelLayer): ModelObjectConfigInput =>
        mergeLayerConfig(baseModelObjectConfig, (perLayerConfig as Record<ModelLayer, ModelObjectConfigInput | undefined>)[layer]);

      const primaryObject = await storage.createDataObject(validatedData);
      dataObjectCache.set(primaryObject.id, primaryObject);

      const baseLayer = (baseModel.layer ?? "conceptual") as ModelLayer;
      const baseLayerConfig = resolveLayerConfig(baseLayer);

      const baseModelObjectPayload: InsertDataModelObject = {
        objectId: primaryObject.id,
        modelId: baseModel.id,
        targetSystemId:
          baseLayerConfig.targetSystemId ??
          validatedData.targetSystemId ??
          (baseModel.targetSystemId ?? null),
        position: baseLayerConfig.position ?? validatedData.position ?? null,
        metadata: {
          ...(validatedData.metadata ?? {}),
          ...(baseLayerConfig.metadata ?? {}),
          layer: baseLayer,
          originConceptualObjectId: baseLayer === "conceptual" ? primaryObject.id : null,
        },
        isVisible: baseLayerConfig.isVisible ?? true,
        layerSpecificConfig: {
          ...(baseLayerConfig.layerSpecificConfig ?? {}),
          layer: baseLayer,
          originConceptualObjectId: baseLayer === "conceptual" ? primaryObject.id : null,
        },
      } satisfies InsertDataModelObject;

      const baseModelObject = await storage.createDataModelObject(baseModelObjectPayload);
      modelObjectsCache.set(baseModel.id, [baseModelObject]);

      const baseAttributes: Attribute[] = [];
      const baseDataModelAttributes: DataModelObjectAttribute[] = [];

      if (attributeInputs.length > 0) {
        for (let index = 0; index < attributeInputs.length; index++) {
          const attributeInput = attributeInputs[index];

          const attributePayload: InsertAttribute = {
            name: attributeInput.name,
            objectId: primaryObject.id,
            conceptualType:
              attributeInput.conceptualType ??
              attributeInput.logicalType ??
              attributeInput.physicalType ??
              attributeInput.dataType ??
              undefined,
            logicalType: attributeInput.logicalType ?? undefined,
            physicalType: attributeInput.physicalType ?? undefined,
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

          const createdAttribute = await storage.createAttribute(attributePayload);
          baseAttributes.push(createdAttribute);

          if (!attributesCache.has(primaryObject.id)) {
            attributesCache.set(primaryObject.id, []);
          }
          attributesCache.get(primaryObject.id)!.push(createdAttribute);

          const dataModelAttributePayload: InsertDataModelObjectAttribute = {
            attributeId: createdAttribute.id,
            modelObjectId: baseModelObject.id,
            modelId: baseModel.id,
            conceptualType: attributeInput.conceptualType ?? createdAttribute.conceptualType ?? null,
            logicalType: attributeInput.logicalType ?? createdAttribute.logicalType ?? null,
            physicalType: attributeInput.physicalType ?? createdAttribute.physicalType ?? null,
            nullable: attributeInput.nullable ?? createdAttribute.nullable ?? true,
            isPrimaryKey: attributeInput.isPrimaryKey ?? createdAttribute.isPrimaryKey ?? false,
            isForeignKey: attributeInput.isForeignKey ?? createdAttribute.isForeignKey ?? false,
            orderIndex: attributeInput.orderIndex ?? createdAttribute.orderIndex ?? index,
            layerSpecificConfig: {
              ...(attributeInput.metadata ?? {}),
              layer: baseLayer,
              originConceptualObjectId: baseLayer === "conceptual" ? primaryObject.id : null,
            },
          } satisfies InsertDataModelObjectAttribute;

          const createdDataModelAttribute = await storage.createDataModelObjectAttribute(dataModelAttributePayload);
          baseDataModelAttributes.push(createdDataModelAttribute);
        }
      }

      const createdLayers: Record<ModelLayer, LayerCreationResult | null> = {
        conceptual: null,
        logical: null,
        physical: null,
      };

      const baseLayerResult: LayerCreationResult = {
        layer: baseLayer,
        model: baseModel,
        object: primaryObject,
        modelObject: baseModelObject,
        attributes: baseAttributes,
        dataModelAttributes: baseDataModelAttributes,
      };

      createdLayers[baseLayer] = baseLayerResult;

      const allModels = await storage.getDataModels();

      const childrenByParentId = new Map<number, DataModel[]>();
      for (const model of allModels) {
        if (model.parentModelId === null || model.parentModelId === undefined) {
          continue;
        }
        const siblings = childrenByParentId.get(model.parentModelId) ?? [];
        siblings.push(model);
        childrenByParentId.set(model.parentModelId, siblings);
      }

      const findDescendantLayer = (ancestor: DataModel | null, layer: ModelLayer): DataModel | null => {
        if (!ancestor) {
          return null;
        }

        const visited = new Set<number>();
        const queue: DataModel[] = [...(childrenByParentId.get(ancestor.id) ?? [])];

        while (queue.length > 0) {
          const candidate = queue.shift()!;
          if (visited.has(candidate.id)) {
            continue;
          }
          visited.add(candidate.id);

          if (candidate.layer === layer) {
            return candidate;
          }

          const children = childrenByParentId.get(candidate.id);
          if (children && children.length > 0) {
            queue.push(...children);
          }
        }

        return null;
      };

      const conceptualModel =
        baseLayer === "conceptual"
          ? baseModel
          : allModels.find((model) => model.id === baseModel.parentModelId && model.layer === "conceptual") ?? null;

      const logicalModel = findDescendantLayer(conceptualModel, "logical");

      const physicalModel = findDescendantLayer(conceptualModel, "physical") ?? findDescendantLayer(logicalModel, "physical");

      let cascadePerformed = false;

      if (cascadeEnabled && baseLayer === "conceptual") {
        if (logicalModel) {
          const logicalResult = await replicateObjectToLayer({
            layer: "logical",
            conceptualModel: baseModel,
            conceptualObject: primaryObject,
            targetModel: logicalModel,
            baseObjectPayload: validatedData,
            attributeInputs,
            config: resolveLayerConfig("logical"),
            modelObjectsCache,
            attributesCache,
          });
          createdLayers.logical = logicalResult;
        }

        if (physicalModel) {
          const physicalResult = await replicateObjectToLayer({
            layer: "physical",
            conceptualModel: baseModel,
            conceptualObject: primaryObject,
            targetModel: physicalModel,
            baseObjectPayload: validatedData,
            attributeInputs,
            config: resolveLayerConfig("physical"),
            modelObjectsCache,
            attributesCache,
          });
          createdLayers.physical = physicalResult;
        }

        cascadePerformed = Boolean(createdLayers.logical || createdLayers.physical);
      }

      const ensureModelObjects = async (modelId: number): Promise<DataModelObject[]> => {
        const cached = modelObjectsCache.get(modelId) ?? [];

        if (!fullyLoadedModelIds.has(modelId)) {
          const fetched = await storage.getDataModelObjectsByModel(modelId);
          const mergedById = new Map<number, DataModelObject>();

          for (const entry of [...fetched, ...cached]) {
            mergedById.set(entry.id, entry);
          }

          const merged = Array.from(mergedById.values());
          modelObjectsCache.set(modelId, merged);
          fullyLoadedModelIds.add(modelId);
          return merged;
        }

        return cached;
      };

      const ensureAttributes = async (objectId: number): Promise<Attribute[]> => {
        if (!attributesCache.has(objectId)) {
          const result = await storage.getAttributesByObject(objectId);
          attributesCache.set(objectId, [...result]);
        }
        return attributesCache.get(objectId)!;
      };

      const resolveTargetModelObject = async (
        layer: ModelLayer,
        conceptualObjectId: number,
        targetModel: DataModel,
      ): Promise<DataModelObject | null> => {
        const layerModelObjects = await ensureModelObjects(targetModel.id);

        let direct = layerModelObjects.find((entry) => {
          const layerConfig = (entry.layerSpecificConfig ?? {}) as Record<string, unknown> | null;
          if (layerConfig?.originConceptualObjectId === conceptualObjectId) {
            return true;
          }
          const metadata = (entry.metadata ?? {}) as Record<string, unknown> | null;
          return metadata?.originConceptualObjectId === conceptualObjectId;
        });

        if (direct) {
          return direct;
        }

        const conceptualObject =
          dataObjectCache.get(conceptualObjectId) ?? (await storage.getDataObject(conceptualObjectId)) ?? null;
        dataObjectCache.set(conceptualObjectId, conceptualObject);

        if (!conceptualObject) {
          return null;
        }

        for (const entry of layerModelObjects) {
          const targetObject =
            dataObjectCache.get(entry.objectId) ?? (await storage.getDataObject(entry.objectId)) ?? null;
          dataObjectCache.set(entry.objectId, targetObject);
          if (targetObject && targetObject.name === conceptualObject.name) {
            direct = entry;
            break;
          }
        }

        return direct ?? null;
      };

      const relationshipSummaries: Array<{
        layer: ModelLayer;
        relationship: DataModelObjectRelationship;
        dataObjectRelationshipId: number | null;
      }> = [];

      if (relationshipInputs.length > 0) {
        const baseRelationships = await storage.getDataObjectRelationshipsByObject(primaryObject.id);

        for (const relationshipInput of relationshipInputs) {
          const targetConceptualObject = await storage.getDataObject(relationshipInput.targetObjectId);

          if (!targetConceptualObject) {
            console.warn("Target object for relationship not found", relationshipInput.targetObjectId);
            continue;
          }

          dataObjectCache.set(targetConceptualObject.id, targetConceptualObject);

          let sourceAttributeId: number | null = null;
          let targetAttributeId: number | null = null;

          if (relationshipInput.relationshipLevel === "attribute" || relationshipInput.sourceAttributeName || relationshipInput.targetAttributeName) {
            const sourceAttributes = await ensureAttributes(primaryObject.id);
            const targetAttributes = await ensureAttributes(targetConceptualObject.id);

            if (relationshipInput.sourceAttributeName) {
              sourceAttributeId =
                sourceAttributes.find((attribute) => attribute.name === relationshipInput.sourceAttributeName)?.id ?? null;
            }

            if (relationshipInput.targetAttributeName) {
              targetAttributeId =
                targetAttributes.find((attribute) => attribute.name === relationshipInput.targetAttributeName)?.id ?? null;
            }
          }

          const relationshipLevel: "object" | "attribute" =
            sourceAttributeId !== null && targetAttributeId !== null ? "attribute" : "object";

          let dataObjectRelationship = findMatchingDataObjectRelationship(
            baseRelationships,
            primaryObject.id,
            targetConceptualObject.id,
            relationshipLevel,
            sourceAttributeId,
            targetAttributeId,
          );

          if (!dataObjectRelationship) {
            const globalRelationshipPayload: InsertDataObjectRelationship = {
              sourceDataObjectId: primaryObject.id,
              targetDataObjectId: targetConceptualObject.id,
              type: relationshipInput.type ?? "1:N",
              relationshipLevel,
              sourceAttributeId: sourceAttributeId ?? undefined,
              targetAttributeId: targetAttributeId ?? undefined,
              name: relationshipInput.name ?? undefined,
              description: relationshipInput.description ?? undefined,
              metadata: {
                ...(relationshipInput.metadata ?? {}),
                createdViaCascade: true,
              },
            } satisfies InsertDataObjectRelationship;

            dataObjectRelationship = await storage.createDataObjectRelationship(globalRelationshipPayload);
            baseRelationships.push(dataObjectRelationship);
          }

          for (const layer of ["conceptual", "logical", "physical"] as ModelLayer[]) {
            const layerResult = createdLayers[layer];
            if (!layerResult) {
              continue;
            }

            const sourceModelObject = layerResult.modelObject;
            const targetModelObject = await resolveTargetModelObject(layer, targetConceptualObject.id, layerResult.model);

            if (!targetModelObject) {
              continue;
            }

            let layerSourceAttributeId: number | null = sourceAttributeId;
            let layerTargetAttributeId: number | null = targetAttributeId;

            if (relationshipLevel === "attribute") {
              const layerSourceAttributes = await ensureAttributes(layerResult.object.id);
              const layerTargetAttributes = await ensureAttributes(targetModelObject.objectId);

              if (relationshipInput.sourceAttributeName) {
                layerSourceAttributeId =
                  layerSourceAttributes.find((attribute) => attribute.name === relationshipInput.sourceAttributeName)?.id ?? null;
              }

              if (relationshipInput.targetAttributeName) {
                layerTargetAttributeId =
                  layerTargetAttributes.find((attribute) => attribute.name === relationshipInput.targetAttributeName)?.id ?? null;
              }

              if (!layerSourceAttributeId || !layerTargetAttributeId) {
                layerSourceAttributeId = null;
                layerTargetAttributeId = null;
              }
            }

            const layerRelationshipPayload = insertDataModelObjectRelationshipSchema.parse({
              sourceModelObjectId: sourceModelObject.id,
              targetModelObjectId: targetModelObject.id,
              type: relationshipInput.type ?? "1:N",
              relationshipLevel: layerSourceAttributeId && layerTargetAttributeId ? "attribute" : "object",
              sourceAttributeId: layerSourceAttributeId ?? undefined,
              targetAttributeId: layerTargetAttributeId ?? undefined,
              modelId: layerResult.model.id,
              layer,
              name: relationshipInput.name ?? undefined,
              description: relationshipInput.description ?? undefined,
            });

            const layerRelationship = await storage.createDataModelObjectRelationship(layerRelationshipPayload);

            relationshipSummaries.push({
              layer,
              relationship: layerRelationship,
              dataObjectRelationshipId: dataObjectRelationship?.id ?? null,
            });
          }
        }
      }


      res.status(201).json({
        primaryObject,
        cascadePerformed,
        layers: createdLayers,
        relationships: relationshipSummaries,
      });
    } catch (error) {
      console.error("Error creating object:", error);
      if ((error as any).errors) {
        console.error("Validation errors:", (error as any).errors);
      }
      res.status(400).json({
        message: "Invalid object data",
        error: (error as any).message,
        details: (error as any).errors || error,
      });
    }
  });

  app.put("/api/objects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDataObjectSchema.partial().parse(req.body);
      const object = await storage.updateDataObject(id, validatedData);
      res.json(object);
    } catch (error) {
      res.status(400).json({ message: "Failed to update object" });
    }
  });

  app.delete("/api/objects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Attempting to delete object ${id}`);
      
      // First, delete all data model objects associated with this object
      console.log(`Deleting data model objects for object ${id}`);
      await storage.deleteDataModelObjectsByObject(id);
      console.log(`Successfully deleted data model objects for object ${id}`);
      
  // Delete any relationships where this object is involved
  console.log(`Deleting data object relationships for object ${id}`);
  await storage.deleteDataObjectRelationshipsByObject(id);
  console.log(`Successfully deleted data object relationships for object ${id}`);

      // Second, delete all attributes associated with this object
      console.log(`Deleting attributes for object ${id}`);
      await storage.deleteAttributesByObject(id);
      console.log(`Successfully deleted attributes for object ${id}`);
      
      // Finally, delete the object itself
      console.log(`Deleting object ${id}`);
      await storage.deleteDataObject(id);
      console.log(`Successfully deleted object ${id}`);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting object:", error);
      res.status(500).json({ message: "Failed to delete object" });
    }
  });

  // Attributes  
  app.get("/api/objects/:objectId/attributes", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      console.log('Fetching attributes for objectId:', objectId);
      
      // Simplified approach: Get all attributes where objectId matches
      // This bypasses the complex model structure temporarily
      const allAttributes = await storage.getAllAttributes();
      const objectAttributes = allAttributes.filter(attr => attr.objectId === objectId);
      
      console.log('Found attributes:', objectAttributes);
      res.json(objectAttributes);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      res.status(500).json({ message: "Failed to fetch attributes" });
    }
  });

  // Get all attributes
  app.get("/api/attributes", async (req, res) => {
    try {
      const attributes = await storage.getAllAttributes();
      res.json(attributes);
    } catch (error) {
      console.error("Error fetching all attributes:", error);
      res.status(500).json({ message: "Failed to fetch attributes" });
    }
  });

  // Create an attribute for a specific object
  app.post("/api/objects/:objectId/attributes", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      const attributeData = { ...req.body, objectId };
      const validatedData = insertAttributeSchema.parse(attributeData);
      console.log('Creating attribute with data:', validatedData);
      
      const attribute = await storage.createAttribute(validatedData);
      console.log('Successfully created attribute:', attribute.id);
      
      res.status(201).json(attribute);
    } catch (error) {
      console.error("Error creating attribute:", error);
      res.status(400).json({ message: "Invalid attribute data" });
    }
  });

  app.post("/api/attributes", async (req, res) => {
    try {
      const validatedData = insertAttributeSchema.parse(req.body);
      console.log('Creating attribute with data:', validatedData);
      
      // Create the attribute (this is working correctly)
      const attribute = await storage.createAttribute(validatedData);
      console.log('Successfully created attribute:', attribute.id);
      
      res.status(201).json(attribute);
    } catch (error) {
      console.error("Error creating attribute:", error);
      res.status(400).json({ message: "Invalid attribute data" });
    }
  });

  // Update an attribute with PATCH
  app.patch("/api/attributes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAttributeSchema.partial().parse(req.body);
      const attribute = await storage.updateAttribute(id, validatedData);
      res.json(attribute);
    } catch (error) {
      console.error("Error updating attribute:", error);
      res.status(400).json({ message: "Failed to update attribute" });
    }
  });

  // Get a specific attribute by ID
  app.get("/api/attributes/:id", async (req, res) => {
    try {
      const attributeId = parseInt(req.params.id);
      const attribute = await storage.getAttribute(attributeId);
      if (!attribute) {
        return res.status(404).json({ error: "Attribute not found" });
      }
      res.json(attribute);
    } catch (error) {
      console.error("Error fetching attribute:", error);
      res.status(500).json({ error: "Failed to fetch attribute" });
    }
  });

  app.put("/api/attributes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAttributeSchema.partial().parse(req.body);
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
      
      res.json(attribute);
    } catch (error) {
      console.error("Error updating attribute:", error);
      res.status(400).json({ message: "Failed to update attribute" });
    }
  });

  app.delete("/api/attributes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAttribute(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete attribute" });
    }
  });

  // Auto-enhance attribute with layer-specific type mapping
  app.post("/api/attributes/:id/enhance", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { targetLayer } = req.body;
      
      const attribute = await storage.getAttribute(id);
      if (!attribute) {
        return res.status(404).json({ message: "Attribute not found" });
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
        res.json(updatedAttribute);
      } else {
        res.json(attribute);
      }
      
    } catch (error) {
      console.error("Error enhancing attribute:", error);
      res.status(500).json({ message: "Failed to enhance attribute" });
    }
  });

  // Bulk enhance attributes for an object
  app.post("/api/objects/:objectId/attributes/enhance", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      const { targetLayer } = req.body;
      
      const attributes = await storage.getAttributesByObject(objectId);
      const enhancedAttributes = [];
      
      for (const attribute of attributes) {
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
          const updatedAttribute = await storage.updateAttribute(attribute.id, updateData);
          enhancedAttributes.push(updatedAttribute);
        } else {
          enhancedAttributes.push(attribute);
        }
      }
      
      res.json(enhancedAttributes);
      
    } catch (error) {
      console.error("Error bulk enhancing attributes:", error);
      res.status(500).json({ message: "Failed to bulk enhance attributes" });
    }
  });

  app.get("/api/object-lake", async (req, res) => {
    try {
      const {
        search,
        domainId,
        dataAreaId,
        systemId,
        modelId,
        layer,
        objectType,
        hasAttributes,
        relationshipType,
        includeHidden,
        page = "1",
        pageSize = "50",
        sortBy = "name",
        sortOrder = "asc"
      } = req.query as Record<string, string | undefined>;

      const parseOptionalNumber = (value?: string): number | null => {
        if (!value) return null;
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const selectedDomainId = parseOptionalNumber(domainId);
      const selectedAreaId = parseOptionalNumber(dataAreaId);
      const selectedSystemId = parseOptionalNumber(systemId);
      const selectedModelId = parseOptionalNumber(modelId);
      const normalizedLayer = layer ? layer.toLowerCase() : null;
      const normalizedObjectType = objectType ? objectType.toLowerCase() : null;
      const hasAttributesFilter = typeof hasAttributes === "string"
        ? hasAttributes.toLowerCase() === "true"
          ? true
          : hasAttributes.toLowerCase() === "false"
            ? false
            : null
        : null;
      const normalizedRelationshipType = relationshipType ? relationshipType.toUpperCase() : null;
      const includeHiddenInstances = includeHidden?.toLowerCase() === "true";
      const pageNumber = Math.max(1, parseOptionalNumber(page) ?? 1);
      const pageSizeNumber = Math.min(200, Math.max(10, parseOptionalNumber(pageSize) ?? 50));
      const sortKey = ["name", "updatedAt", "attributeCount", "modelInstanceCount", "relationshipCount"].includes(sortBy ?? "")
        ? (sortBy as string)
        : "name";
      const sortDirection = sortOrder?.toLowerCase() === "desc" ? "desc" : "asc";

      const [
        objects,
        modelObjects,
        attributes,
        modelAttributes,
        relationships,
        modelRelationships,
        properties,
        systems,
        models,
        domains,
        areas
      ] = await Promise.all([
        storage.getAllDataObjects(),
        storage.getDataModelObjects(),
        storage.getAllAttributes(),
        storage.getDataModelObjectAttributes(),
        storage.getDataObjectRelationships(),
        storage.getDataModelObjectRelationships(),
        storage.getDataModelProperties(),
        storage.getSystems(),
        storage.getDataModels(),
        storage.getDataDomains(),
        storage.getDataAreas()
      ]);

      const systemById = new Map<number, System>();
      systems.forEach((system) => {
        systemById.set(system.id, system);
      });

      const modelById = new Map<number, DataModel>();
      models.forEach((model) => {
        modelById.set(model.id, model);
      });

      const domainById = new Map<number, DataDomain>();
      domains.forEach((domain) => {
        domainById.set(domain.id, domain);
      });

      const areaById = new Map<number, DataArea>();
      areas.forEach((area) => {
        areaById.set(area.id, area);
      });

      const attributesByObjectId = new Map<number, Attribute[]>();
      attributes.forEach((attr) => {
        const list = attributesByObjectId.get(attr.objectId) ?? [];
        list.push(attr);
        attributesByObjectId.set(attr.objectId, list);
      });

      const modelObjectsByObjectId = new Map<number, DataModelObject[]>();
      const modelObjectById = new Map<number, DataModelObject>();
      modelObjects.forEach((modelObject) => {
        modelObjectById.set(modelObject.id, modelObject);
        const list = modelObjectsByObjectId.get(modelObject.objectId) ?? [];
        list.push(modelObject);
        modelObjectsByObjectId.set(modelObject.objectId, list);
      });

      const modelAttributesByModelObjectId = new Map<number, DataModelObjectAttribute[]>();
      const modelAttributesByAttributeId = new Map<number, DataModelObjectAttribute[]>();
      modelAttributes.forEach((modelAttr) => {
        const listByModelObject = modelAttributesByModelObjectId.get(modelAttr.modelObjectId) ?? [];
        listByModelObject.push(modelAttr);
        modelAttributesByModelObjectId.set(modelAttr.modelObjectId, listByModelObject);

        const listByAttribute = modelAttributesByAttributeId.get(modelAttr.attributeId) ?? [];
        listByAttribute.push(modelAttr);
        modelAttributesByAttributeId.set(modelAttr.attributeId, listByAttribute);
      });

      const modelRelationshipsByModelObjectId = new Map<number, DataModelObjectRelationship[]>();
      modelRelationships.forEach((rel) => {
        const sourceList = modelRelationshipsByModelObjectId.get(rel.sourceModelObjectId) ?? [];
        sourceList.push(rel);
        modelRelationshipsByModelObjectId.set(rel.sourceModelObjectId, sourceList);

        const targetList = modelRelationshipsByModelObjectId.get(rel.targetModelObjectId) ?? [];
        targetList.push(rel);
        modelRelationshipsByModelObjectId.set(rel.targetModelObjectId, targetList);
      });

      const globalRelationshipsByObjectId = new Map<number, DataObjectRelationship[]>();
      relationships.forEach((rel) => {
        const sourceList = globalRelationshipsByObjectId.get(rel.sourceDataObjectId) ?? [];
        sourceList.push(rel);
        globalRelationshipsByObjectId.set(rel.sourceDataObjectId, sourceList);

        const targetList = globalRelationshipsByObjectId.get(rel.targetDataObjectId) ?? [];
        targetList.push(rel);
        globalRelationshipsByObjectId.set(rel.targetDataObjectId, targetList);
      });

      const propertiesByType = new Map<string, Map<number, DataModelProperty[]>>();
      const propertyTypeAliases: Record<string, string> = {
        object: "object",
        data_object: "object",
        dataobject: "object",
        "model-object": "model_object",
        model_object: "model_object",
        modelobject: "model_object",
        data_model_object: "model_object",
        attribute: "attribute",
        data_attribute: "attribute",
        dataattribute: "attribute"
      };

      const normalizePropertyType = (rawType: string): string => {
        const key = rawType.toLowerCase().replace(/\s+/g, "_");
        return propertyTypeAliases[key] ?? key;
      };

      properties.forEach((property) => {
        const typeKey = normalizePropertyType(property.entityType);
        const typeMap = propertiesByType.get(typeKey) ?? new Map<number, DataModelProperty[]>();
        const list = typeMap.get(property.entityId) ?? [];
        list.push(property);
        typeMap.set(property.entityId, list);
        propertiesByType.set(typeKey, typeMap);
      });

      const getPropertiesFor = (entityTypeKeys: string[], entityId: number): DataModelProperty[] => {
        const results: DataModelProperty[] = [];
        for (const key of entityTypeKeys) {
          const typeMap = propertiesByType.get(key);
          if (!typeMap) continue;
          const props = typeMap.get(entityId);
          if (props) {
            results.push(...props);
          }
        }
        return results;
      };

      type ObjectLakeModelAttribute = {
        id: number;
        modelId: number;
        modelObjectId: number;
        conceptualType: string | null;
        logicalType: string | null;
        physicalType: string | null;
        nullable: boolean | null;
        isPrimaryKey: boolean | null;
        isForeignKey: boolean | null;
        orderIndex: number | null;
        layerSpecificConfig: Record<string, any> | null;
      };

      type ObjectLakeRelationship = {
        id: number;
        modelId: number | null;
        layer: string | null;
        sourceModelObjectId: number | null;
        targetModelObjectId: number | null;
        type: string;
        relationshipLevel: string;
        name: string | null;
        description: string | null;
      };

      type ObjectLakeObject = {
        id: number;
        name: string;
        description: string | null;
        objectType: string | null;
        domain: DataDomain | null;
        dataArea: DataArea | null;
        sourceSystem: System | null;
        targetSystem: System | null;
        baseModel: DataModel | null;
        baseMetadata: {
          position?: Record<string, any> | null;
          metadata?: Record<string, any> | null;
          commonProperties?: Record<string, any> | null;
        };
        stats: {
          attributeCount: number;
          relationshipCount: number;
          modelInstanceCount: number;
          lastUpdated: string | null;
        };
        modelInstances: Array<{
          id: number;
          model: DataModel | null;
          targetSystem: System | null;
          position: Record<string, any> | null;
          metadata: Record<string, any> | null;
          isVisible: boolean;
          layerSpecificConfig: Record<string, any> | null;
          properties: DataModelProperty[];
          attributes: ObjectLakeModelAttribute[];
          relationships: ObjectLakeRelationship[];
        }>;
        attributes: Array<{
          id: number;
          name: string;
          description: string | null;
          nullable: boolean;
          isPrimaryKey: boolean;
          isForeignKey: boolean;
          dataType: string | null;
          conceptualType: string | null;
          logicalType: string | null;
          physicalType: string | null;
          length: number | null;
          precision: number | null;
          scale: number | null;
          orderIndex: number | null;
          commonProperties: Record<string, any> | null;
          metadataByModel: Record<number, ObjectLakeModelAttribute>;
          properties: DataModelProperty[];
        }>;
        relationships: {
          global: ObjectLakeRelationship[];
          modelSpecific: ObjectLakeRelationship[];
        };
        properties: DataModelProperty[];
        tags: string[];
        updatedAt: string | null;
      };

      const buildModelRelationshipSummary = (rel: DataModelObjectRelationship): ObjectLakeRelationship => ({
        id: rel.id,
        modelId: rel.modelId,
        layer: rel.layer,
        sourceModelObjectId: rel.sourceModelObjectId,
        targetModelObjectId: rel.targetModelObjectId,
        type: rel.type,
        relationshipLevel: rel.relationshipLevel,
        name: rel.name ?? null,
        description: rel.description ?? null
      });

      const buildGlobalRelationshipSummary = (rel: DataObjectRelationship): ObjectLakeRelationship => ({
        id: rel.id,
        modelId: null,
        layer: null,
        sourceModelObjectId: null,
        targetModelObjectId: null,
        type: rel.type,
        relationshipLevel: rel.relationshipLevel,
        name: rel.name ?? null,
        description: rel.description ?? null
      });

      const enrichedObjects: ObjectLakeObject[] = objects.map((object) => {
        const attributeList = attributesByObjectId.get(object.id) ?? [];
        const globalRels = globalRelationshipsByObjectId.get(object.id) ?? [];
        const instanceListRaw = modelObjectsByObjectId.get(object.id) ?? [];
        const visibleInstances = includeHiddenInstances
          ? instanceListRaw
          : instanceListRaw.filter((instance) => instance.isVisible !== false);

        const modelInstances = visibleInstances.map((instance) => {
          const instanceModel = modelById.get(instance.modelId) ?? null;
          const targetSystem = instance.targetSystemId ? systemById.get(instance.targetSystemId) ?? null : null;
          const instanceAttributes = modelAttributesByModelObjectId.get(instance.id) ?? [];
          const instanceRelationships = modelRelationshipsByModelObjectId.get(instance.id) ?? [];

          const detailedAttributes: ObjectLakeModelAttribute[] = instanceAttributes.map((modelAttr) => ({
            id: modelAttr.id,
            modelId: modelAttr.modelId,
            modelObjectId: modelAttr.modelObjectId,
            conceptualType: modelAttr.conceptualType ?? null,
            logicalType: modelAttr.logicalType ?? null,
            physicalType: modelAttr.physicalType ?? null,
            nullable: modelAttr.nullable ?? null,
            isPrimaryKey: modelAttr.isPrimaryKey ?? null,
            isForeignKey: modelAttr.isForeignKey ?? null,
            orderIndex: modelAttr.orderIndex ?? null,
            layerSpecificConfig: modelAttr.layerSpecificConfig ?? null
          }));

          const detailedRelationships = instanceRelationships.map(buildModelRelationshipSummary);

          return {
            id: instance.id,
            model: instanceModel,
            targetSystem,
            position: instance.position ?? null,
            metadata: instance.metadata ?? null,
            isVisible: instance.isVisible ?? true,
            layerSpecificConfig: instance.layerSpecificConfig ?? null,
            properties: getPropertiesFor(["model_object"], instance.id),
            attributes: detailedAttributes,
            relationships: detailedRelationships
          };
        });

        const attributeSummaries = attributeList.map((attr) => {
          const metadataMap: Record<number, ObjectLakeModelAttribute> = {};
          const overrides = modelAttributesByAttributeId.get(attr.id) ?? [];
          overrides.forEach((override) => {
            metadataMap[override.modelId] = {
              id: override.id,
              modelId: override.modelId,
              modelObjectId: override.modelObjectId,
              conceptualType: override.conceptualType ?? null,
              logicalType: override.logicalType ?? null,
              physicalType: override.physicalType ?? null,
              nullable: override.nullable ?? null,
              isPrimaryKey: override.isPrimaryKey ?? null,
              isForeignKey: override.isForeignKey ?? null,
              orderIndex: override.orderIndex ?? null,
              layerSpecificConfig: override.layerSpecificConfig ?? null
            };
          });

          return {
            id: attr.id,
            name: attr.name,
            description: attr.description ?? null,
            nullable: attr.nullable ?? true,
            isPrimaryKey: attr.isPrimaryKey ?? false,
            isForeignKey: attr.isForeignKey ?? false,
            dataType: attr.dataType ?? null,
            conceptualType: attr.conceptualType ?? null,
            logicalType: attr.logicalType ?? null,
            physicalType: attr.physicalType ?? null,
            length: attr.length ?? null,
            precision: attr.precision ?? null,
            scale: attr.scale ?? null,
            orderIndex: attr.orderIndex ?? null,
            commonProperties: attr.commonProperties ?? null,
            metadataByModel: metadataMap,
            properties: getPropertiesFor(["attribute"], attr.id)
          };
        });

        const modelSpecificRelationships = modelInstances.flatMap((instance) => instance.relationships);
        const globalRelationshipSummaries = globalRels.map(buildGlobalRelationshipSummary);

        const domain = object.domainId ? domainById.get(object.domainId) ?? null : null;
        const dataArea = object.dataAreaId ? areaById.get(object.dataAreaId) ?? null : null;
        const baseModel = object.modelId ? modelById.get(object.modelId) ?? null : null;
        const sourceSystem = object.sourceSystemId ? systemById.get(object.sourceSystemId) ?? null : null;
        const targetSystem = object.targetSystemId ? systemById.get(object.targetSystemId) ?? null : null;

        const stats = {
          attributeCount: attributeSummaries.length,
          relationshipCount: globalRelationshipSummaries.length + modelSpecificRelationships.length,
          modelInstanceCount: modelInstances.length,
          lastUpdated: object.updatedAt ? new Date(object.updatedAt).toISOString() : null
        };

        const tags = [object.objectType, domain?.name, dataArea?.name].filter((value): value is string => Boolean(value));

        return {
          id: object.id,
          name: object.name,
          description: object.description ?? null,
          objectType: object.objectType ?? null,
          domain,
          dataArea,
          sourceSystem,
          targetSystem,
          baseModel,
          baseMetadata: {
            position: object.position ?? null,
            metadata: object.metadata ?? null,
            commonProperties: object.commonProperties ?? null
          },
          stats,
          modelInstances,
          attributes: attributeSummaries,
          relationships: {
            global: globalRelationshipSummaries,
            modelSpecific: modelSpecificRelationships
          },
          properties: getPropertiesFor(["object"], object.id),
          tags,
          updatedAt: stats.lastUpdated
        };
      });

      const filteredObjects = enrichedObjects.filter((object) => {
        if (search) {
          const searchValue = search.toLowerCase();
          const matchesSearch =
            object.name.toLowerCase().includes(searchValue) ||
            (object.description?.toLowerCase().includes(searchValue) ?? false) ||
            (object.sourceSystem?.name.toLowerCase().includes(searchValue) ?? false) ||
            (object.targetSystem?.name.toLowerCase().includes(searchValue) ?? false) ||
            object.tags.some((tag) => tag.toLowerCase().includes(searchValue));
          if (!matchesSearch) {
            return false;
          }
        }

        if (selectedDomainId !== null && object.domain?.id !== selectedDomainId) {
          return false;
        }

        if (selectedAreaId !== null && object.dataArea?.id !== selectedAreaId) {
          return false;
        }

        if (selectedSystemId !== null) {
          const matchesBaseSystem =
            object.sourceSystem?.id === selectedSystemId ||
            object.targetSystem?.id === selectedSystemId;
          const matchesInstanceSystem = object.modelInstances.some((instance) => instance.targetSystem?.id === selectedSystemId);
          if (!matchesBaseSystem && !matchesInstanceSystem) {
            return false;
          }
        }

        if (selectedModelId !== null) {
          const matchesBaseModel = object.baseModel?.id === selectedModelId;
          const matchesInstanceModel = object.modelInstances.some((instance) => instance.model?.id === selectedModelId);
          if (!matchesBaseModel && !matchesInstanceModel) {
            return false;
          }
        }

        if (normalizedLayer) {
          const matchesBaseLayer = object.baseModel?.layer?.toLowerCase() === normalizedLayer;
          const matchesInstanceLayer = object.modelInstances.some((instance) => instance.model?.layer?.toLowerCase() === normalizedLayer);
          if (!matchesBaseLayer && !matchesInstanceLayer) {
            return false;
          }
        }

        if (normalizedObjectType && object.objectType?.toLowerCase() !== normalizedObjectType) {
          return false;
        }

        if (hasAttributesFilter !== null) {
          if (hasAttributesFilter && object.stats.attributeCount === 0) {
            return false;
          }
          if (!hasAttributesFilter && object.stats.attributeCount > 0) {
            return false;
          }
        }

        if (normalizedRelationshipType) {
          const hasRelationship =
            object.relationships.global.some((rel) => rel.type.toUpperCase() === normalizedRelationshipType) ||
            object.relationships.modelSpecific.some((rel) => rel.type.toUpperCase() === normalizedRelationshipType);
          if (!hasRelationship) {
            return false;
          }
        }

        return true;
      });

      const sortMultiplier = sortDirection === "desc" ? -1 : 1;
      filteredObjects.sort((a, b) => {
        const compareByKey = (key: typeof sortKey): number => {
          switch (key) {
            case "updatedAt": {
              const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
              const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
              return aTime - bTime;
            }
            case "attributeCount":
              return a.stats.attributeCount - b.stats.attributeCount;
            case "modelInstanceCount":
              return a.stats.modelInstanceCount - b.stats.modelInstanceCount;
            case "relationshipCount":
              return a.stats.relationshipCount - b.stats.relationshipCount;
            case "name":
            default:
              return a.name.localeCompare(b.name);
          }
        };

        const result = compareByKey(sortKey);
        return result * sortMultiplier;
      });

      const startIndex = (pageNumber - 1) * pageSizeNumber;
      const endIndex = startIndex + pageSizeNumber;
      const paginatedObjects = filteredObjects.slice(startIndex, endIndex);

      const totalAttributeCount = filteredObjects.reduce((sum, obj) => sum + obj.stats.attributeCount, 0);
      const totalRelationshipCount = filteredObjects.reduce((sum, obj) => sum + obj.stats.relationshipCount, 0);
      const totalModelInstances = filteredObjects.reduce((sum, obj) => sum + obj.stats.modelInstanceCount, 0);

      res.json({
        objects: paginatedObjects,
        totals: {
          objectCount: filteredObjects.length,
          attributeCount: totalAttributeCount,
          relationshipCount: totalRelationshipCount,
          modelInstanceCount: totalModelInstances
        },
        appliedFilters: {
          search: search ?? null,
          domainId: selectedDomainId,
          dataAreaId: selectedAreaId,
          systemId: selectedSystemId,
          modelId: selectedModelId,
          layer: normalizedLayer,
          objectType: normalizedObjectType,
          hasAttributes: hasAttributesFilter,
          relationshipType: normalizedRelationshipType,
          includeHidden: includeHiddenInstances,
          sortBy: sortKey,
          sortOrder: sortDirection
        },
        meta: {
          page: pageNumber,
          pageSize: pageSizeNumber,
          hasMore: endIndex < filteredObjects.length,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Failed to build Object Lake response:", error);
      res.status(500).json({ message: "Failed to load object lake data" });
    }
  });

  // Data Object Relationships
  app.get("/api/object-relationships", async (_req, res) => {
    try {
      const relationships = await storage.getDataObjectRelationships();
      res.json(relationships);
    } catch (error) {
      console.error("Failed to fetch data object relationships:", error);
      res.status(500).json({ message: "Failed to fetch data object relationships" });
    }
  });

  app.get("/api/object-relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid relationship id" });
      }

      const relationship = await storage.getDataObjectRelationship(id);
      if (!relationship) {
        return res.status(404).json({ message: "Relationship not found" });
      }

      res.json(relationship);
    } catch (error) {
      console.error("Failed to fetch data object relationship:", error);
      res.status(500).json({ message: "Failed to fetch data object relationship" });
    }
  });

  app.get("/api/objects/:objectId/relationships", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      if (Number.isNaN(objectId)) {
        return res.status(400).json({ message: "Invalid object id" });
      }

      const relationships = await storage.getDataObjectRelationshipsByObject(objectId);
      res.json(relationships);
    } catch (error) {
      console.error("Failed to fetch relationships for object:", error);
      res.status(500).json({ message: "Failed to fetch relationships for object" });
    }
  });

  app.post("/api/object-relationships", async (req, res) => {
    try {
      const validatedData = insertDataObjectRelationshipSchema.parse(req.body);
      const relationship = await storage.createDataObjectRelationship(validatedData);
      res.status(201).json(relationship);
    } catch (error: any) {
      console.error("Invalid data object relationship payload:", error);
      if (error?.name === "ZodError") {
        res.status(400).json({ message: "Invalid relationship data", details: error.errors });
      } else {
        res.status(400).json({ message: "Invalid relationship data" });
      }
    }
  });

  app.put("/api/object-relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid relationship id" });
      }

      const validatedData = insertDataObjectRelationshipSchema.partial().parse(req.body);
      const relationship = await storage.updateDataObjectRelationship(id, validatedData);
      res.json(relationship);
    } catch (error: any) {
      console.error("Failed to update data object relationship:", error);
      if (error?.name === "ZodError") {
        res.status(400).json({ message: "Invalid relationship data", details: error.errors });
      } else {
        res.status(400).json({ message: "Failed to update relationship" });
      }
    }
  });

  app.delete("/api/object-relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid relationship id" });
      }

      await storage.deleteDataObjectRelationship(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete data object relationship:", error);
      res.status(500).json({ message: "Failed to delete relationship" });
    }
  });

  // Data Model Object Relationships
  app.get("/api/models/:modelId/relationships", async (req, res) => {
    try {
      const modelId = parseInt(req.params.modelId);
      if (Number.isNaN(modelId)) {
        return res.status(400).json({ message: "Invalid model id" });
      }

      const [relationships, modelObjects, dataObjectRelationships] = await Promise.all([
        storage.getDataModelObjectRelationshipsByModel(modelId),
        storage.getDataModelObjectsByModel(modelId),
        storage.getDataObjectRelationships(),
      ]);

      const objectIdByModelObjectId = new Map(modelObjects.map((modelObject) => [modelObject.id, modelObject.objectId]));
      const relevantObjectIds = new Set(modelObjects.map((modelObject) => modelObject.objectId));
      const globalRelationshipMap = new Map<string, DataObjectRelationship>();

      for (const relationship of dataObjectRelationships) {
        if (
          !relevantObjectIds.has(relationship.sourceDataObjectId) ||
          !relevantObjectIds.has(relationship.targetDataObjectId)
        ) {
          continue;
        }

        const key = buildRelationshipKey(
          relationship.sourceDataObjectId,
          relationship.targetDataObjectId,
          relationship.relationshipLevel === "attribute" ? "attribute" : "object",
          relationship.sourceAttributeId ?? null,
          relationship.targetAttributeId ?? null,
        );

        if (!globalRelationshipMap.has(key)) {
          globalRelationshipMap.set(key, relationship);
        }
      }

      const enrichedRelationships = relationships.map((relationship) => {
        const sourceObjectId = objectIdByModelObjectId.get(relationship.sourceModelObjectId);
        const targetObjectId = objectIdByModelObjectId.get(relationship.targetModelObjectId);
        let dataObjectRelationshipId: number | null = null;

        if (typeof sourceObjectId === "number" && typeof targetObjectId === "number") {
          const key = buildRelationshipKey(
            sourceObjectId,
            targetObjectId,
            relationship.relationshipLevel === "attribute" ? "attribute" : "object",
            relationship.sourceAttributeId ?? null,
            relationship.targetAttributeId ?? null,
          );

          dataObjectRelationshipId = globalRelationshipMap.get(key)?.id ?? null;
        }

        return {
          ...relationship,
          dataObjectRelationshipId,
        };
      });

      res.json(enrichedRelationships);
    } catch (error) {
      console.error("Failed to fetch relationships:", error);
      res.status(500).json({ message: "Failed to fetch relationships" });
    }
  });

  app.post("/api/relationships", async (req, res) => {
    try {
      const payload = createRelationshipRequestSchema.parse(req.body);

      if (payload.sourceObjectId === payload.targetObjectId) {
        return res.status(400).json({ message: "Source and target objects must be different" });
      }

      const model = await storage.getDataModel(payload.modelId);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
      }

      const modelObjects = await storage.getDataModelObjectsByModel(payload.modelId);
      const sourceModelObject = modelObjects.find((modelObject) => modelObject.objectId === payload.sourceObjectId);
      const targetModelObject = modelObjects.find((modelObject) => modelObject.objectId === payload.targetObjectId);

      if (!sourceModelObject || !targetModelObject) {
        return res.status(404).json({ message: "Model objects not found for provided source/target" });
      }

      // Store the global attribute IDs for the data_object_relationships table
      const globalSourceAttributeId = payload.sourceAttributeId ?? null;
      const globalTargetAttributeId = payload.targetAttributeId ?? null;
      const relationshipLevel = determineRelationshipLevel(globalSourceAttributeId, globalTargetAttributeId);

      const existingGlobalRelationships = await storage.getDataObjectRelationshipsByObject(payload.sourceObjectId);
      let dataObjectRelationship = findMatchingDataObjectRelationship(
        existingGlobalRelationships,
        payload.sourceObjectId,
        payload.targetObjectId,
        relationshipLevel,
        globalSourceAttributeId,
        globalTargetAttributeId,
      );

      if (dataObjectRelationship) {
        const updatePayload: Record<string, unknown> = {};

        if (dataObjectRelationship.type !== payload.type) {
          updatePayload.type = payload.type;
        }

        if ((dataObjectRelationship.sourceAttributeId ?? null) !== globalSourceAttributeId) {
          updatePayload.sourceAttributeId = globalSourceAttributeId;
        }

        if ((dataObjectRelationship.targetAttributeId ?? null) !== globalTargetAttributeId) {
          updatePayload.targetAttributeId = globalTargetAttributeId;
        }

        if ((dataObjectRelationship.name ?? null) !== (payload.name ?? null)) {
          updatePayload.name = payload.name ?? null;
        }

        if ((dataObjectRelationship.description ?? null) !== (payload.description ?? null)) {
          updatePayload.description = payload.description ?? null;
        }

        if (payload.metadata !== undefined) {
          updatePayload.metadata = payload.metadata ?? null;
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
            sourceDataObjectId: payload.sourceObjectId,
            targetDataObjectId: payload.targetObjectId,
            type: payload.type,
            relationshipLevel,
            sourceAttributeId: globalSourceAttributeId ?? undefined,
            targetAttributeId: globalTargetAttributeId ?? undefined,
            name: payload.name === undefined ? undefined : payload.name,
            description: payload.description === undefined ? undefined : payload.description,
            metadata: payload.metadata === undefined ? undefined : payload.metadata,
          }),
        );
      }

      const familyRelationships = await synchronizeFamilyRelationships({
        baseModel: model,
        sourceObjectId: payload.sourceObjectId,
        targetObjectId: payload.targetObjectId,
        type: payload.type,
        relationshipLevel,
        sourceAttributeId: globalSourceAttributeId,
        targetAttributeId: globalTargetAttributeId,
        name: payload.name ?? null,
        description: payload.description ?? null,
      });

      const currentRelationship = familyRelationships.get(model.id);

      res.status(201).json({
        ...(currentRelationship ?? {}),
        dataObjectRelationshipId: dataObjectRelationship?.id ?? null,
        syncedModelIds: Array.from(familyRelationships.keys()),
      });
    } catch (error) {
      console.error("Failed to create relationship:", error);
      res.status(400).json({ message: "Invalid relationship data" });
    }
  });

  app.put("/api/relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid relationship id" });
      }

      const payload = updateRelationshipRequestSchema.parse(req.body);
      const existing = await storage.getDataModelObjectRelationship(id);

      if (!existing) {
        return res.status(404).json({ message: "Relationship not found" });
      }

      const [sourceModelObject, targetModelObject] = await Promise.all([
        storage.getDataModelObject(existing.sourceModelObjectId),
        storage.getDataModelObject(existing.targetModelObjectId),
      ]);

      if (!sourceModelObject || !targetModelObject) {
        return res.status(404).json({ message: "Related model objects not found" });
      }

      const model = await storage.getDataModel(existing.modelId);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
      }

      const sourceAttributeProvided = Object.prototype.hasOwnProperty.call(req.body, "sourceAttributeId");
      const targetAttributeProvided = Object.prototype.hasOwnProperty.call(req.body, "targetAttributeId");

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
        ? await resolveGlobalAttributeId(payload.sourceAttributeId ?? null)
        : existingSourceAttributeGlobal;

      const finalTargetAttributeGlobalId = targetAttributeProvided
        ? await resolveGlobalAttributeId(payload.targetAttributeId ?? null)
        : existingTargetAttributeGlobal;

      const finalType = payload.type ?? existing.type;
      const finalRelationshipLevel = determineRelationshipLevel(
        finalSourceAttributeGlobalId,
        finalTargetAttributeGlobalId,
      );
      const finalName = Object.prototype.hasOwnProperty.call(req.body, "name")
        ? payload.name ?? null
        : existing.name ?? null;
      const finalDescription = Object.prototype.hasOwnProperty.call(req.body, "description")
        ? payload.description ?? null
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

        if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
          globalUpdate.name = finalName;
        }

        if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
          globalUpdate.description = finalDescription;
        }

        if (Object.prototype.hasOwnProperty.call(req.body, "metadata")) {
          globalUpdate.metadata = payload.metadata ?? null;
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
            name: Object.prototype.hasOwnProperty.call(req.body, "name")
              ? finalName
              : existing.name ?? undefined,
            description: Object.prototype.hasOwnProperty.call(req.body, "description")
              ? finalDescription
              : existing.description ?? undefined,
            metadata: payload.metadata === undefined ? undefined : payload.metadata,
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

      res.json({
        ...(currentRelationship ?? existing),
        dataObjectRelationshipId: dataObjectRelationship?.id ?? null,
        syncedModelIds: Array.from(familyRelationships.keys()),
      });
    } catch (error) {
      console.error("Failed to update relationship:", error);
      res.status(400).json({ message: "Failed to update relationship" });
    }
  });

  app.delete("/api/relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid relationship id" });
      }

      const existing = await storage.getDataModelObjectRelationship(id);

      if (!existing) {
        return res.status(404).json({ message: "Relationship not found" });
      }

      const [sourceModelObject, targetModelObject] = await Promise.all([
        storage.getDataModelObject(existing.sourceModelObjectId),
        storage.getDataModelObject(existing.targetModelObjectId),
      ]);

      const model = await storage.getDataModel(existing.modelId);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
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
      const relationshipLevel = determineRelationshipLevel(sourceAttributeGlobalId, targetAttributeGlobalId);

      if (sourceObjectId !== null && targetObjectId !== null) {
        await removeFamilyRelationships({
          baseModel: model,
          sourceObjectId,
          targetObjectId,
          type: existing.type,
          relationshipLevel,
          sourceAttributeId: sourceAttributeGlobalId,
          targetAttributeId: targetAttributeGlobalId,
          name: existing.name ?? null,
          description: existing.description ?? null,
        });

        const possibleGlobalRelationships = await storage.getDataObjectRelationshipsByObject(sourceObjectId);

        const dataObjectRelationship = findMatchingDataObjectRelationship(
          possibleGlobalRelationships,
          sourceObjectId,
          targetObjectId,
          relationshipLevel,
          sourceAttributeGlobalId,
          targetAttributeGlobalId,
        );

        if (dataObjectRelationship) {
          await storage.deleteDataObjectRelationship(dataObjectRelationship.id);
        }
      }

      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete relationship:", error);
      res.status(500).json({ message: "Failed to delete relationship" });
    }
  });

  // Systems (backward compatible with /api/sources route)
  app.get("/api/sources", async (req, res) => {
    try {
      const systems = await storage.getSystems();
      res.json(systems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch systems" });
    }
  });

  app.get("/api/sources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const system = await storage.getSystem(id);
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }
      res.json(system);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system" });
    }
  });

  app.get("/api/systems", async (req, res) => {
    try {
      const systems = await storage.getSystems();
      res.json(systems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch systems" });
    }
  });

  app.get("/api/systems/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const system = await storage.getSystem(id);
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }
      res.json(system);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system" });
    }
  });

  app.post("/api/sources", async (req, res) => {
    try {
      const validatedData = insertSystemSchema.parse(req.body);
      const system = await storage.createSystem(validatedData);
      res.status(201).json(system);
    } catch (error: any) {
      console.error("Failed to create system:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid system data", details: error.errors });
      } else {
        res.status(500).json({ message: error.message || "Failed to create system" });
      }
    }
  });

  app.post("/api/systems", async (req, res) => {
    try {
      const validatedData = insertSystemSchema.parse(req.body);
      const system = await storage.createSystem(validatedData);
      res.status(201).json(system);
    } catch (error: any) {
      console.error("Failed to create system:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid system data", details: error.errors });
      } else {
        res.status(500).json({ message: error.message || "Failed to create system" });
      }
    }
  });

  app.patch("/api/sources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSystemSchema.partial().parse(req.body);
      const system = await storage.updateSystem(id, validatedData);
      res.json(system);
    } catch (error) {
      res.status(400).json({ message: "Failed to update system" });
    }
  });

  app.patch("/api/systems/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSystemSchema.partial().parse(req.body);
      const system = await storage.updateSystem(id, validatedData);
      res.json(system);
    } catch (error) {
      res.status(400).json({ message: "Failed to update system" });
    }
  });

  // PUT endpoint for /api/sources/:id (full update)
  app.put("/api/sources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSystemSchema.parse(req.body);
      const system = await storage.updateSystem(id, validatedData);
      res.json(system);
    } catch (error: any) {
      console.error("Failed to update system:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid system data", details: error.errors });
      } else {
        res.status(500).json({ message: error.message || "Failed to update system" });
      }
    }
  });

  // DELETE endpoint for /api/sources/:id
  app.delete("/api/sources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSystem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete system:", error);
      res.status(500).json({ message: "Failed to delete system" });
    }
  });

  // PUT endpoint for /api/systems/:id (full update)
  app.put("/api/systems/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSystemSchema.parse(req.body);
      const system = await storage.updateSystem(id, validatedData);
      res.json(system);
    } catch (error: any) {
      console.error("Failed to update system:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid system data", details: error.errors });
      } else {
        res.status(500).json({ message: error.message || "Failed to update system" });
      }
    }
  });

  // DELETE endpoint for /api/systems/:id
  app.delete("/api/systems/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSystem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete system:", error);
      res.status(500).json({ message: "Failed to delete system" });
    }
  });

  app.get("/api/systems/:id/objects", async (req, res) => {
    try {
      const systemId = parseInt(req.params.id);
      if (!Number.isFinite(systemId)) {
        return res.status(400).json({ message: "Invalid system id" });
      }

      const system = await storage.getSystem(systemId);
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }

      const roleParam = typeof req.query.role === "string" ? req.query.role.toLowerCase() : "all";
      const role: SystemObjectDirection | "all" = roleParam === "source" || roleParam === "target" ? (roleParam as SystemObjectDirection) : "all";

      let objects: DataObject[] = [];
      if (role === "source") {
        objects = await storage.getDataObjectsBySourceSystem(systemId);
      } else if (role === "target") {
        objects = await storage.getDataObjectsByTargetSystem(systemId);
      } else {
        const [sourceObjects, targetObjects] = await Promise.all([
          storage.getDataObjectsBySourceSystem(systemId),
          storage.getDataObjectsByTargetSystem(systemId),
        ]);
        const dedup = new Map<number, DataObject>();
        sourceObjects.forEach((object) => dedup.set(object.id, object));
        targetObjects.forEach((object) => dedup.set(object.id, object));
        objects = Array.from(dedup.values());
      }

      const [models, attributes] = await Promise.all([
        storage.getDataModels(),
        storage.getAllAttributes(),
      ]);

      const attributeCounts = new Map<number, number>();
      attributes.forEach((attribute) => {
        const count = attributeCounts.get(attribute.objectId) ?? 0;
        attributeCounts.set(attribute.objectId, count + 1);
      });

      const modelMap = new Map<number, DataModel>();
      models.forEach((model) => modelMap.set(model.id, model));

      const enriched = objects.map((object) => {
        const modelInfo = modelMap.get(object.modelId);
        return {
          ...object,
          attributeCount: attributeCounts.get(object.id) ?? 0,
          model: modelInfo
            ? {
                id: modelInfo.id,
                name: modelInfo.name,
                layer: modelInfo.layer,
              }
            : null,
          systemAssociation:
            object.sourceSystemId === systemId
              ? "source"
              : object.targetSystemId === systemId
                ? "target"
                : null,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Failed to fetch system objects:", error);
      res.status(500).json({ message: "Failed to fetch system objects" });
    }
  });

  app.patch("/api/systems/:id/objects/:objectId", async (req, res) => {
    try {
      const systemId = parseInt(req.params.id);
      const objectId = parseInt(req.params.objectId);
      if (!Number.isFinite(systemId) || !Number.isFinite(objectId)) {
        return res.status(400).json({ message: "Invalid identifiers" });
      }

      const [system, object] = await Promise.all([
        storage.getSystem(systemId),
        storage.getDataObject(objectId),
      ]);

      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }

      if (!object) {
        return res.status(404).json({ message: "Object not found" });
      }

      const association: SystemObjectDirection | null = object.sourceSystemId === systemId
        ? "source"
        : object.targetSystemId === systemId
          ? "target"
          : null;

      if (!association) {
        return res.status(400).json({ message: "Object is not associated with this system" });
      }

      const parsed = systemObjectUpdateSchema.parse(req.body ?? {});

      let domainId = parsed.domainId ?? null;
      let dataAreaId = parsed.dataAreaId ?? null;

      if (domainId !== null) {
        const domain = await storage.getDataDomain(domainId);
        if (!domain) {
          return res.status(400).json({ message: "Provided domain does not exist" });
        }
      }

      if (dataAreaId !== null) {
        const area = await storage.getDataArea(dataAreaId);
        if (!area) {
          return res.status(400).json({ message: "Provided data area does not exist" });
        }
        if (domainId !== null && area.domainId !== domainId) {
          return res.status(400).json({ message: "Data area does not belong to the specified domain" });
        }
        if (domainId === null) {
          domainId = area.domainId;
        }
      }

      const updated = await storage.updateDataObject(objectId, {
        domainId,
        dataAreaId,
        description: parsed.description ?? object.description,
      });

      res.json({
        ...updated,
        systemAssociation: association,
      });
    } catch (error) {
      console.error("Failed to update system object:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", details: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update system object" });
      }
    }
  });

  app.delete("/api/systems/:id/objects/:objectId", async (req, res) => {
    try {
      const systemId = parseInt(req.params.id);
      const objectId = parseInt(req.params.objectId);
      if (!Number.isFinite(systemId) || !Number.isFinite(objectId)) {
        return res.status(400).json({ message: "Invalid identifiers" });
      }

      const [system, object] = await Promise.all([
        storage.getSystem(systemId),
        storage.getDataObject(objectId),
      ]);

      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }

      if (!object) {
        return res.status(404).json({ message: "Object not found" });
      }

      if (object.sourceSystemId !== systemId && object.targetSystemId !== systemId) {
        return res.status(400).json({ message: "Object is not associated with this system" });
      }

      await storage.deleteDataModelObjectsByObject(objectId);
      await storage.deleteDataObjectRelationshipsByObject(objectId);
      await storage.deleteAttributesByObject(objectId);
      await storage.deleteDataObject(objectId);

      res.status(204).send();
    } catch (error) {
      console.error("Failed to remove system object:", error);
      res.status(500).json({ message: "Failed to remove system object" });
    }
  });

  app.post("/api/systems/:id/sync-objects", async (req, res) => {
    try {
      const systemId = parseInt(req.params.id);
      if (!Number.isFinite(systemId)) {
        return res.status(400).json({ message: "Invalid system id" });
      }

      const system = await storage.getSystem(systemId);
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }

      const parsed = systemSyncRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid sync request", details: parsed.error.flatten() });
      }

  const { modelId, direction = "source", includeAttributes = true, domainId, dataAreaId, metadataOnly } = parsed.data;

      if (direction === "source" && system.canBeSource === false) {
        return res.status(400).json({ message: "System cannot act as a source" });
      }

      if (direction === "target" && system.canBeTarget === false) {
        return res.status(400).json({ message: "System cannot act as a target" });
      }

      const model = await storage.getDataModel(modelId);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
      }

      let effectiveDomainId = extractPreferredDomainId(system, domainId ?? null);
      let effectiveDataAreaId = dataAreaId ?? null;

      if (effectiveDataAreaId === null) {
        const preferredAreas = extractPreferredDataAreaIds(system);
        if (preferredAreas.length > 0) {
          effectiveDataAreaId = preferredAreas[0];
        }
      }

      if (effectiveDataAreaId !== null) {
        const area = await storage.getDataArea(effectiveDataAreaId);
        if (!area) {
          return res.status(400).json({ message: "Provided data area does not exist" });
        }
        if (effectiveDomainId !== null && area.domainId !== effectiveDomainId) {
          return res.status(400).json({ message: "Data area does not belong to the specified domain" });
        }
        if (effectiveDomainId === null) {
          effectiveDomainId = area.domainId;
        }
      }

      if (effectiveDomainId !== null) {
        const domain = await storage.getDataDomain(effectiveDomainId);
        if (!domain) {
          return res.status(400).json({ message: "Provided domain does not exist" });
        }
      }

      const connectionOverrides =
        req.body?.connection && typeof req.body.connection === "object"
          ? (req.body.connection as { configuration?: Record<string, unknown>; connectionString?: string | null })
          : undefined;

      const metadata = await retrieveSystemMetadata(system, {
        configurationOverride: connectionOverrides?.configuration,
        connectionStringOverride: connectionOverrides?.connectionString ?? null,
      });

      if (metadataOnly) {
        return res.json({ metadata });
      }

      const existingObjects = await storage.getDataObjectsByModel(modelId);
      const relevantExisting = new Map<string, DataObject>();
      const objectRegistry = new Map<string, DataObject>();
      existingObjects.forEach((object) => {
        const key = object.name.toLowerCase();
        objectRegistry.set(key, object);

        const association: SystemObjectDirection | null = object.sourceSystemId === systemId
          ? "source"
          : object.targetSystemId === systemId
            ? "target"
            : null;
        if (association === direction) {
          relevantExisting.set(key, object);
        }
      });

      const attributeCache = new Map<number, Attribute[]>();
      const loadAttributesForObject = async (objectId: number): Promise<Attribute[]> => {
        if (!attributeCache.has(objectId)) {
          const attrs = await storage.getAttributesByObject(objectId);
          attributeCache.set(objectId, attrs);
        }
        return attributeCache.get(objectId) ?? [];
      };

      const created: DataObject[] = [];
      const updated: DataObject[] = [];
      const attributeSummary: Record<string, number> = {};

      for (const table of metadata) {
        const tableKey = table.name.toLowerCase();
        const existingObject = relevantExisting.get(tableKey);
        const priorObject = objectRegistry.get(tableKey);
        const metadataPayload: Record<string, any> = {
          ...(priorObject?.metadata ?? {}),
          syncedFromSystemId: systemId,
          systemDirection: direction,
          rawMetadata: table,
          syncedAt: new Date().toISOString(),
        };

        if (existingObject) {
          const updatedObject = await storage.updateDataObject(existingObject.id, {
            metadata: metadataPayload,
            domainId: effectiveDomainId ?? existingObject.domainId ?? null,
            dataAreaId: effectiveDataAreaId ?? existingObject.dataAreaId ?? null,
            sourceSystemId: direction === "source" ? systemId : existingObject.sourceSystemId,
            targetSystemId: direction === "target" ? systemId : existingObject.targetSystemId,
            isNew: false,
          });
          updated.push(updatedObject);
          objectRegistry.set(tableKey, updatedObject);

          if (includeAttributes && Array.isArray(table.columns)) {
            attributeCache.delete(updatedObject.id);
            await storage.deleteAttributesByObject(updatedObject.id);
            let attributeCount = 0;
            const attributesForObject: Attribute[] = [];
            for (let index = 0; index < table.columns.length; index++) {
              const column = table.columns[index];
              const attribute = await storage.createAttribute({
                name: column.name,
                objectId: updatedObject.id,
                conceptualType: column.type,
                logicalType: column.type,
                physicalType: column.type,
                nullable: column.nullable ?? true,
                isPrimaryKey: column.isPrimaryKey ?? false,
                dataType: column.type,
                orderIndex: index,
              });
              attributesForObject.push(attribute);
              attributeCount += 1;
            }
            attributeCache.set(updatedObject.id, attributesForObject);
            attributeSummary[updatedObject.id.toString()] = attributeCount;
          }
        } else {
          const createdObject = await storage.createDataObject({
            name: table.name,
            modelId,
            domainId: effectiveDomainId ?? null,
            dataAreaId: effectiveDataAreaId ?? null,
            sourceSystemId: direction === "source" ? systemId : null,
            targetSystemId: direction === "target" ? systemId : null,
            metadata: metadataPayload,
            objectType: Array.isArray(table.columns) && table.columns.length ? "table" : "entity",
            isNew: true,
          });
          created.push(createdObject);
          objectRegistry.set(tableKey, createdObject);

          if (includeAttributes && Array.isArray(table.columns)) {
            let attributeCount = 0;
            const attributesForObject: Attribute[] = [];
            for (let index = 0; index < table.columns.length; index++) {
              const column = table.columns[index];
              const attribute = await storage.createAttribute({
                name: column.name,
                objectId: createdObject.id,
                conceptualType: column.type,
                logicalType: column.type,
                physicalType: column.type,
                nullable: column.nullable ?? true,
                isPrimaryKey: column.isPrimaryKey ?? false,
                dataType: column.type,
                orderIndex: index,
              });
              attributesForObject.push(attribute);
              attributeCount += 1;
            }
            attributeCache.set(createdObject.id, attributesForObject);
            attributeSummary[createdObject.id.toString()] = attributeCount;
          }
        }
      }

      const existingRelationships = await storage.getDataObjectRelationships();
      const relationshipRegistry = new Set<string>();
      existingRelationships.forEach((relationship) => {
        const normalizedLevel: "object" | "attribute" = relationship.relationshipLevel === "attribute" ? "attribute" : "object";
        relationshipRegistry.add(
          buildRelationshipKey(
            relationship.sourceDataObjectId,
            relationship.targetDataObjectId,
            normalizedLevel,
            relationship.sourceAttributeId ?? null,
            relationship.targetAttributeId ?? null,
          ),
        );
      });

      let relationshipsCreated = 0;
      let heuristicRelationshipsCreated = 0;

      for (const table of metadata) {
        const explicitForeignKeys = Array.isArray(table.foreignKeys) ? table.foreignKeys : [];
        const heuristicForeignKeys = generateHeuristicForeignKeys(table, metadata, explicitForeignKeys);
        const candidateForeignKeys = [...explicitForeignKeys, ...heuristicForeignKeys];

        if (candidateForeignKeys.length === 0) {
          continue;
        }

        const sourceKey = table.name.toLowerCase();
        const sourceObject = objectRegistry.get(sourceKey);
        if (!sourceObject) {
          continue;
        }

        const sourceAttributes = await loadAttributesForObject(sourceObject.id);

        for (const fk of candidateForeignKeys) {
          if (!fk || fk.columns.length !== 1 || fk.referencedColumns.length !== 1) {
            continue;
          }

          const normalizedTargetKey = fk.referencedTable.toLowerCase();
          let targetObject = objectRegistry.get(normalizedTargetKey);
          if (!targetObject && normalizedTargetKey.includes(".")) {
            const fallbackKey = normalizedTargetKey.split(".").pop();
            if (fallbackKey) {
              targetObject = objectRegistry.get(fallbackKey);
            }
          }

          if (!targetObject) {
            continue;
          }

          const targetAttributes = await loadAttributesForObject(targetObject.id);
          const sourceAttribute = sourceAttributes.find((attribute) => attribute.name.toLowerCase() === fk.columns[0].toLowerCase());
          const targetAttribute = targetAttributes.find((attribute) => attribute.name.toLowerCase() === fk.referencedColumns[0].toLowerCase());

          const relationshipType = fk.relationshipType ?? "N:1";
          const isHeuristic = fk.constraintName?.startsWith("heuristic_fk_") ?? false;
          const metadataPayload: Record<string, unknown> = {
            constraintName: fk.constraintName ?? null,
            sourceColumn: fk.columns[0],
            targetColumn: fk.referencedColumns[0],
            referencedTable: fk.referencedTable,
            referencedSchema: fk.referencedSchema ?? null,
            updateRule: fk.updateRule ?? null,
            deleteRule: fk.deleteRule ?? null,
            detectionStrategy: isHeuristic ? "heuristic" : "constraint",
          };

          if (sourceAttribute && targetAttribute) {
            const directKey = buildRelationshipKey(
              sourceObject.id,
              targetObject.id,
              "attribute",
              sourceAttribute.id,
              targetAttribute.id,
            );
            const reverseKey = buildRelationshipKey(
              targetObject.id,
              sourceObject.id,
              "attribute",
              targetAttribute.id,
              sourceAttribute.id,
            );

            if (relationshipRegistry.has(directKey) || relationshipRegistry.has(reverseKey)) {
              continue;
            }

            await storage.createDataObjectRelationship({
              sourceDataObjectId: sourceObject.id,
              targetDataObjectId: targetObject.id,
              type: relationshipType,
              relationshipLevel: "attribute",
              sourceAttributeId: sourceAttribute.id,
              targetAttributeId: targetAttribute.id,
              name: fk.constraintName ?? `${sourceObject.name}.${sourceAttribute.name} → ${targetObject.name}.${targetAttribute.name}`,
              description: "Auto-created from system sync metadata",
              metadata: metadataPayload,
            });

            relationshipRegistry.add(directKey);
            relationshipsCreated += 1;
            if (isHeuristic) {
              heuristicRelationshipsCreated += 1;
            }
            continue;
          }

          const objectLevelKey = buildRelationshipKey(
            sourceObject.id,
            targetObject.id,
            "object",
            null,
            null,
          );
          const reverseObjectKey = buildRelationshipKey(
            targetObject.id,
            sourceObject.id,
            "object",
            null,
            null,
          );

          if (relationshipRegistry.has(objectLevelKey) || relationshipRegistry.has(reverseObjectKey)) {
            continue;
          }

          await storage.createDataObjectRelationship({
            sourceDataObjectId: sourceObject.id,
            targetDataObjectId: targetObject.id,
            type: relationshipType,
            relationshipLevel: "object",
            sourceAttributeId: null,
            targetAttributeId: null,
            name: fk.constraintName ?? `${sourceObject.name} → ${targetObject.name}`,
            description: "Auto-created from system sync metadata (object-level fallback)",
            metadata: metadataPayload,
          });

          relationshipRegistry.add(objectLevelKey);
          relationshipsCreated += 1;
          if (isHeuristic) {
            heuristicRelationshipsCreated += 1;
          }
        }
      }

      res.json({
        metadataCount: metadata.length,
        createdCount: created.length,
        updatedCount: updated.length,
        relationshipsCreated,
        heuristicRelationshipsCreated,
        created,
        updated,
        attributes: attributeSummary,
      });
    } catch (error) {
      console.error("Failed to sync system objects:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid sync payload", details: error.errors });
      } else {
        res.status(500).json({ message: "Failed to sync system objects" });
      }
    }
  });

  app.post("/api/sources/test-connection", async (req, res) => {
    try {
      const { type, configuration } = req.body;
      
      let isConnected = false;
      if (type === "sql") {
        isConnected = await dataConnectors.testDatabaseConnection(configuration);
      } else if (type === "adls") {
        isConnected = await dataConnectors.testADLSConnection(configuration);
      }
      
      res.json({ connected: isConnected });
    } catch (error) {
      res.status(500).json({ message: "Connection test failed" });
    }
  });

  app.post("/api/systems/:id/test-connection", async (req, res) => {
    try {
      const systemId = parseInt(req.params.id);
      if (!Number.isFinite(systemId)) {
        return res.status(400).json({ message: "Invalid system id" });
      }

      const system = await storage.getSystem(systemId);
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }

      const overrideConfiguration =
        req.body?.configuration && typeof req.body.configuration === "object"
          ? (req.body.configuration as Record<string, unknown>)
          : undefined;

      const result = await testSystemConnectivity(system, {
        type: req.body?.type,
        configuration: overrideConfiguration,
        connectionString: req.body?.connectionString,
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to test system connection:", error);
      res.status(500).json({ message: "Connection test failed" });
    }
  });

  app.get("/api/sources/:id/metadata", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const source = await storage.getSystem(id);
      
      if (!source) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      let metadata: any[] = [];
      if (source.type === "sql") {
        metadata = await dataConnectors.extractDatabaseMetadata(source.configuration as any);
      } else if (source.type === "adls") {
        metadata = await dataConnectors.listADLSDatasets(source.configuration as any);
      }
      
      res.json(metadata);
    } catch (error) {
      res.status(500).json({ message: "Failed to extract metadata" });
    }
  });

  // File Upload endpoints
  app.post("/api/upload/csv", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const fileContent = req.file.buffer.toString('utf-8');
      const metadata = await dataConnectors.parseCSVFile(fileContent);
      res.json(metadata);
    } catch (error) {
      res.status(400).json({ message: "Failed to parse CSV file" });
    }
  });

  app.post("/api/upload/excel", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const metadata = await dataConnectors.parseExcelFile(req.file.buffer);
      res.json(metadata);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Failed to parse Excel file" });
    }
  });

  app.post("/api/upload/parquet", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const metadata = await dataConnectors.parseParquetFile(req.file.buffer);
      res.json(metadata);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Failed to parse Parquet file" });
    }
  });

  app.post("/api/upload/sqlite", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const metadata = await dataConnectors.parseSQLiteFile(req.file.buffer);
      res.json(metadata);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Failed to parse SQLite file" });
    }
  });

  app.post("/api/upload/ddl", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const ddlContent = req.file.buffer.toString('utf-8');
      const metadata = await dataConnectors.parseDDLScript(ddlContent);
      res.json(metadata);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Failed to parse DDL script" });
    }
  });

  // Canvas endpoints for ReactFlow integration
  app.get("/api/models/:id/canvas", async (req, res) => {
    const modelId = parseInt(req.params.id);
    const layer = req.query.layer as string || "conceptual";
    
    try {
  // Get only the objects that belong to this model and are visible in this layer
  const modelObjects = await storage.getDataModelObjectsByModel(modelId);
  const visibleModelObjects = modelObjects.filter(mo => mo.isVisible !== false);
      
  const relationships = await storage.getDataModelObjectRelationshipsByModel(modelId);
  const modelObjectsById = new Map(modelObjects.map(mo => [mo.id, mo]));
  const relevantObjectIds = new Set(modelObjects.map(mo => mo.objectId));
  const dataObjectRelationships = await storage.getDataObjectRelationships();
  const globalRelationshipMap = new Map<string, DataObjectRelationship>();

  for (const relationship of dataObjectRelationships) {
    if (
      !relevantObjectIds.has(relationship.sourceDataObjectId) ||
      !relevantObjectIds.has(relationship.targetDataObjectId)
    ) {
      continue;
    }

    const key = buildRelationshipKey(
      relationship.sourceDataObjectId,
      relationship.targetDataObjectId,
      relationship.relationshipLevel === "attribute" ? "attribute" : "object",
      relationship.sourceAttributeId ?? null,
      relationship.targetAttributeId ?? null,
    );

    if (!globalRelationshipMap.has(key)) {
      globalRelationshipMap.set(key, relationship);
    }
  }
      
      // Get attributes for each object and include domain/area information
      const nodes = await Promise.all(visibleModelObjects.map(async modelObj => {
        const obj = await storage.getDataObject(modelObj.objectId);
        if (!obj) return null;
        
        const allAttributes = await storage.getAttributesByObject(obj.id);
        console.log(`Fetching attributes for objectId: ${obj.id}`, allAttributes);
        
        // Include ALL attributes for now - the layer filtering should be done in the UI, not the API
        // The attributes exist and should be displayed regardless of layer-specific type fields
        let attributes = allAttributes;
        
        // Get domain and area names
        const domains = await storage.getDataDomains();
        const areas = await storage.getDataAreasByDomain(obj.domainId || 0);
        const domain = domains.find(d => d.id === obj.domainId);
        const area = areas.find(a => a.id === obj.dataAreaId);
        
        // Get layer-specific position from model object config
        let position = { x: 0, y: 0 };
        if (modelObj.layerSpecificConfig && typeof modelObj.layerSpecificConfig === 'object') {
          const config = modelObj.layerSpecificConfig as any;

          if (config.layers && typeof config.layers === 'object') {
            const layerKey = layer || config.layer;
            const layerConfig = (layerKey && config.layers[layerKey]) || (config.layer && config.layers[config.layer]);
            if (layerConfig?.position) {
              position = layerConfig.position;
            }
          }

          if (position.x === 0 && position.y === 0 && config.position) {
            position = config.position;
          }
        }

        // Fallback to model object level position
        if ((position.x === 0 && position.y === 0) && modelObj.position) {
          const modelPosition = modelObj.position as any;
          if (typeof modelPosition === 'string') {
            try {
              position = JSON.parse(modelPosition);
            } catch (e) {
              console.warn("Failed to parse model object position:", modelPosition);
            }
          } else {
            position = modelPosition;
          }
        }
        
        // Fallback to global data object position if still not set
        if ((position.x === 0 && position.y === 0) && obj.position) {
          if (typeof obj.position === 'string') {
            try {
              position = JSON.parse(obj.position);
            } catch (e) {
              console.warn("Failed to parse position:", obj.position);
            }
          } else {
            position = obj.position;
          }
        }

        return {
          id: obj.id.toString(),
          type: 'dataObject',
          position,
          data: {
            modelObjectId: modelObj.id,
            name: obj.name,
            objectId: obj.id,
            domain: domain?.name || 'Uncategorized',
            dataArea: area?.name || 'General',
            attributes: attributes,
            sourceSystem: obj.sourceSystemId,
            targetSystem: obj.targetSystemId,
            isNew: obj.isNew,
            commonProperties: obj.commonProperties ?? null,
            metadata: obj.metadata ?? null,
          }
        };
      }));
      
      // Filter out null nodes
      const validNodes = nodes.filter(node => node !== null);
      
      // Filter relationships based on layer
      let filteredRelationships = relationships;
      if (layer === "conceptual") {
        // In conceptual layer, show only object-to-object relationships (no attribute-specific relationships)
        filteredRelationships = relationships.filter(rel => !rel.sourceAttributeId && !rel.targetAttributeId);
      } else if (layer === "logical" || layer === "physical") {
        // In logical and physical layers, show only attribute-level relationships
        filteredRelationships = relationships.filter(rel => rel.sourceAttributeId && rel.targetAttributeId);
      }
      
      const edges = await Promise.all(filteredRelationships.map(async rel => {
        // Get the actual object IDs from the model objects
        const sourceModelObject = modelObjectsById.get(rel.sourceModelObjectId) ?? (await storage.getDataModelObject(rel.sourceModelObjectId));
        const targetModelObject = modelObjectsById.get(rel.targetModelObjectId) ?? (await storage.getDataModelObject(rel.targetModelObjectId));
        
        if (!sourceModelObject || !targetModelObject) {
          console.warn(`Missing model objects for relationship ${rel.id}`);
          return null;
        }

        // Resolve model attribute IDs to global attribute IDs for the UI
        let globalSourceAttributeId = null;
        let globalTargetAttributeId = null;
        
        if (rel.sourceAttributeId) {
          const sourceModelAttr = await storage.getDataModelAttribute(rel.sourceAttributeId);
          globalSourceAttributeId = sourceModelAttr?.attributeId ?? null;
        }
        
        if (rel.targetAttributeId) {
          const targetModelAttr = await storage.getDataModelAttribute(rel.targetAttributeId);
          globalTargetAttributeId = targetModelAttr?.attributeId ?? null;
        }

        const relationshipLevel = rel.relationshipLevel === "attribute" ? "attribute" : "object";
        const key = buildRelationshipKey(
          sourceModelObject.objectId,
          targetModelObject.objectId,
          relationshipLevel,
          globalSourceAttributeId,
          globalTargetAttributeId,
        );

        const dataObjectRelationshipId = globalRelationshipMap.get(key)?.id ?? null;

        return {
          id: rel.id.toString(),
          source: sourceModelObject.objectId.toString(),
          target: targetModelObject.objectId.toString(),
          type: 'smoothstep',
          label: rel.type,
          data: {
            relationshipId: rel.id,
            relationshipType: rel.type,
            sourceAttributeId: globalSourceAttributeId,
            targetAttributeId: globalTargetAttributeId,
            dataObjectRelationshipId,
          }
        };
      }));

      // Filter out null edges
      const validEdges = edges.filter(edge => edge !== null);
      
      res.json({ nodes: validNodes, edges: validEdges });
    } catch (error) {
      console.error("Error getting canvas data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Canvas position saving endpoint
  app.post("/api/models/:id/canvas/positions", async (req, res) => {
    try {
  const modelId = parseInt(req.params.id);
  const { positions, layer } = req.body; // Array of { modelObjectId?: number, objectId?: number, position: { x: number, y: number } }
      
      if (!Array.isArray(positions)) {
        return res.status(400).json({ message: "Positions must be an array" });
      }
      
      // Get all model objects for this model to validate they exist
  const modelObjects = await storage.getDataModelObjectsByModel(modelId);
  const modelObjectsByObjectId = new Map(modelObjects.map(mo => [mo.objectId, mo]));
  const modelObjectsById = new Map(modelObjects.map(mo => [mo.id, mo]));
      
      // Filter positions to only include objects that exist in this model
      const validPositions = positions.filter(({ objectId, modelObjectId }) => {
        if (typeof modelObjectId === 'number') {
          const exists = modelObjectsById.has(modelObjectId);
          if (!exists) {
            console.warn(`Model object ${modelObjectId} not found in model ${modelId}, skipping position update`);
          }
          return exists;
        }

        if (typeof objectId === 'number') {
          const exists = modelObjectsByObjectId.has(objectId);
          if (!exists) {
            console.warn(`Object ${objectId} not found in model ${modelId}, skipping position update`);
          }
          return exists;
        }

        console.warn(`Invalid position payload without identifiers, skipping entry`);
        return false;
      });
      
      if (validPositions.length === 0) {
        return res.json({ success: true, message: "No valid positions to save", skipped: positions.length });
      }
      
      // Update each model object's layer-specific position in the layer_specific_config
      const updates = validPositions.map(async ({ objectId, modelObjectId, position }) => {
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
          throw new Error(`Invalid position data for payload ${JSON.stringify({ objectId, modelObjectId })}`);
        }

        let modelObject = typeof modelObjectId === 'number'
          ? modelObjectsById.get(modelObjectId)
          : undefined;

        if (!modelObject && typeof objectId === 'number') {
          modelObject = modelObjectsByObjectId.get(objectId);
        }

        if (!modelObject) {
          throw new Error(`Model object not found for payload ${JSON.stringify({ objectId, modelObjectId })}`);
        }
        
        // Get the current model object to preserve existing config
        const currentModelObject = await storage.getDataModelObject(modelObject.id);
        if (!currentModelObject) {
          throw new Error(`Model object ${modelObject.id} not found`);
        }
        
        // Update the layer-specific configuration with the new position
        let layerConfig = {};
        if (currentModelObject.layerSpecificConfig && typeof currentModelObject.layerSpecificConfig === 'object') {
          layerConfig = { ...currentModelObject.layerSpecificConfig };
        }

        const layerKey = typeof layer === 'string' && layer.length > 0
          ? layer
          : (typeof (layerConfig as any).layer === 'string' ? (layerConfig as any).layer : 'conceptual');

        const existingLayers = (layerConfig as any).layers && typeof (layerConfig as any).layers === 'object'
          ? { ...(layerConfig as any).layers }
          : {};

        const nextLayerConfig = {
          ...existingLayers[layerKey],
          position
        };

        const updatedConfig = {
          ...layerConfig,
          position, // maintain backwards compatibility
          layers: {
            ...existingLayers,
            [layerKey]: nextLayerConfig
          },
          lastUpdatedLayer: layerKey
        } as Record<string, any>;

        const result = await storage.updateDataModelObject(modelObject.id, { 
          layerSpecificConfig: updatedConfig,
          position
        });

        if (layerKey === "conceptual") {
          await storage.updateDataObject(modelObject.objectId, {
            position,
          });
        }

        return result;
      });
      
      await Promise.all(updates);
      res.json({ 
        success: true, 
        message: "Positions saved successfully",
        saved: validPositions.length,
        skipped: positions.length - validPositions.length
      });
    } catch (error) {
      console.error("Error saving canvas positions:", error);
      res.status(500).json({ message: "Failed to save positions" });
    }
  });

  // Business Capabilities
  app.get("/api/capabilities", async (req, res) => {
    try {
      const capabilities = await storage.getBusinessCapabilities();
      res.json(capabilities);
    } catch (error) {
      console.error("Failed to fetch capabilities:", error);
      res.status(500).json({ message: "Failed to fetch capabilities" });
    }
  });

  app.get("/api/capabilities/tree", async (req, res) => {
    try {
      const capabilityTree = await storage.getBusinessCapabilityTree();
      res.json(capabilityTree);
    } catch (error) {
      console.error("Failed to fetch capability tree:", error);
      res.status(500).json({ message: "Failed to fetch capability tree" });
    }
  });

  app.get("/api/capabilities/:id(\\d+)", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const capability = await storage.getBusinessCapability(id);
      if (!capability) {
        return res.status(404).json({ message: "Capability not found" });
      }
      res.json(capability);
    } catch (error) {
      console.error("Failed to fetch capability:", error);
      res.status(500).json({ message: "Failed to fetch capability" });
    }
  });

  app.get("/api/capabilities/:id(\\d+)/mappings", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const mappings = await storage.getCapabilityMappings(id);
      res.json(mappings);
    } catch (error) {
      console.error("Failed to fetch capability mappings:", error);
      res.status(500).json({ message: "Failed to fetch capability mappings" });
    }
  });

  app.get("/api/capabilities/system-mappings", async (_req, res) => {
    try {
      const mappings = await storage.getAllCapabilitySystemMappings();
      res.json(mappings);
    } catch (error) {
      console.error("Failed to fetch capability system mappings:", error);
      res.status(500).json({ message: "Failed to fetch capability system mappings" });
    }
  });

  app.post("/api/capabilities", async (req, res) => {
    try {
      const capability = await storage.createBusinessCapability(req.body);
      res.status(201).json(capability);
    } catch (error) {
      console.error("Failed to create capability:", error);
      res.status(500).json({ message: "Failed to create capability" });
    }
  });

  app.patch("/api/capabilities/:id(\\d+)", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const capability = await storage.updateBusinessCapability(id, req.body);
      res.json(capability);
    } catch (error) {
      console.error("Failed to update capability:", error);
      res.status(500).json({ message: "Failed to update capability" });
    }
  });

  app.delete("/api/capabilities/:id(\\d+)", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBusinessCapability(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete capability:", error);
      res.status(500).json({ message: "Failed to delete capability" });
    }
  });

  // Capability-Domain Mappings
  app.post("/api/capabilities/:capabilityId/domains/:domainId", async (req, res) => {
    try {
      const capabilityId = parseInt(req.params.capabilityId);
      const domainId = parseInt(req.params.domainId);
      const mapping = await storage.createCapabilityDomainMapping({
        capabilityId,
        domainId,
        ...req.body
      });
      res.status(201).json(mapping);
    } catch (error) {
      console.error("Failed to create capability-domain mapping:", error);
      res.status(500).json({ message: "Failed to create mapping" });
    }
  });

  app.delete("/api/capability-domain-mappings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCapabilityDomainMapping(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete capability-domain mapping:", error);
      res.status(500).json({ message: "Failed to delete mapping" });
    }
  });

  // Capability-DataArea Mappings
  app.post("/api/capabilities/:capabilityId/data-areas/:dataAreaId", async (req, res) => {
    try {
      const capabilityId = parseInt(req.params.capabilityId);
      const dataAreaId = parseInt(req.params.dataAreaId);
      const mapping = await storage.createCapabilityDataAreaMapping({
        capabilityId,
        dataAreaId,
        ...req.body
      });
      res.status(201).json(mapping);
    } catch (error) {
      console.error("Failed to create capability-data area mapping:", error);
      res.status(500).json({ message: "Failed to create mapping" });
    }
  });

  app.delete("/api/capability-data-area-mappings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCapabilityDataAreaMapping(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete capability-data area mapping:", error);
      res.status(500).json({ message: "Failed to delete mapping" });
    }
  });

  // Capability-System Mappings
  app.post("/api/capabilities/:capabilityId/systems/:systemId", async (req, res) => {
    try {
      const capabilityId = parseInt(req.params.capabilityId);
      const systemId = parseInt(req.params.systemId);
      const mapping = await storage.createCapabilitySystemMapping({
        capabilityId,
        systemId,
        ...req.body
      });
      res.status(201).json(mapping);
    } catch (error) {
      console.error("Failed to create capability-system mapping:", error);
      res.status(500).json({ message: "Failed to create mapping" });
    }
  });

  app.delete("/api/capability-system-mappings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCapabilitySystemMapping(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete capability-system mapping:", error);
      res.status(500).json({ message: "Failed to delete mapping" });
    }
  });

  // AI Suggestions
  app.post("/api/ai/modeling-agent", async (req, res) => {
    try {
      const payload = modelingAgentRequestSchema.parse(req.body);
      const result = await modelingAgentService.run(payload);
      res.json(result);
    } catch (error: any) {
      console.error("AI modeling agent error:", error);
      if (error.name === "ZodError") {
        res.status(400).json({
          message: "Invalid modeling agent request",
          details: error.errors,
          errors: error.errors,
        });
      } else {
        res.status(500).json({
          message: error?.message ?? "Failed to execute modeling agent",
        });
      }
    }
  });

  app.post("/api/ai/suggest-domain", async (req, res) => {
    try {
      const { objectName, attributes } = req.body;
      const suggestions = await aiEngine.suggestDomainClassification(objectName, attributes);
      res.json(suggestions);
    } catch (error) {
      console.error("Domain suggestions error:", error);
      res.status(500).json({ message: "Failed to generate domain suggestions" });
    }
  });

  app.post("/api/ai/suggest-relationships", async (req, res) => {
    try {
      const { modelId, layer } = req.body;
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
      res.json(suggestions);
    } catch (error: any) {
      console.error("AI relationship suggestions error:", error);
      res.status(500).json({ message: "Failed to generate relationship suggestions", error: error?.message });
    }
  });

  app.post("/api/ai/suggest-types", async (req, res) => {
    try {
      const { conceptualType, attributeName, context } = req.body;
      const suggestions = await aiEngine.suggestTypeMappings(conceptualType, attributeName, context);
      res.json(suggestions);
    } catch (error) {
      console.error("Type mapping suggestions error:", error);
      res.status(500).json({ message: "Failed to generate type suggestions" });
    }
  });

  app.post("/api/ai/suggest-normalization", async (req, res) => {
    try {
      const { modelId } = req.body;
      const objects = await storage.getDataObjectsByModel(modelId);
      
      const allAttributes: any[] = [];
      for (const obj of objects) {
        const attrs = await storage.getAttributesByObject(obj.id);
        allAttributes.push(...attrs);
      }
      
      const suggestions = aiEngine.suggestNormalizationImprovements(objects, allAttributes);
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate normalization suggestions" });
    }
  });

  app.get("/api/system-metrics", async (_req, res) => {
    try {
      const [configs, models, systemsList, objects, attrs, rels] = await Promise.all([
        storage.getConfigurations(),
        storage.getDataModels(),
        storage.getSystems(),
        storage.getDataObjects(),
        storage.getAttributes(),
  storage.getDataModelObjectRelationships(),
      ]);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const modifiedToday = configs.filter((config) => {
        if (!config.updatedAt) return false;
        const updatedAt = new Date(config.updatedAt);
        return updatedAt >= startOfDay;
      }).length;

      const lastUpdatedConfig = configs.reduce<Date | null>((latest, config) => {
        if (!config.updatedAt) return latest;
        const updatedAt = new Date(config.updatedAt);
        if (!latest || updatedAt > latest) {
          return updatedAt;
        }
        return latest;
      }, null);

      const requiredConfigKeys: Record<string, string[]> = {
        ai: [
          "openai_model",
          "temperature",
          "max_tokens",
          "confidence_threshold",
          "enable_suggestions",
          "enable_domain_suggestions",
          "enable_relationship_suggestions",
          "enable_normalization_suggestions",
          "max_suggestions",
          "analysis_timeout",
        ],
        ui: [
          "auto_save_interval",
          "enable_mini_map",
          "enable_auto_save",
          "theme",
          "canvas_zoom_sensitivity",
          "show_grid",
          "snap_to_grid",
          "grid_size",
        ],
        export: [
          "default_format",
          "include_comments",
          "include_constraints",
          "include_indexes",
          "compression_enabled",
          "max_file_size_mb",
        ],
        connection: [
          "max_connections",
          "connection_timeout",
          "retry_attempts",
          "rate_limit_per_minute",
          "enable_connection_pooling",
        ],
      };

      const categoryStats = Array.from(
        configs.reduce((map, config) => {
          const list = map.get(config.category) ?? [];
          list.push(config);
          map.set(config.category, list);
          return map;
        }, new Map<string, typeof configs>())
      ).map(([category, entries]) => {
        const missingKeys = (requiredConfigKeys[category] ?? []).filter(
          (key) => !entries.some((entry) => entry.key === key)
        );

        return {
          name: category,
          count: entries.length,
          missingKeys,
        };
      });

      const missingKeys = categoryStats.flatMap((category) =>
        category.missingKeys.map((key) => `${category.name}.${key}`)
      );

      const conceptualModels = models.filter((model) => model.layer === "conceptual").length;
      const logicalModels = models.filter((model) => model.layer === "logical").length;
      const physicalModels = models.filter((model) => model.layer === "physical").length;

      const connectedSystems = systemsList.filter((system) => system.status === "connected").length;
      const errorSystems = systemsList.filter((system) => system.status === "error").length;
      const disconnectedSystems =
        systemsList.length - connectedSystems - errorSystems;

      res.json({
        generatedAt: new Date().toISOString(),
        configuration: {
          totalConfigs: configs.length,
          modifiedToday,
          lastUpdated: lastUpdatedConfig ? lastUpdatedConfig.toISOString() : null,
          categories: categoryStats,
          missingKeys,
        },
        models: {
          total: models.length,
          conceptual: conceptualModels,
          logical: logicalModels,
          physical: physicalModels,
        },
        objects: {
          total: objects.length,
          attributes: attrs.length,
          relationships: rels.length,
        },
        systems: {
          total: systemsList.length,
          connected: connectedSystems,
          disconnected: Math.max(disconnectedSystems, 0),
          error: errorSystems,
        },
      });
    } catch (error) {
      console.error("Failed to load system metrics", error);
      res.status(500).json({ message: "Failed to load system metrics" });
    }
  });

  // Configuration endpoints
  app.get("/api/config", async (req, res) => {
    try {
      const configurations = await storage.getConfigurations();
      res.json(configurations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch configurations" });
    }
  });

  app.get("/api/config/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const configurations = await storage.getConfigurationsByCategory(category);
      res.json(configurations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category configurations" });
    }
  });

  app.get("/api/config/:category/:key", async (req, res) => {
    try {
      const { category, key } = req.params;
      const configuration = await storage.getConfiguration(category, key);
      if (!configuration) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      res.json(configuration);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const { configuration, created } = await upsertConfigurationEntry(req.body);
      res.status(created ? 201 : 200).json(configuration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration data", details: error.issues });
      } else {
        res.status(500).json({ message: "Failed to save configuration" });
      }
    }
  });

  app.put("/api/config/:category/:key", async (req, res) => {
    try {
      const { category, key } = req.params;
      const update = configurationUpdateSchema.parse(req.body);
      const existing = await storage.getConfiguration(category, key);

      if (!existing) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      const fallbackDescription = `${category}.${key} configuration`;
      const updated = await storage.updateConfiguration(existing.id, {
        value: update.value ?? existing.value,
        description: update.description ?? existing.description ?? fallbackDescription,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration update", details: error.issues });
      } else {
        res.status(500).json({ message: "Failed to update configuration" });
      }
    }
  });

  app.delete("/api/config/:category/:key", async (req, res) => {
    try {
      const { category, key } = req.params;
      const existing = await storage.getConfiguration(category, key);

      if (!existing) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      await storage.deleteConfiguration(existing.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete configuration" });
    }
  });

  // Enhanced Configuration endpoints
  app.post("/api/config/batch", async (req, res) => {
    try {
      const { configurations } = req.body;
      if (!Array.isArray(configurations)) {
        return res.status(400).json({ message: "Configurations must be an array" });
      }

      const total = configurations.length;
      let created = 0;

      for (const config of configurations) {
        const result = await upsertConfigurationEntry(config);
        if (result.created) {
          created += 1;
        }
      }

      res.json({ success: true, created, updated: total - created });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration data", details: error.issues });
      } else {
        res.status(500).json({ message: "Failed to update configurations" });
      }
    }
  });

  app.post("/api/config/validate", async (req, res) => {
    try {
      const { category, key, value } = req.body;
      
      // Basic validation schemas for different categories
      const validationRules: Record<string, Record<string, any>> = {
        ai: {
          temperature: { type: 'number', min: 0, max: 2 },
          max_tokens: { type: 'number', min: 1, max: 8000 },
          confidence_threshold: { type: 'number', min: 0, max: 1 },
          openai_model: { type: 'string', enum: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'] }
        },
        ui: {
          auto_save_interval: { type: 'number', min: 100, max: 5000 },
          canvas_zoom_sensitivity: { type: 'number', min: 0.1, max: 2 },
          grid_size: { type: 'number', min: 5, max: 50 }
        },
        connection: {
          max_connections: { type: 'number', min: 1, max: 100 },
          connection_timeout: { type: 'number', min: 1000, max: 60000 },
          retry_attempts: { type: 'number', min: 1, max: 10 }
        }
      };

      const categoryRules = validationRules[category];
      if (!categoryRules) {
        return res.json({ valid: true, message: "No validation rules for this category" });
      }

      const rule = categoryRules[key];
      if (!rule) {
        return res.json({ valid: true, message: "No validation rules for this key" });
      }

      let isValid = true;
      let message = "";

      if (rule.type === 'number') {
        if (typeof value !== 'number') {
          isValid = false;
          message = "Value must be a number";
        } else if (rule.min !== undefined && value < rule.min) {
          isValid = false;
          message = `Value must be at least ${rule.min}`;
        } else if (rule.max !== undefined && value > rule.max) {
          isValid = false;
          message = `Value must be at most ${rule.max}`;
        }
      } else if (rule.type === 'string') {
        if (typeof value !== 'string') {
          isValid = false;
          message = "Value must be a string";
        } else if (rule.enum && !rule.enum.includes(value)) {
          isValid = false;
          message = `Value must be one of: ${rule.enum.join(', ')}`;
        }
      }

      res.json({ valid: isValid, message: message || "Value is valid" });
    } catch (error) {
      res.status(500).json({ message: "Validation failed" });
    }
  });

  // Configurations API
  app.get("/api/configurations", async (req, res) => {
    try {
      const configurations = await storage.getConfigurations();
      res.json(configurations);
    } catch (error) {
      console.error("Error fetching configurations:", error);
      res.status(500).json({ message: "Failed to fetch configurations" });
    }
  });

  app.post("/api/configurations", async (req, res) => {
    try {
      const { configuration, created } = await upsertConfigurationEntry(req.body);
      res.status(created ? 201 : 200).json(configuration);
    } catch (error) {
      console.error("Error saving configuration:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration data", details: error.issues });
      } else {
        res.status(500).json({ message: "Failed to save configuration" });
      }
    }
  });

  app.put("/api/configurations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const update = configurationUpdateSchema.parse(req.body);

      const updateData: { value?: any; description?: string } = {};
      if (update.value !== undefined) {
        updateData.value = update.value;
      }
      if (update.description !== undefined) {
        updateData.description = update.description;
      }

      const configuration = await storage.updateConfiguration(id, updateData);
      
      if (!configuration) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      
      res.json(configuration);
    } catch (error) {
      console.error("Error updating configuration:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration update", details: error.issues });
      } else {
        res.status(500).json({ message: "Failed to update configuration" });
      }
    }
  });

  app.delete("/api/configurations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteConfiguration(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting configuration:", error);
      res.status(500).json({ message: "Failed to delete configuration" });
    }
  });

  // Export
  app.post("/api/export", async (req, res) => {
    try {
      console.log('Export request received:', { modelId: req.body.modelId, options: req.body.options });
      
      const { modelId, options } = req.body;
      
      if (!modelId) {
        return res.status(400).json({ message: "Model ID is required" });
      }
      
      const model = await storage.getDataModel(modelId);
      if (!model) {
        console.log('Model not found:', modelId);
        return res.status(404).json({ message: "Model not found" });
      }
      
      console.log('Model found:', model.name);
      
      const objects = await storage.getDataObjectsByModel(modelId);
  const relationships = await storage.getDataModelObjectRelationshipsByModel(modelId);
      
      console.log('Data fetched:', { objects: objects.length, relationships: relationships.length });
      
      const allAttributes: any[] = [];
      for (const obj of objects) {
        const attrs = await storage.getAttributesByObject(obj.id);
        allAttributes.push(...attrs);
      }
      
      console.log('Attributes fetched:', allAttributes.length);
      
      const exportedData = await exportService.exportModel(
        model,
        objects,
        allAttributes,
        relationships,
        options
      );
      
      console.log('Export completed successfully');
      res.json({ data: exportedData });
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ 
        message: "Export failed", 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });


  // SVG Export
  app.post("/api/export/svg", async (req, res) => {
    try {
      const { modelId, options } = req.body;
      
      const model = await storage.getDataModel(modelId);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
      }
      
      const objects = await storage.getDataObjectsByModel(modelId);
  const relationships = await storage.getDataModelObjectRelationshipsByModel(modelId);
      
      const allAttributes: any[] = [];
      for (const obj of objects) {
        const attrs = await storage.getAttributesByObject(obj.id);
        allAttributes.push(...attrs);
      }
      
      // Generate SVG
      const width = options.width || 800;
      const height = options.height || 600;
      const margin = 50;
      const nodeWidth = 200;
      const nodeHeight = 100;
      const nodeSpacing = 250;
      
      // Calculate layout
      const cols = Math.ceil(Math.sqrt(objects.length));
      const rows = Math.ceil(objects.length / cols);
      
      let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
      
      // Add background
      svg += `<rect width="100%" height="100%" fill="${options.theme === 'dark' ? '#1a1a1a' : '#ffffff'}"/>`;
      
      // Add title
      if (options.includeTitle) {
        svg += `<text x="${width / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${model.name}</text>`;
      }
      
      // Add metadata
      if (options.includeMetadata) {
        svg += `<text x="20" y="${height - 20}" font-family="Arial, sans-serif" font-size="12" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">Layer: ${options.layer || 'all'} | Generated: ${new Date().toLocaleString()}</text>`;
      }
      
      // Add objects
      objects.forEach((obj, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = margin + col * nodeSpacing;
        const y = margin + 60 + row * (nodeHeight + 50);
        
        // Create node rectangle
        svg += `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" fill="${options.theme === 'dark' ? '#2d2d2d' : '#f8f9fa'}" stroke="${options.theme === 'dark' ? '#4a5568' : '#2d3748'}" stroke-width="2" rx="5"/>`;
        
        // Add object name
        svg += `<text x="${x + nodeWidth / 2}" y="${y + 25}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${obj.name}</text>`;
        
        // Add attributes
        const objAttributes = allAttributes.filter(attr => attr.objectId === obj.id);
        objAttributes.slice(0, 3).forEach((attr, attrIndex) => {
          let attrName = attr.name;
          if (options.includePrimaryKeys && attr.isPrimaryKey) {
            attrName += ' (PK)';
          }
          if (options.includeForeignKeys && attr.isForeignKey) {
            attrName += ' (FK)';
          }
          
          svg += `<text x="${x + 10}" y="${y + 45 + attrIndex * 15}" font-family="Arial, sans-serif" font-size="10" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${attrName}</text>`;
        });
        
        if (objAttributes.length > 3) {
          svg += `<text x="${x + 10}" y="${y + 45 + 3 * 15}" font-family="Arial, sans-serif" font-size="10" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">... and ${objAttributes.length - 3} more</text>`;
        }
      });
      
      // Add relationships
      relationships.forEach(rel => {
        const sourceObj = objects.find(o => o.id === rel.sourceModelObjectId);
        const targetObj = objects.find(o => o.id === rel.targetModelObjectId);
        
        if (sourceObj && targetObj) {
          const sourceIndex = objects.indexOf(sourceObj);
          const targetIndex = objects.indexOf(targetObj);
          
          const sourceRow = Math.floor(sourceIndex / cols);
          const sourceCol = sourceIndex % cols;
          const targetRow = Math.floor(targetIndex / cols);
          const targetCol = targetIndex % cols;
          
          const sourceX = margin + sourceCol * nodeSpacing + nodeWidth / 2;
          const sourceY = margin + 60 + sourceRow * (nodeHeight + 50) + nodeHeight / 2;
          const targetX = margin + targetCol * nodeSpacing + nodeWidth / 2;
          const targetY = margin + 60 + targetRow * (nodeHeight + 50) + nodeHeight / 2;
          
          // Create line
          svg += `<line x1="${sourceX}" y1="${sourceY}" x2="${targetX}" y2="${targetY}" stroke="${options.theme === 'dark' ? '#4a5568' : '#2d3748'}" stroke-width="2" marker-end="url(#arrowhead)"/>`;
          
          // Add relationship type
          const midX = (sourceX + targetX) / 2;
          const midY = (sourceY + targetY) / 2;
          svg += `<text x="${midX}" y="${midY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${rel.type}</text>`;
        }
      });
      
      // Add arrow marker
      svg += `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${options.theme === 'dark' ? '#4a5568' : '#2d3748'}"/></marker></defs>`;
      
      svg += '</svg>';
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="${model.name}_${new Date().toISOString().split('T')[0]}.svg"`);
      res.send(svg);
    } catch (error) {
      console.error('SVG export error:', error);
      res.status(500).json({ message: "SVG export failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
