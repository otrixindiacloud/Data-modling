import type { Storage } from "../storage";
import type { DataObject, DataModel, Attribute } from "@shared/schema";
import { replicateObjectToLayer, type LayerCreationResult } from "./model_utils";
import type { ModelLayer } from "./validation_schemas";

export interface GenerateNextLayerInput {
  sourceObjectId: number;
  targetModelId?: number;
  config?: {
    position?: { x: number; y: number };
    targetSystemId?: number;
    nameOverride?: string;
    metadata?: Record<string, any>;
  };
}

export interface GenerateNextLayerResult extends LayerCreationResult {
  sourceObject: DataObject;
  sourceModel: DataModel;
  targetLayer: ModelLayer;
}

/**
 * Helper function to find the next layer model in the hierarchy
 * Searches for sibling or child models with the appropriate layer
 */
export async function findNextLayerModel(
  sourceModelId: number,
  storage: Storage
): Promise<DataModel | null> {
  const sourceModel = await storage.getDataModel(sourceModelId);
  if (!sourceModel) return null;
  
  const targetLayer: ModelLayer | null = 
    sourceModel.layer === "conceptual" ? "logical" :
    sourceModel.layer === "logical" ? "physical" :
    null;
  
  if (!targetLayer) return null;
  
  // Find sibling or child model with target layer
  const allModels = await storage.getDataModels();
  
  // First try: direct child
  const directChild = allModels.find(
    m => m.parentModelId === sourceModel.id && m.layer === targetLayer
  );
  if (directChild) return directChild;
  
  // Second try: sibling (same parent)
  if (sourceModel.parentModelId) {
    const sibling = allModels.find(
      m => m.parentModelId === sourceModel.parentModelId && m.layer === targetLayer
    );
    if (sibling) return sibling;
  }
  
  // Third try: any model with matching domain/area and layer
  const candidate = allModels.find(
    m => m.layer === targetLayer && 
         m.domainId === sourceModel.domainId &&
         m.dataAreaId === sourceModel.dataAreaId
  );
  if (candidate) return candidate;
  
  return null;
}

/**
 * Generate an object in the next layer (Conceptual → Logical or Logical → Physical)
 * This function:
 * 1. Validates the source object and model
 * 2. Determines the target layer
 * 3. Finds or uses the specified target model
 * 4. Replicates the object with all its attributes to the target layer
 * 5. Returns comprehensive results including source and target information
 */
export async function generateNextLayerObject(
  input: GenerateNextLayerInput,
  storage: Storage
): Promise<GenerateNextLayerResult> {
  const { sourceObjectId, targetModelId, config } = input;
  
  // 1. Get source object
  const sourceObject = await storage.getDataObject(sourceObjectId);
  if (!sourceObject) {
    throw new Error("Source object not found");
  }
  
  // 2. Get source model
  const sourceModel = await storage.getDataModel(sourceObject.modelId);
  if (!sourceModel) {
    throw new Error("Source model not found");
  }
  
  // 3. Determine target layer
  const targetLayer: ModelLayer = 
    sourceModel.layer === "conceptual" ? "logical" :
    sourceModel.layer === "logical" ? "physical" :
    (() => { throw new Error("Cannot generate next layer from physical model"); })();
  
  // 4. Get or find target model
  let targetModel: DataModel;
  if (targetModelId) {
    const model = await storage.getDataModel(targetModelId);
    if (!model) {
      throw new Error("Target model not found");
    }
    if (model.layer !== targetLayer) {
      throw new Error(`Target model must be ${targetLayer} layer, but got ${model.layer}`);
    }
    targetModel = model;
  } else {
    // Auto-find target model
    const found = await findNextLayerModel(sourceModel.id, storage);
    if (!found) {
      throw new Error(
        `No ${targetLayer} model found. Please create a ${targetLayer} model first or specify a target model ID.`
      );
    }
    targetModel = found;
  }
  
  // 5. Get source attributes
  const sourceAttributes = await storage.getAttributesByObject(sourceObjectId);
  
  // 6. Replicate to target layer
  const result = await replicateObjectToLayer({
    layer: targetLayer,
    conceptualModel: sourceModel,
    conceptualObject: sourceObject,
    targetModel,
    baseObjectPayload: {
      name: config?.nameOverride || sourceObject.name,
      domainId: sourceObject.domainId,
      dataAreaId: sourceObject.dataAreaId,
      sourceSystemId: sourceObject.sourceSystemId,
      targetSystemId: config?.targetSystemId || sourceObject.targetSystemId || targetModel.targetSystemId,
      objectType: sourceObject.objectType,
      description: sourceObject.description,
      modelId: targetModel.id,
    },
    attributeInputs: sourceAttributes.map(attr => ({
      name: attr.name,
      conceptualType: attr.conceptualType ?? undefined,
      logicalType: attr.logicalType ?? undefined,
      physicalType: attr.physicalType ?? undefined,
      dataType: attr.dataType ?? undefined,
      nullable: attr.nullable ?? true,
      isPrimaryKey: attr.isPrimaryKey ?? false,
      isForeignKey: attr.isForeignKey ?? false,
      description: attr.description ?? undefined,
      length: attr.length ?? undefined,
      precision: attr.precision ?? undefined,
      scale: attr.scale ?? undefined,
      orderIndex: attr.orderIndex ?? undefined,
    })),
    config: {
      position: config?.position,
      metadata: config?.metadata,
      targetSystemId: config?.targetSystemId,
    },
    modelObjectsCache: new Map(),
    attributesCache: new Map(),
  });
  
  return {
    ...result,
    sourceObject,
    sourceModel,
    targetLayer,
  };
}

/**
 * Generate a logical object from a conceptual object
 */
export async function generateLogicalObject(
  sourceObjectId: number,
  targetModelId: number | undefined,
  config: GenerateNextLayerInput['config'] | undefined,
  storage: Storage
): Promise<GenerateNextLayerResult> {
  const sourceObject = await storage.getDataObject(sourceObjectId);
  if (!sourceObject) {
    throw new Error("Source object not found");
  }
  
  const sourceModel = await storage.getDataModel(sourceObject.modelId);
  if (!sourceModel) {
    throw new Error("Source model not found");
  }
  
  if (sourceModel.layer !== "conceptual") {
    throw new Error("Source object must be in a conceptual model");
  }
  
  return generateNextLayerObject({ sourceObjectId, targetModelId, config }, storage);
}

/**
 * Generate a physical object from a logical object
 */
export async function generatePhysicalObject(
  sourceObjectId: number,
  targetModelId: number | undefined,
  config: GenerateNextLayerInput['config'] | undefined,
  storage: Storage
): Promise<GenerateNextLayerResult> {
  const sourceObject = await storage.getDataObject(sourceObjectId);
  if (!sourceObject) {
    throw new Error("Source object not found");
  }
  
  const sourceModel = await storage.getDataModel(sourceObject.modelId);
  if (!sourceModel) {
    throw new Error("Source model not found");
  }
  
  if (sourceModel.layer !== "logical") {
    throw new Error("Source object must be in a logical model");
  }
  
  return generateNextLayerObject({ sourceObjectId, targetModelId, config }, storage);
}
