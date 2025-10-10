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
