import type { Storage } from "../storage";
import type {
  DataObject,
  DataModel,
  DataModelObject,
  Attribute,
  DataModelObjectAttribute,
  DataModelObjectRelationship,
  InsertDataObject,
  InsertAttribute,
  InsertDataModelObject,
  InsertDataModelObjectAttribute,
  InsertDataObjectRelationship,
} from "@shared/schema";
import { z } from "zod";
import {
  insertDataObjectSchema,
  insertDataModelObjectRelationshipSchema,
} from "@shared/schema";
import {
  attributeInputSchema,
  relationshipInputSchema,
  modelObjectConfigSchema,
  perLayerModelObjectConfigSchema,
  type AttributeInput,
  type RelationshipInput,
  type ModelObjectConfigInput,
  type ModelLayer,
} from "./validation_schemas";
import {
  mergeLayerConfig,
  replicateObjectToLayer,
  type LayerCreationResult,
} from "./model_utils";
import { findMatchingDataObjectRelationship } from "./relationship_utils";

export interface CreateObjectInput {
  objectPayload: Record<string, unknown>;
  attributes?: unknown;
  relationships?: unknown;
  cascade?: boolean;
  modelObjectConfig?: unknown;
  layerModelObjectConfig?: unknown;
  modelObjectConfigs?: unknown;
}

export interface CreateObjectResult {
  primaryObject: DataObject;
  cascadePerformed: boolean;
  layers: Record<ModelLayer, LayerCreationResult | null>;
  relationships: Array<{
    layer: ModelLayer;
    relationship: DataModelObjectRelationship;
    dataObjectRelationshipId: number | null;
  }>;
}

/**
 * Create a data object with optional cascading to other layers and relationships
 * This is one of the most complex operations in the system:
 * - Creates the primary object in the base layer
 * - Optionally cascades to logical/physical layers
 * - Creates attributes in all layers
 * - Creates relationships in all layers
 */
export async function createDataObjectWithCascade(
  input: CreateObjectInput,
  storage: Storage
): Promise<CreateObjectResult> {
  const {
    attributes: rawAttributes,
    relationships: rawRelationships,
    cascade: cascadeFlag,
    modelObjectConfig: rawModelObjectConfig,
    layerModelObjectConfig: rawLayerModelObjectConfig,
    modelObjectConfigs: rawLegacyLayerConfig,
    ...objectPayload
  } = input as any;

  // Validate and parse inputs
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

  // Get base model
  const baseModel = await storage.getDataModel(validatedData.modelId);
  if (!baseModel) {
    throw new Error("Model not found");
  }

  // Initialize caches
  const modelObjectsCache = new Map<number, DataModelObject[]>();
  const attributesCache = new Map<number, Attribute[]>();
  const dataObjectCache = new Map<number, DataObject | null>();
  const fullyLoadedModelIds = new Set<number>();

  const resolveLayerConfig = (layer: ModelLayer): ModelObjectConfigInput =>
    mergeLayerConfig(
      baseModelObjectConfig,
      (perLayerConfig as Record<ModelLayer, ModelObjectConfigInput | undefined>)[layer]
    );

  // NEW ARCHITECTURE: Don't create data_objects entry for user-created objects
  // data_objects is only for system-synced objects
  // Store all object info directly in data_model_objects
  
  const baseLayer = (baseModel.layer ?? "conceptual") as ModelLayer;
  const baseLayerConfig = resolveLayerConfig(baseLayer);

  // Create model object entry with embedded object definition
  const baseModelObjectPayload: InsertDataModelObject = {
    objectId: null, // User-created objects don't have objectId
    modelId: baseModel.id,
    
    // Object definition fields (previously in data_objects)
    name: validatedData.name,
    description: validatedData.description,
    objectType: validatedData.objectType,
    domainId: validatedData.domainId,
    dataAreaId: validatedData.dataAreaId,
    sourceSystemId: validatedData.sourceSystemId,
    
    targetSystemId:
      baseLayerConfig.targetSystemId ??
      validatedData.targetSystemId ??
      (baseModel.targetSystemId ?? null),
    position: baseLayerConfig.position ?? validatedData.position ?? null,
    metadata: {
      ...(validatedData.metadata ?? {}),
      ...(baseLayerConfig.metadata ?? {}),
      layer: baseLayer,
      isUserCreated: true, // Mark as user-created (not system-synced)
    },
    isVisible: baseLayerConfig.isVisible ?? true,
    layerSpecificConfig: {
      ...(baseLayerConfig.layerSpecificConfig ?? {}),
      layer: baseLayer,
    },
  } satisfies InsertDataModelObject;

  const baseModelObject = await storage.createDataModelObject(baseModelObjectPayload);
  modelObjectsCache.set(baseModel.id, [baseModelObject]);
  
  // Cache the model object (no data_object to cache)
  dataObjectCache.set(baseModelObject.id, null);

  // Create attributes for base layer
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

      const createdDataModelAttribute = await storage.createDataModelObjectAttribute(
        dataModelAttributePayload
      );
      baseDataModelAttributes.push(createdDataModelAttribute);
    }
  }

  // Initialize layer results
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

  // Find related models for cascading
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

  const findDescendantLayer = (
    ancestor: DataModel | null,
    layer: ModelLayer
  ): DataModel | null => {
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
      : allModels.find(
          (model) =>
            model.id === baseModel.parentModelId && model.layer === "conceptual"
        ) ?? null;

  const logicalModel = findDescendantLayer(conceptualModel, "logical");
  const physicalModel =
    findDescendantLayer(conceptualModel, "physical") ??
    findDescendantLayer(logicalModel, "physical");

  // Cascade to other layers if enabled
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

  // Create relationships
  const relationshipSummaries = await createRelationships(
    relationshipInputs,
    primaryObject,
    createdLayers,
    storage,
    modelObjectsCache,
    attributesCache,
    dataObjectCache,
    fullyLoadedModelIds
  );

  return {
    primaryObject,
    cascadePerformed,
    layers: createdLayers,
    relationships: relationshipSummaries,
  };
}

/**
 * Create relationships across all layers
 */
async function createRelationships(
  relationshipInputs: RelationshipInput[],
  primaryObject: DataObject,
  createdLayers: Record<ModelLayer, LayerCreationResult | null>,
  storage: Storage,
  modelObjectsCache: Map<number, DataModelObject[]>,
  attributesCache: Map<number, Attribute[]>,
  dataObjectCache: Map<number, DataObject | null>,
  fullyLoadedModelIds: Set<number>
): Promise<
  Array<{
    layer: ModelLayer;
    relationship: DataModelObjectRelationship;
    dataObjectRelationshipId: number | null;
  }>
> {
  const relationshipSummaries: Array<{
    layer: ModelLayer;
    relationship: DataModelObjectRelationship;
    dataObjectRelationshipId: number | null;
  }> = [];

  if (relationshipInputs.length === 0) {
    return relationshipSummaries;
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
    targetModel: DataModel
  ): Promise<DataModelObject | null> => {
    const layerModelObjects = await ensureModelObjects(targetModel.id);

    let direct = layerModelObjects.find((entry) => {
      const layerConfig = (entry.layerSpecificConfig ?? {}) as
        | Record<string, unknown>
        | null;
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
      dataObjectCache.get(conceptualObjectId) ??
      (await storage.getDataObject(conceptualObjectId)) ??
      null;
    dataObjectCache.set(conceptualObjectId, conceptualObject);

    if (!conceptualObject) {
      return null;
    }

    for (const entry of layerModelObjects) {
      const targetObject =
        dataObjectCache.get(entry.objectId) ??
        (await storage.getDataObject(entry.objectId)) ??
        null;
      dataObjectCache.set(entry.objectId, targetObject);
      if (targetObject && targetObject.name === conceptualObject.name) {
        direct = entry;
        break;
      }
    }

    return direct ?? null;
  };

  const baseRelationships = await storage.getDataObjectRelationshipsByObject(
    primaryObject.id
  );

  for (const relationshipInput of relationshipInputs) {
    const targetConceptualObject = await storage.getDataObject(
      relationshipInput.targetObjectId
    );

    if (!targetConceptualObject) {
      console.warn(
        "Target object for relationship not found",
        relationshipInput.targetObjectId
      );
      continue;
    }

    dataObjectCache.set(targetConceptualObject.id, targetConceptualObject);

    let sourceAttributeId: number | null = null;
    let targetAttributeId: number | null = null;

    if (
      relationshipInput.relationshipLevel === "attribute" ||
      relationshipInput.sourceAttributeName ||
      relationshipInput.targetAttributeName
    ) {
      const sourceAttributes = await ensureAttributes(primaryObject.id);
      const targetAttributes = await ensureAttributes(targetConceptualObject.id);

      if (relationshipInput.sourceAttributeName) {
        sourceAttributeId =
          sourceAttributes.find(
            (attribute) => attribute.name === relationshipInput.sourceAttributeName
          )?.id ?? null;
      }

      if (relationshipInput.targetAttributeName) {
        targetAttributeId =
          targetAttributes.find(
            (attribute) => attribute.name === relationshipInput.targetAttributeName
          )?.id ?? null;
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
      targetAttributeId
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

      dataObjectRelationship = await storage.createDataObjectRelationship(
        globalRelationshipPayload
      );
      baseRelationships.push(dataObjectRelationship);
    }

    for (const layer of ["conceptual", "logical", "physical"] as ModelLayer[]) {
      const layerResult = createdLayers[layer];
      if (!layerResult) {
        continue;
      }

      const sourceModelObject = layerResult.modelObject;
      const targetModelObject = await resolveTargetModelObject(
        layer,
        targetConceptualObject.id,
        layerResult.model
      );

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
            layerSourceAttributes.find(
              (attribute) => attribute.name === relationshipInput.sourceAttributeName
            )?.id ?? null;
        }

        if (relationshipInput.targetAttributeName) {
          layerTargetAttributeId =
            layerTargetAttributes.find(
              (attribute) => attribute.name === relationshipInput.targetAttributeName
            )?.id ?? null;
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
        relationshipLevel:
          layerSourceAttributeId && layerTargetAttributeId ? "attribute" : "object",
        sourceAttributeId: layerSourceAttributeId ?? undefined,
        targetAttributeId: layerTargetAttributeId ?? undefined,
        modelId: layerResult.model.id,
        layer,
        name: relationshipInput.name ?? undefined,
        description: relationshipInput.description ?? undefined,
      });

      const layerRelationship = await storage.createDataModelObjectRelationship(
        layerRelationshipPayload
      );

      relationshipSummaries.push({
        layer,
        relationship: layerRelationship,
        dataObjectRelationshipId: dataObjectRelationship?.id ?? null,
      });
    }
  }

  return relationshipSummaries;
}

/**
 * Delete a data object and all associated data
 */
export async function deleteDataObjectCascade(
  objectId: number,
  storage: Storage
): Promise<void> {
  console.log(`Attempting to delete object ${objectId}`);

  // Delete data model objects
  console.log(`Deleting data model objects for object ${objectId}`);
  await storage.deleteDataModelObjectsByObject(objectId);
  console.log(`Successfully deleted data model objects for object ${objectId}`);

  // Delete relationships
  console.log(`Deleting data object relationships for object ${objectId}`);
  await storage.deleteDataObjectRelationshipsByObject(objectId);
  console.log(`Successfully deleted data object relationships for object ${objectId}`);

  // Delete attributes
  console.log(`Deleting attributes for object ${objectId}`);
  await storage.deleteAttributesByObject(objectId);
  console.log(`Successfully deleted attributes for object ${objectId}`);

  // Delete the object itself
  console.log(`Deleting object ${objectId}`);
  await storage.deleteDataObject(objectId);
  console.log(`Successfully deleted object ${objectId}`);
}
