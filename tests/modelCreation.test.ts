import express from "express";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  type Attribute,
  type DataArea,
  type DataDomain,
  type DataModel,
  type DataModelLayer,
  type DataModelObject,
  type DataModelObjectAttribute,
  type DataModelObjectRelationship,
  type DataModelProperty,
  type DataObject,
  type DataObjectRelationship,
  type InsertAttribute,
  type InsertDataArea,
  type InsertDataDomain,
  type InsertDataModel,
  type InsertDataModelLayer,
  type InsertDataModelObject,
  type InsertDataObject,
  type InsertDataModelObjectAttribute,
  type InsertDataModelObjectRelationship,
  type InsertDataObjectRelationship,
  type InsertSystem,
  type DataModelLayerObject,
  type InsertDataModelLayerObject,
  type System
} from "../shared/schema";

interface MockStore {
  systems: System[];
  dataModels: DataModel[];
  dataModelLayers: DataModelLayer[];
  dataDomains: DataDomain[];
  dataAreas: DataArea[];
  dataObjects: DataObject[];
  dataModelObjects: DataModelObject[];
  attributes: Attribute[];
  dataObjectRelationships: DataObjectRelationship[];
  dataModelAttributes: DataModelObjectAttribute[];
  dataModelObjectRelationships: DataModelObjectRelationship[];
  dataModelProperties: DataModelProperty[];
  dataModelLayerObjects: DataModelLayerObject[];
}

const store: MockStore = {
  systems: [],
  dataModels: [],
  dataModelLayers: [],
  dataDomains: [],
  dataAreas: [],
  dataObjects: [],
  dataModelObjects: [],
  attributes: [],
  dataObjectRelationships: [],
  dataModelAttributes: [],
  dataModelObjectRelationships: [],
  dataModelProperties: [],
  dataModelLayerObjects: []
};

const counters = {
  system: 0,
  dataModel: 0,
  dataModelLayer: 0,
  dataDomain: 0,
  dataArea: 0,
  dataObject: 0,
  dataModelObject: 0,
  dataModelLayerObject: 0,
  attribute: 0,
  dataObjectRelationship: 0,
  dataModelAttribute: 0,
  dataModelObjectRelationship: 0,
  dataModelProperty: 0
};

function resetMockStore() {
  store.systems.length = 0;
  store.dataModels.length = 0;
  store.dataModelLayers.length = 0;
  store.dataDomains.length = 0;
  store.dataAreas.length = 0;
  store.dataObjects.length = 0;
  store.dataModelObjects.length = 0;
  store.attributes.length = 0;
  store.dataObjectRelationships.length = 0;
  store.dataModelAttributes.length = 0;
  store.dataModelObjectRelationships.length = 0;
  store.dataModelProperties.length = 0;
  store.dataModelLayerObjects.length = 0;
  counters.system = 0;
  counters.dataModel = 0;
  counters.dataModelLayer = 0;
  counters.dataDomain = 0;
  counters.dataArea = 0;
  counters.dataObject = 0;
  counters.dataModelObject = 0;
  counters.dataModelLayerObject = 0;
  counters.attribute = 0;
  counters.dataObjectRelationship = 0;
  counters.dataModelAttribute = 0;
  counters.dataModelObjectRelationship = 0;
  counters.dataModelProperty = 0;
}

function matchesConceptualOrigin(modelObject: DataModelObject | undefined, conceptualId: number): boolean {
  if (!modelObject) {
    return false;
  }

  if (modelObject.objectId === conceptualId) {
    return true;
  }

  const metadata = (modelObject.metadata ?? {}) as Record<string, any> | null;
  const layerSpecificConfig = (modelObject.layerSpecificConfig ?? {}) as Record<string, any> | null;

  const metaOrigin = metadata && typeof metadata === "object"
    ? (metadata.originConceptualObjectId as number | undefined)
    : undefined;
  const layerOrigin = layerSpecificConfig && typeof layerSpecificConfig === "object"
    ? (layerSpecificConfig.originConceptualObjectId as number | undefined)
    : undefined;

  return metaOrigin === conceptualId || layerOrigin === conceptualId;
}

async function seedObjectLakeData() {
  const targetSystem = store.systems[0] ?? await storageMock.createSystem({
    name: "Data Lake",
    category: "Target",
    type: "adls",
    description: "Consolidated data lake"
  } satisfies InsertSystem);

  const sourceSystem = await storageMock.createSystem({
    name: "CRM Core",
    category: "Source",
    type: "sql",
    description: "Primary CRM platform"
  } satisfies InsertSystem);

  const domain = await storageMock.createDataDomain({
    name: "Customer Experience",
    description: "Customer facing information"
  } satisfies InsertDataDomain);

  const dataArea = await storageMock.createDataArea({
    name: "Profiles",
    domainId: domain.id,
    description: "Customer profile attributes"
  } satisfies InsertDataArea);

  const conceptualModel = await storageMock.createDataModelLayer({
    name: "Customer 360 Conceptual",
    layer: "conceptual",
    targetSystemId: targetSystem.id,
    domainId: domain.id,
    dataAreaId: dataArea.id
  } satisfies InsertDataModelLayer);

  const logicalModel = await storageMock.createDataModelLayer({
    name: "Customer 360 Logical",
    layer: "logical",
    parentModelId: conceptualModel.id,
    targetSystemId: targetSystem.id,
    domainId: domain.id,
    dataAreaId: dataArea.id
  } satisfies InsertDataModelLayer);

  const physicalModel = await storageMock.createDataModelLayer({
    name: "Customer 360 Physical",
    layer: "physical",
    parentModelId: conceptualModel.id,
    targetSystemId: targetSystem.id,
    domainId: domain.id,
    dataAreaId: dataArea.id
  } satisfies InsertDataModelLayer);

  const userObject = await storageMock.createDataObject({
    name: "User",
    modelId: conceptualModel.id,
    domainId: domain.id,
    dataAreaId: dataArea.id,
    sourceSystemId: sourceSystem.id,
    targetSystemId: targetSystem.id,
    objectType: "entity",
    description: "Master user record",
    metadata: { steward: "Data Platform" } as any,
    position: { x: 120, y: 80 },
    commonProperties: { retention: "7y" } as any
  } satisfies InsertDataObject);

  const productObject = await storageMock.createDataObject({
    name: "Product",
    modelId: conceptualModel.id,
    domainId: domain.id,
    dataAreaId: dataArea.id,
    sourceSystemId: sourceSystem.id,
    targetSystemId: targetSystem.id,
    objectType: "entity",
    description: "Managed product definition",
    metadata: { steward: "Commerce Team" } as any,
    position: { x: 240, y: 140 },
    commonProperties: { retention: "5y" } as any
  } satisfies InsertDataObject);

  const userIdAttribute = await storageMock.createAttribute({
    name: "user_id",
    objectId: userObject.id,
    conceptualType: "Identifier",
    logicalType: "UUID",
    physicalType: "uuid",
    dataType: "UUID",
    nullable: false,
    isPrimaryKey: true,
    orderIndex: 1
  } satisfies InsertAttribute);

  const userEmailAttribute = await storageMock.createAttribute({
    name: "email",
    objectId: userObject.id,
    conceptualType: "Text",
    logicalType: "VARCHAR",
    physicalType: "varchar(255)",
    dataType: "VARCHAR",
    nullable: false,
    isPrimaryKey: false,
    orderIndex: 2
  } satisfies InsertAttribute);

  await storageMock.createAttribute({
    name: "product_id",
    objectId: productObject.id,
    conceptualType: "Identifier",
    logicalType: "UUID",
    physicalType: "uuid",
    dataType: "UUID",
    nullable: false,
    isPrimaryKey: true,
    orderIndex: 1
  } satisfies InsertAttribute);

  const userLogicalInstance = await storageMock.createDataModelObject({
    objectId: userObject.id,
    modelId: logicalModel.id,
    targetSystemId: targetSystem.id,
    metadata: { alias: "dim_user" } as any,
    position: { x: 150, y: 100 },
    isVisible: true,
    layerSpecificConfig: { color: "blue" } as any
  } satisfies InsertDataModelObject);

  const userPhysicalInstance = await storageMock.createDataModelObject({
    objectId: userObject.id,
    modelId: physicalModel.id,
    targetSystemId: targetSystem.id,
    metadata: { table: "users" } as any,
    position: { x: 220, y: 100 },
    isVisible: true,
    layerSpecificConfig: { schema: "public" } as any
  } satisfies InsertDataModelObject);

  const productLogicalInstance = await storageMock.createDataModelObject({
    objectId: productObject.id,
    modelId: logicalModel.id,
    targetSystemId: targetSystem.id,
    metadata: { alias: "dim_product" } as any,
    position: { x: 260, y: 140 },
    isVisible: false,
    layerSpecificConfig: { color: "green" } as any
  } satisfies InsertDataModelObject);

  store.dataModelAttributes.push({
    id: ++counters.dataModelAttribute,
    attributeId: userIdAttribute.id,
    modelObjectId: userLogicalInstance.id,
    modelId: logicalModel.id,
    name: "user_id",
    description: "Unique user identifier",
    dataType: "uuid",
    length: null,
    precision: null,
    scale: null,
    conceptualType: "Identifier",
    logicalType: "UUID",
    physicalType: "uuid",
    nullable: false,
    isPrimaryKey: true,
    isForeignKey: false,
    orderIndex: 1,
    layerSpecificConfig: { columnName: "user_id" } as any,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  store.dataModelAttributes.push({
    id: ++counters.dataModelAttribute,
    attributeId: userEmailAttribute.id,
    modelObjectId: userLogicalInstance.id,
    modelId: logicalModel.id,
    name: "email",
    description: "User email address",
    dataType: "varchar",
    length: 255,
    precision: null,
    scale: null,
    conceptualType: "Text",
    logicalType: "VARCHAR",
    physicalType: "varchar(255)",
    nullable: false,
    isPrimaryKey: false,
    isForeignKey: false,
    orderIndex: 2,
    layerSpecificConfig: { columnName: "email" } as any,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  store.dataObjectRelationships.push({
    id: ++counters.dataObjectRelationship,
    sourceDataObjectId: userObject.id,
    targetDataObjectId: productObject.id,
    type: "1:N",
    relationshipLevel: "object",
    sourceAttributeId: null,
    targetAttributeId: null,
    name: "owns",
    description: "Users can own products",
    metadata: { cardinality: "1:N" },
    createdAt: new Date(),
    updatedAt: new Date()
  });

  store.dataModelObjectRelationships.push({
    id: ++counters.dataModelObjectRelationship,
    sourceModelObjectId: userLogicalInstance.id,
    targetModelObjectId: productLogicalInstance.id,
    type: "1:N",
    relationshipLevel: "object",
    sourceAttributeId: null,
    targetAttributeId: null,
    sourceHandle: null,
    targetHandle: null,
    modelId: logicalModel.id,
    layer: "logical",
    name: "Maintains",
    description: "Logical user maintains products",
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const now = new Date();
  store.dataModelProperties.push({
    id: ++counters.dataModelProperty,
    entityType: "object",
    entityId: userObject.id,
    modelId: conceptualModel.id,
    propertyName: "criticality",
    propertyValue: "high",
    propertyType: "string",
    layer: "conceptual",
    description: "Business critical object",
    isSystemProperty: false,
    createdAt: now,
    updatedAt: now
  });

  store.dataModelProperties.push({
    id: ++counters.dataModelProperty,
    entityType: "model_object",
    entityId: userLogicalInstance.id,
    modelId: logicalModel.id,
    propertyName: "integrationPattern",
    propertyValue: "cdc",
    propertyType: "string",
    layer: "logical",
    description: null,
    isSystemProperty: false,
    createdAt: now,
    updatedAt: now
  });

  store.dataModelProperties.push({
    id: ++counters.dataModelProperty,
    entityType: "attribute",
    entityId: userEmailAttribute.id,
    modelId: logicalModel.id,
    propertyName: "piiCategory",
    propertyValue: "personal",
    propertyType: "string",
    layer: "logical",
    description: null,
    isSystemProperty: false,
    createdAt: now,
    updatedAt: now
  });

  return {
    userObject,
    productObject,
    logicalModel
  };
}

interface RelationshipSyncTestContext {
  conceptualModel: DataModelLayer;
  logicalModel: DataModelLayer;
  physicalModel: DataModelLayer;
  source: {
    object: DataObject;
    conceptual: DataModelObject;
    logical: DataModelObject;
    physical: DataModelObject;
  };
  target: {
    object: DataObject;
    conceptual: DataModelObject;
    logical: DataModelObject;
    physical: DataModelObject;
  };
}

async function setupRelationshipSyncTestContext(): Promise<RelationshipSyncTestContext> {
  const targetSystemId = store.systems[0]?.id ?? 1;

  const conceptualModel = await storageMock.createDataModelLayer({
    name: "Sync Conceptual",
    layer: "conceptual",
    targetSystemId
  } satisfies InsertDataModelLayer);

  const logicalModel = await storageMock.createDataModelLayer({
    name: "Sync Logical",
    layer: "logical",
    parentModelId: conceptualModel.id,
    targetSystemId
  } satisfies InsertDataModelLayer);

  const physicalModel = await storageMock.createDataModelLayer({
    name: "Sync Physical",
    layer: "physical",
    parentModelId: conceptualModel.id,
    targetSystemId
  } satisfies InsertDataModelLayer);

  const sourceObject = await storageMock.createDataObject({
    name: "Order",
    modelId: conceptualModel.id,
    position: { x: 120, y: 80 } as any,
    commonProperties: { steward: "Sales" } as any,
    metadata: { owner: "OrderOps" } as any
  } satisfies InsertDataObject);

  const targetObject = await storageMock.createDataObject({
    name: "Customer",
    modelId: conceptualModel.id,
    position: { x: 260, y: 140 } as any,
    commonProperties: { steward: "CRM" } as any,
    metadata: { owner: "CustomerSuccess" } as any
  } satisfies InsertDataObject);

  const createModelInstance = async (
    model: DataModelLayer,
    object: DataObject
  ): Promise<DataModelObject> => storageMock.createDataModelObject({
    objectId: object.id,
    modelId: model.id,
    targetSystemId,
    position: { x: object.position?.x ?? 0, y: object.position?.y ?? 0 } as any,
    metadata: {
      originConceptualObjectId: object.id,
      originConceptualModelId: conceptualModel.id,
      layer: model.layer
    } as any,
    layerSpecificConfig: {
      originConceptualObjectId: object.id,
      originConceptualModelId: conceptualModel.id,
      layer: model.layer
    } as any
  } satisfies InsertDataModelObject);

  const sourceConceptual = await createModelInstance(conceptualModel, sourceObject);
  const sourceLogical = await createModelInstance(logicalModel, sourceObject);
  const sourcePhysical = await createModelInstance(physicalModel, sourceObject);

  const targetConceptual = await createModelInstance(conceptualModel, targetObject);
  const targetLogical = await createModelInstance(logicalModel, targetObject);
  const targetPhysical = await createModelInstance(physicalModel, targetObject);

  return {
    conceptualModel,
    logicalModel,
    physicalModel,
    source: {
      object: sourceObject,
      conceptual: sourceConceptual,
      logical: sourceLogical,
      physical: sourcePhysical
    },
    target: {
      object: targetObject,
      conceptual: targetConceptual,
      logical: targetLogical,
      physical: targetPhysical
    }
  } satisfies RelationshipSyncTestContext;
}

const storageMock = {
  async getSystems(): Promise<System[]> {
    return store.systems;
  },
  async getSystem(id: number): Promise<System | undefined> {
    return store.systems.find((system) => system.id === id);
  },
  async createSystem(system: InsertSystem): Promise<System> {
    const newSystem: System = {
      id: ++counters.system,
      name: system.name,
      category: system.category ?? "Unknown",
      type: system.type ?? "sql",
      description: system.description ?? null,
      connectionString: system.connectionString ?? null,
      configuration: (system.configuration ?? null) as any,
      status: system.status ?? "connected",
      colorCode: system.colorCode ?? "#6366f1",
      canBeSource: system.canBeSource ?? true,
      canBeTarget: system.canBeTarget ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.systems.push(newSystem);
    return newSystem;
  },
  async getDataModelLayers(): Promise<DataModelLayer[]> {
    return store.dataModelLayers;
  },
  async getDataModelLayer(id: number): Promise<DataModelLayer | undefined> {
    return store.dataModelLayers.find((layer) => layer.id === id);
  },
  async createDataModelLayer(layer: InsertDataModelLayer): Promise<DataModelLayer> {
    let dataModelId = layer.dataModelId ?? null;
    
    if (!dataModelId) {
      const newModel: DataModel = {
        id: ++counters.dataModel,
        name: layer.name,
        description: null,
        targetSystemId: layer.targetSystemId ?? null,
        domainId: layer.domainId ?? null,
        dataAreaId: layer.dataAreaId ?? null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      store.dataModels.push(newModel);
      dataModelId = newModel.id;
    }
    
    const newLayer: DataModelLayer = {
      id: ++counters.dataModelLayer,
      name: layer.name,
      layer: layer.layer,
      dataModelId: dataModelId,
      parentModelId: layer.parentModelId ?? null,
      targetSystemId: layer.targetSystemId ?? null,
      domainId: layer.domainId ?? null,
      dataAreaId: layer.dataAreaId ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataModelLayers.push(newLayer);
    return newLayer;
  },
  async updateDataModelLayer(id: number, layer: Partial<InsertDataModelLayer>): Promise<DataModelLayer> {
    const existing = store.dataModelLayers.find((l) => l.id === id);
    if (!existing) {
      throw new Error(`DataModelLayer ${id} not found`);
    }
    Object.assign(existing, layer, { updatedAt: new Date() });
    return existing;
  },
  async deleteDataModelLayer(id: number): Promise<void> {
    store.dataModelLayers = store.dataModelLayers.filter((l) => l.id !== id);
  },
  async getDataDomains(): Promise<DataDomain[]> {
    return store.dataDomains;
  },
  async getDataDomain(id: number): Promise<DataDomain | undefined> {
    return store.dataDomains.find((domain) => domain.id === id);
  },
  async getDataDomainByName(name: string): Promise<DataDomain | undefined> {
    return store.dataDomains.find((domain) => domain.name === name);
  },
  async createDataDomain(domain: InsertDataDomain): Promise<DataDomain> {
    const newDomain: DataDomain = {
      id: ++counters.dataDomain,
      name: domain.name,
      description: domain.description ?? null,
      colorCode: domain.colorCode ?? "#3b82f6"
    };
    store.dataDomains.push(newDomain);
    return newDomain;
  },
  async getDataAreas(): Promise<DataArea[]> {
    return store.dataAreas;
  },
  async getDataAreasByDomain(domainId: number): Promise<DataArea[]> {
    return store.dataAreas.filter((area) => area.domainId === domainId);
  },
  async getDataAreaByName(name: string, domainId?: number): Promise<DataArea | undefined> {
    return store.dataAreas.find((area) => area.name === name && (!domainId || area.domainId === domainId));
  },
  async createDataArea(area: InsertDataArea): Promise<DataArea> {
    const newArea: DataArea = {
      id: ++counters.dataArea,
      name: area.name,
      domainId: area.domainId,
      description: area.description ?? null,
      colorCode: area.colorCode ?? "#10b981"
    };
    store.dataAreas.push(newArea);
    return newArea;
  },
  async getDataObjects(): Promise<DataObject[]> {
    return store.dataObjects;
  },
  async getAllDataObjects(): Promise<DataObject[]> {
    return store.dataObjects;
  },
  async getDataObjectsBySourceSystem(systemId: number): Promise<DataObject[]> {
    return store.dataObjects.filter((object) => object.sourceSystemId === systemId);
  },
  async getDataObjectsByTargetSystem(systemId: number): Promise<DataObject[]> {
    return store.dataObjects.filter((object) => object.targetSystemId === systemId);
  },
  async getDataObject(id: number): Promise<DataObject | undefined> {
    return store.dataObjects.find((object) => object.id === id);
  },
  async createDataObject(object: InsertDataObject): Promise<DataObject> {
    const newObject: DataObject = {
      id: ++counters.dataObject,
      name: object.name,
      modelId: object.modelId,
      domainId: object.domainId ?? null,
      dataAreaId: object.dataAreaId ?? null,
      sourceSystemId: object.sourceSystemId ?? null,
      targetSystemId: object.targetSystemId ?? null,
      position: (object.position ?? null) as any,
      metadata: (object.metadata ?? null) as any,
      isNew: object.isNew ?? false,
      commonProperties: (object.commonProperties ?? null) as any,
      description: object.description ?? null,
      objectType: object.objectType ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataObjects.push(newObject);
    return newObject;
  },
  async updateDataObject(id: number, updates: Partial<InsertDataObject>): Promise<DataObject> {
    const object = store.dataObjects.find((item) => item.id === id);
    if (!object) {
      throw new Error(`DataObject with id ${id} not found`);
    }

    Object.assign(object, {
      ...updates,
      metadata: updates.metadata ?? object.metadata,
      position: updates.position ?? object.position,
      commonProperties: updates.commonProperties ?? object.commonProperties
    });

    object.updatedAt = new Date();
    return object;
  },
  async deleteDataObject(id: number): Promise<void> {
    const index = store.dataObjects.findIndex((object) => object.id === id);
    if (index !== -1) {
      store.dataObjects.splice(index, 1);
    }
  },
  async createDataModelObject(object: InsertDataModelObject): Promise<DataModelObject> {
    const newModelObject: DataModelObject = {
      id: ++counters.dataModelObject,
      objectId: object.objectId ?? null,
      modelId: object.modelId,
      name: object.name ?? null,
      description: object.description ?? null,
      objectType: object.objectType ?? null,
      domainId: object.domainId ?? null,
      dataAreaId: object.dataAreaId ?? null,
      sourceSystemId: object.sourceSystemId ?? null,
      targetSystemId: object.targetSystemId ?? null,
      position: (object.position ?? null) as any,
      metadata: (object.metadata ?? null) as any,
      isVisible: object.isVisible ?? true,
      layerSpecificConfig: (object.layerSpecificConfig ?? null) as any,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataModelObjects.push(newModelObject);

    const baseLayer = store.dataModelLayers.find((layer) => layer.id === object.modelId);
    const siblingLayers = baseLayer
      ? store.dataModelLayers.filter((layer) => layer.dataModelId === baseLayer.dataModelId)
      : [];

    if (siblingLayers.length === 0) {
      const fallbackLink: DataModelLayerObject = {
        id: ++counters.dataModelLayerObject,
        dataModelLayerId: object.modelId,
        dataModelObjectId: newModelObject.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      store.dataModelLayerObjects.push(fallbackLink);
    } else {
      siblingLayers.forEach((layer) => {
        const exists = store.dataModelLayerObjects.some(
          (link) => link.dataModelLayerId === layer.id && link.dataModelObjectId === newModelObject.id
        );

        if (!exists) {
          store.dataModelLayerObjects.push({
            id: ++counters.dataModelLayerObject,
            dataModelLayerId: layer.id,
            dataModelObjectId: newModelObject.id,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      });
    }

    return newModelObject;
  },
  async getDataModelObject(id: number): Promise<DataModelObject | undefined> {
    return store.dataModelObjects.find((modelObject) => modelObject.id === id);
  },
  async updateDataModelObject(id: number, updates: Partial<InsertDataModelObject>): Promise<DataModelObject> {
    const modelObject = store.dataModelObjects.find((entry) => entry.id === id);
    if (!modelObject) {
      throw new Error(`DataModelObject with id ${id} not found`);
    }

    if (Object.prototype.hasOwnProperty.call(updates, "targetSystemId")) {
      modelObject.targetSystemId = updates.targetSystemId ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "position")) {
      modelObject.position = (updates.position ?? null) as any;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "metadata")) {
      modelObject.metadata = (updates.metadata ?? null) as any;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "isVisible")) {
      modelObject.isVisible = updates.isVisible ?? modelObject.isVisible;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "layerSpecificConfig")) {
      modelObject.layerSpecificConfig = (updates.layerSpecificConfig ?? null) as any;
    }

    modelObject.updatedAt = new Date();
    return modelObject;
  },
  async getDataModelObjects(): Promise<DataModelObject[]> {
    return store.dataModelObjects;
  },
  async getDataModelObjectsByModel(modelId: number): Promise<DataModelObject[]> {
    const linkedObjects = store.dataModelLayerObjects
      .filter((link) => link.dataModelLayerId === modelId)
      .map((link) => store.dataModelObjects.find((modelObject) => modelObject.id === link.dataModelObjectId))
      .filter((modelObject): modelObject is DataModelObject => Boolean(modelObject));

    const resolveTime = (value: Date | null | undefined): number => {
      if (!value) {
        return 0;
      }

      return value instanceof Date ? value.getTime() : new Date(value).getTime();
    };

    const byObjectKey = new Map<string | number, DataModelObject>();

    for (const modelObject of linkedObjects) {
      const key = modelObject.objectId ?? `model-${modelObject.id}`;
      const existing = byObjectKey.get(key);

      if (!existing) {
        byObjectKey.set(key, modelObject);
        continue;
      }

      const currentMatchesLayer = modelObject.modelId === modelId;
      const existingMatchesLayer = existing.modelId === modelId;

      if (currentMatchesLayer && !existingMatchesLayer) {
        byObjectKey.set(key, modelObject);
        continue;
      }

      if (currentMatchesLayer === existingMatchesLayer) {
        if (resolveTime(modelObject.updatedAt) > resolveTime(existing.updatedAt)) {
          byObjectKey.set(key, modelObject);
        }
      }
    }

    return Array.from(byObjectKey.values());
  },
  async deleteDataModelObjectsByObject(objectId: number): Promise<void> {
    store.dataModelObjects = store.dataModelObjects.filter((modelObject) => modelObject.objectId !== objectId);
  },
  async getDataModelObjectRelationships(): Promise<DataModelObjectRelationship[]> {
    return store.dataModelObjectRelationships;
  },
  async getDataModelObjectRelationship(id: number): Promise<DataModelObjectRelationship | undefined> {
    return store.dataModelObjectRelationships.find((relationship) => relationship.id === id);
  },
  async getDataModelObjectRelationshipsByModel(modelId: number): Promise<DataModelObjectRelationship[]> {
    return store.dataModelObjectRelationships.filter((relationship) => relationship.modelId === modelId);
  },
  async createAttribute(attribute: InsertAttribute): Promise<Attribute> {
    const newAttribute: Attribute = {
      id: ++counters.attribute,
      name: attribute.name,
      objectId: attribute.objectId,
      conceptualType: attribute.conceptualType ?? null,
      logicalType: attribute.logicalType ?? null,
      physicalType: attribute.physicalType ?? null,
      length: attribute.length ?? null,
      precision: attribute.precision ?? null,
      scale: attribute.scale ?? null,
      nullable: attribute.nullable ?? true,
      isPrimaryKey: attribute.isPrimaryKey ?? false,
      isForeignKey: attribute.isForeignKey ?? false,
      orderIndex: attribute.orderIndex ?? 0,
      isNew: attribute.isNew ?? false,
      commonProperties: (attribute.commonProperties ?? null) as any,
      description: attribute.description ?? null,
      dataType: attribute.dataType ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.attributes.push(newAttribute);
    return newAttribute;
  },
  async getAllAttributes(): Promise<Attribute[]> {
    return store.attributes;
  },
  async getAttributesByObject(objectId: number): Promise<Attribute[]> {
    return store.attributes.filter((attribute) => attribute.objectId === objectId);
  },
  async deleteAttributesByObject(objectId: number): Promise<void> {
    store.attributes = store.attributes.filter((attribute) => attribute.objectId !== objectId);
  },
  async getDataModelObjectAttributes(): Promise<DataModelObjectAttribute[]> {
    return store.dataModelAttributes;
  },
  async createDataModelObjectAttribute(attribute: InsertDataModelObjectAttribute): Promise<DataModelObjectAttribute> {
    const newAttribute: DataModelObjectAttribute = {
      id: ++counters.dataModelAttribute,
      attributeId: attribute.attributeId ?? null,
      modelObjectId: attribute.modelObjectId,
      modelId: attribute.modelId,
      name: attribute.name ?? null,
      description: attribute.description ?? null,
      dataType: attribute.dataType ?? null,
      length: attribute.length ?? null,
      precision: attribute.precision ?? null,
      scale: attribute.scale ?? null,
      conceptualType: attribute.conceptualType ?? null,
      logicalType: attribute.logicalType ?? null,
      physicalType: attribute.physicalType ?? null,
      nullable: attribute.nullable ?? true,
      isPrimaryKey: attribute.isPrimaryKey ?? false,
      isForeignKey: attribute.isForeignKey ?? false,
      orderIndex: attribute.orderIndex ?? 0,
      layerSpecificConfig: (attribute.layerSpecificConfig ?? null) as any,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataModelAttributes.push(newAttribute);
    return newAttribute;
  },
  async getDataModelAttribute(id: number): Promise<DataModelObjectAttribute | undefined> {
    return store.dataModelAttributes.find((attribute) => attribute.id === id);
  },
  async createDataModelObjectRelationship(
    relationship: InsertDataModelObjectRelationship
  ): Promise<DataModelObjectRelationship> {
    const newRelationship: DataModelObjectRelationship = {
      id: ++counters.dataModelObjectRelationship,
      sourceModelObjectId: relationship.sourceModelObjectId,
      targetModelObjectId: relationship.targetModelObjectId,
      type: relationship.type,
      relationshipLevel: relationship.relationshipLevel ?? "object",
      sourceAttributeId: relationship.sourceAttributeId ?? null,
      targetAttributeId: relationship.targetAttributeId ?? null,
      modelId: relationship.modelId,
      layer: relationship.layer,
      name: relationship.name ?? null,
      description: relationship.description ?? null,
      sourceHandle: relationship.sourceHandle ?? null,
      targetHandle: relationship.targetHandle ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataModelObjectRelationships.push(newRelationship);
    return newRelationship;
  },
  async updateDataModelObjectRelationship(
    id: number,
    updates: Partial<InsertDataModelObjectRelationship>,
  ): Promise<DataModelObjectRelationship> {
    const relationship = store.dataModelObjectRelationships.find((entry) => entry.id === id);
    if (!relationship) {
      throw new Error(`Relationship ${id} not found`);
    }

    if (updates.type !== undefined) {
      relationship.type = updates.type;
    }

    if (updates.relationshipLevel !== undefined) {
      relationship.relationshipLevel = updates.relationshipLevel;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "sourceAttributeId")) {
      relationship.sourceAttributeId = updates.sourceAttributeId ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "targetAttributeId")) {
      relationship.targetAttributeId = updates.targetAttributeId ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "name")) {
      relationship.name = updates.name ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "description")) {
      relationship.description = updates.description ?? null;
    }

    return relationship;
  },
  async deleteDataModelObjectRelationship(id: number): Promise<void> {
    store.dataModelObjectRelationships = store.dataModelObjectRelationships.filter(
      (relationship) => relationship.id !== id,
    );
  },
  async getDataObjectRelationships(): Promise<DataObjectRelationship[]> {
    return store.dataObjectRelationships;
  },
  async getDataObjectRelationshipsByObject(objectId: number): Promise<DataObjectRelationship[]> {
    return store.dataObjectRelationships.filter(
      (relationship) =>
        relationship.sourceDataObjectId === objectId || relationship.targetDataObjectId === objectId
    );
  },
  async createDataObjectRelationship(
    relationship: InsertDataObjectRelationship
  ): Promise<DataObjectRelationship> {
    const newRelationship: DataObjectRelationship = {
      id: ++counters.dataObjectRelationship,
      sourceDataObjectId: relationship.sourceDataObjectId,
      targetDataObjectId: relationship.targetDataObjectId,
      type: relationship.type ?? "1:N",
      relationshipLevel: relationship.relationshipLevel ?? "object",
      sourceAttributeId: relationship.sourceAttributeId ?? null,
      targetAttributeId: relationship.targetAttributeId ?? null,
      name: relationship.name ?? null,
      description: relationship.description ?? null,
      metadata: (relationship.metadata ?? null) as any,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataObjectRelationships.push(newRelationship);
    return newRelationship;
  },
  async updateDataObjectRelationship(
    id: number,
    updates: Partial<InsertDataObjectRelationship>
  ): Promise<DataObjectRelationship> {
    const relationship = store.dataObjectRelationships.find((entry) => entry.id === id);
    if (!relationship) {
      throw new Error(`DataObjectRelationship ${id} not found`);
    }

    if (updates.type !== undefined) {
      relationship.type = updates.type;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "relationshipLevel")) {
      relationship.relationshipLevel = (updates.relationshipLevel ?? "object") as DataObjectRelationship["relationshipLevel"];
    }

    if (Object.prototype.hasOwnProperty.call(updates, "sourceAttributeId")) {
      relationship.sourceAttributeId = updates.sourceAttributeId ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "targetAttributeId")) {
      relationship.targetAttributeId = updates.targetAttributeId ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "name")) {
      relationship.name = updates.name ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "description")) {
      relationship.description = updates.description ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "metadata")) {
      relationship.metadata = (updates.metadata ?? null) as any;
    }

    relationship.updatedAt = new Date();
    return relationship;
  },
  async deleteDataObjectRelationship(id: number): Promise<void> {
    store.dataObjectRelationships = store.dataObjectRelationships.filter(
      (relationship) => relationship.id !== id
    );
  },
  async getDataObjectRelationship(id: number): Promise<DataObjectRelationship | undefined> {
    return store.dataObjectRelationships.find((relationship) => relationship.id === id);
  },
  async getDataModelProperties(): Promise<DataModelProperty[]> {
    return store.dataModelProperties;
  },
  async getDataModelPropertiesByEntity(entityType: string, entityId: number): Promise<DataModelProperty[]> {
    return store.dataModelProperties.filter((property) => property.entityType === entityType && property.entityId === entityId);
  },
  async deleteDataObjectRelationshipsByObject(objectId: number): Promise<void> {
    store.dataObjectRelationships = store.dataObjectRelationships.filter(
      (relationship) =>
        relationship.sourceDataObjectId !== objectId && relationship.targetDataObjectId !== objectId
    );
  },
  
  // Data Models (parent table)
  async getDataModels(): Promise<DataModel[]> {
    return store.dataModels;
  },
  async getDataModel(id: number): Promise<DataModel | undefined> {
    return store.dataModels.find((model) => model.id === id);
  },
  async createDataModel(model: InsertDataModel): Promise<DataModel> {
    const newModel: DataModel = {
      id: ++counters.dataModel,
      name: model.name,
      description: model.description ?? null,
      targetSystemId: model.targetSystemId ?? null,
      domainId: model.domainId ?? null,
      dataAreaId: model.dataAreaId ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataModels.push(newModel);
    return newModel;
  },
  async updateDataModel(id: number, model: Partial<InsertDataModel>): Promise<DataModel> {
    const existing = store.dataModels.find((m) => m.id === id);
    if (!existing) {
      throw new Error(`DataModel ${id} not found`);
    }
    Object.assign(existing, model, { updatedAt: new Date() });
    return existing;
  },
  async deleteDataModel(id: number): Promise<void> {
    store.dataModels = store.dataModels.filter((m) => m.id !== id);
  },
  
  // Data Model Layer Objects
  async getLayerObjectLinksByLayer(layerId: number): Promise<DataModelLayerObject[]> {
    return store.dataModelLayerObjects.filter((link) => link.dataModelLayerId === layerId);
  },
  async linkDataModelObjectToLayer(link: InsertDataModelLayerObject): Promise<DataModelLayerObject> {
    const newLink: DataModelLayerObject = {
      id: ++counters.dataModelLayerObject,
      dataModelLayerId: link.dataModelLayerId,
      dataModelObjectId: link.dataModelObjectId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataModelLayerObjects.push(newLink);
    return newLink;
  },
  async unlinkDataModelObjectFromLayer(layerId: number, objectId: number): Promise<void> {
    store.dataModelLayerObjects = store.dataModelLayerObjects.filter(
      (link) => !(link.dataModelLayerId === layerId && link.dataModelObjectId === objectId)
    );
  }
};


vi.mock("../server/storage", () => ({
  storage: storageMock
}));

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let registerRoutes: typeof import("../server/routes").registerRoutes;
let server: import("http").Server;

describe("Data model creation APIs", () => {
  beforeAll(async () => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";
    ({ registerRoutes } = await import("../server/routes"));
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(async () => {
    resetMockStore();
    await storageMock.createSystem({
      name: "Data Lake",
      category: "Test",
      type: "adls",
      description: "Test target system"
    } satisfies InsertSystem);
  });

  it("creates a conceptual model via /api/models", async () => {
    const response = await request(app)
      .post("/api/models")
      .send({
        name: "Standalone Conceptual Model",
        layer: "conceptual",
        targetSystemId: 1
      } satisfies InsertDataModel)
      .expect(201);

    const model = response.body as DataModel;
    expect(model.name).toBe("Standalone Conceptual Model");
    expect(model.layer).toBe("conceptual");
    expect(model.parentModelId).toBeNull();
    expect(store.dataModels).toHaveLength(1);
  });

  it("creates a logical model linked to a conceptual parent", async () => {
    const conceptualResponse = await request(app)
      .post("/api/models")
      .send({
        name: "Composite Model",
        layer: "conceptual"
      } satisfies InsertDataModel)
      .expect(201);

    const conceptualModel = conceptualResponse.body as DataModel;

    const logicalResponse = await request(app)
      .post("/api/models")
      .send({
        name: "Composite Model",
        layer: "logical",
        parentModelId: conceptualModel.id
      } satisfies InsertDataModel)
      .expect(201);

    const logicalModel = logicalResponse.body as DataModel;
    expect(logicalModel.layer).toBe("logical");
    expect(logicalModel.parentModelId).toBe(conceptualModel.id);
    expect(store.dataModels).toHaveLength(2);
  });

  it("creates a physical model linked to the same conceptual parent", async () => {
    const conceptualResponse = await request(app)
      .post("/api/models")
      .send({
        name: "Deployment Model",
        layer: "conceptual",
        targetSystemId: 1
      } satisfies InsertDataModel)
      .expect(201);

    const conceptualModel = conceptualResponse.body as DataModel;

    const logicalResponse = await request(app)
      .post("/api/models")
      .send({
        name: "Deployment Model",
        layer: "logical",
        parentModelId: conceptualModel.id
      } satisfies InsertDataModel)
      .expect(201);

    const physicalResponse = await request(app)
      .post("/api/models")
      .send({
        name: "Deployment Model",
        layer: "physical",
        parentModelId: conceptualModel.id
      } satisfies InsertDataModel)
      .expect(201);

    const logicalModel = logicalResponse.body as DataModelLayer;
    const physicalModel = physicalResponse.body as DataModelLayer;

    expect(logicalModel.parentModelId).toBe(conceptualModel.id);
    expect(physicalModel.parentModelId).toBe(conceptualModel.id);
    expect(store.dataModelLayers).toHaveLength(3);
  });

  it("creates flow, conceptual, logical, and physical models with mapped objects", async () => {
    const response = await request(app)
      .post("/api/models/create-with-layers")
      .send({ name: "QA Verification Model", targetSystem: "Data Lake" })
      .expect(201);

    const { flow, conceptual, logical, physical } = response.body as {
      flow: DataModelLayer;
      conceptual: DataModelLayer;
      logical: DataModelLayer;
      physical: DataModelLayer;
    };

    expect(store.dataModelLayers).toHaveLength(4);
    expect(store.dataModelLayers.map((model) => model.id)).toEqual(
      expect.arrayContaining([flow.id, conceptual.id, logical.id, physical.id])
    );
    expect(flow.parentModelId).toBe(conceptual.id);
    expect(logical.parentModelId).toBe(conceptual.id);
    expect(physical.parentModelId).toBe(conceptual.id);

    expect(store.dataDomains.length).toBeGreaterThan(0);
    expect(store.dataAreas.length).toBeGreaterThan(0);

    const logicalObjects = store.dataObjects.filter((object) => object.modelId === logical.id);
    const physicalObjects = store.dataObjects.filter((object) => object.modelId === physical.id);

    expect(store.dataObjects.length).toBeGreaterThanOrEqual(6);
    expect(logicalObjects.length).toBeGreaterThan(0);
    expect(physicalObjects.length).toBeGreaterThan(0);
    expect(store.dataObjects.every((object) => object.domainId !== null)).toBe(true);
    expect(store.dataObjects.every((object) => object.dataAreaId !== null)).toBe(true);
    expect(store.dataObjects.every((object) => object.targetSystemId === conceptual.targetSystemId)).toBe(true);

    const logicalAttributes = store.attributes.filter((attribute) =>
      logicalObjects.some((object) => object.id === attribute.objectId)
    );
    const physicalAttributes = store.attributes.filter((attribute) =>
      physicalObjects.some((object) => object.id === attribute.objectId)
    );

    expect(logicalAttributes.length).toBeGreaterThan(0);
    expect(physicalAttributes.length).toBeGreaterThan(0);

    expect(store.dataModelObjects.length).toBe(store.dataObjects.length);
    expect(
      store.dataModelObjects.every((modelObject) =>
        !!modelObject.layerSpecificConfig &&
        (modelObject.layerSpecificConfig as Record<string, any>).position !== undefined
      )
    ).toBe(true);
  });

  it.skip("cascades object creation across layers with attributes - PENDING: Cascade not yet implemented for user objects", async () => {
    const conceptualModel = await storageMock.createDataModelLayer({
      name: "Cascade Conceptual",
      layer: "conceptual"
    } satisfies InsertDataModelLayer);

    const logicalModel = await storageMock.createDataModelLayer({
      name: "Cascade Logical",
      layer: "logical",
      parentModelId: conceptualModel.id,
      dataModelId: conceptualModel.dataModelId
    } satisfies InsertDataModelLayer);

    const physicalModel = await storageMock.createDataModelLayer({
      name: "Cascade Physical",
      layer: "physical",
      parentModelId: conceptualModel.id,
      dataModelId: conceptualModel.dataModelId
    } satisfies InsertDataModelLayer);

    const cascadePayload = {
        name: "Customer",
        modelId: conceptualModel.id,
        objectType: "entity",
        cascade: true,
        attributes: [
          {
            name: "customer_id",
            conceptualType: "Identifier",
            logicalType: "UUID",
            physicalType: "uuid",
            nullable: false,
            isPrimaryKey: true
          },
          {
            name: "email",
            conceptualType: "Text",
            logicalType: "VARCHAR",
            physicalType: "varchar(255)",
            nullable: false
          }
        ]
      } as any;

    const response = await request(app)
      .post("/api/objects")
      .send(cascadePayload)
      .expect(201);

    const body = response.body as {
      layers: Record<string, { object: DataObject; modelObject: DataModelObject }>;
    };

    expect(body.layers.conceptual?.object?.name).toBe("Customer");
    expect(body.layers.logical?.object?.modelId).toBe(logicalModel.id);
    expect(body.layers.physical?.object?.modelId).toBe(physicalModel.id);

    const logicalObjects = store.dataObjects.filter(
      (object) => object.modelId === logicalModel.id && object.name === "Customer"
    );
    const physicalObjects = store.dataObjects.filter(
      (object) => object.modelId === physicalModel.id && object.name === "Customer"
    );

    expect(logicalObjects).toHaveLength(1);
    expect(physicalObjects).toHaveLength(1);

    const conceptualAttributes = store.attributes.filter(
      (attribute) => attribute.objectId === body.layers.conceptual!.object.id
    );
    const logicalAttributes = store.attributes.filter((attribute) => attribute.objectId === logicalObjects[0]!.id);
    const physicalAttributes = store.attributes.filter((attribute) => attribute.objectId === physicalObjects[0]!.id);

    expect(conceptualAttributes).toHaveLength(2);
    expect(logicalAttributes).toHaveLength(2);
    expect(physicalAttributes).toHaveLength(2);

    const conceptualModelAttributes = store.dataModelAttributes.filter(
      (attribute) => attribute.modelId === conceptualModel.id
    );
    const logicalModelAttributes = store.dataModelAttributes.filter((attribute) => attribute.modelId === logicalModel.id);
    const physicalModelAttributes = store.dataModelAttributes.filter((attribute) => attribute.modelId === physicalModel.id);

    expect(conceptualModelAttributes).toHaveLength(2);
    expect(logicalModelAttributes).toHaveLength(2);
    expect(physicalModelAttributes).toHaveLength(2);

    const logicalModelObjects = store.dataModelObjects.filter(
      (modelObject) => modelObject.modelId === logicalModel.id && modelObject.objectId === logicalObjects[0]!.id
    );
    const physicalModelObjects = store.dataModelObjects.filter(
      (modelObject) => modelObject.modelId === physicalModel.id && modelObject.objectId === physicalObjects[0]!.id
    );

    expect(logicalModelObjects).toHaveLength(1);
    expect(physicalModelObjects).toHaveLength(1);
  });

  it.skip("cascades object creation when physical model is nested under logical - PENDING: Cascade not yet implemented for user objects", async () => {
    const conceptualModel = await storageMock.createDataModelLayer({
      name: "Nested Cascade Conceptual",
      layer: "conceptual",
    } satisfies InsertDataModelLayer);

    const logicalModel = await storageMock.createDataModelLayer({
      name: "Nested Cascade Logical",
      layer: "logical",
      parentModelId: conceptualModel.id,
      dataModelId: conceptualModel.dataModelId
    } satisfies InsertDataModelLayer);

    const physicalModel = await storageMock.createDataModelLayer({
      name: "Nested Cascade Physical",
      layer: "physical",
      parentModelId: logicalModel.id,
      dataModelId: conceptualModel.dataModelId
    } satisfies InsertDataModelLayer);

    const response = await request(app)
      .post("/api/objects")
      .send({
        name: "Invoice",
        modelId: conceptualModel.id,
        objectType: "entity",
        cascade: true,
        attributes: [
          {
            name: "invoice_id",
            conceptualType: "Identifier",
            logicalType: "UUID",
            physicalType: "uuid",
            nullable: false,
            isPrimaryKey: true,
          },
          {
            name: "total",
            conceptualType: "Number",
            logicalType: "DECIMAL",
            physicalType: "decimal(10,2)",
            nullable: false,
          },
        ],
      })
      .expect(201);

    const body = response.body as {
      layers: Record<string, { object: DataObject; modelObject: DataModelObject }>;
    };

    expect(body.layers.conceptual?.object?.name).toBe("Invoice");
    expect(body.layers.logical?.object?.modelId).toBe(logicalModel.id);
    expect(body.layers.physical?.object?.modelId).toBe(physicalModel.id);

    const logicalObjects = store.dataObjects.filter(
      (object) => object.modelId === logicalModel.id && object.name === "Invoice",
    );
    const physicalObjects = store.dataObjects.filter(
      (object) => object.modelId === physicalModel.id && object.name === "Invoice",
    );

    expect(logicalObjects).toHaveLength(1);
    expect(physicalObjects).toHaveLength(1);

    const conceptualAttributes = store.attributes.filter(
      (attribute) => attribute.objectId === body.layers.conceptual!.object.id,
    );
    const logicalAttributes = store.attributes.filter((attribute) => attribute.objectId === logicalObjects[0]!.id);
    const physicalAttributes = store.attributes.filter((attribute) => attribute.objectId === physicalObjects[0]!.id);

    expect(conceptualAttributes).toHaveLength(2);
    expect(logicalAttributes).toHaveLength(2);
    expect(physicalAttributes).toHaveLength(2);

    const logicalModelAttributes = store.dataModelAttributes.filter((attribute) => attribute.modelId === logicalModel.id);
    const physicalModelAttributes = store.dataModelAttributes.filter((attribute) => attribute.modelId === physicalModel.id);

    expect(logicalModelAttributes).toHaveLength(2);
    expect(physicalModelAttributes).toHaveLength(2);
  });

  it.skip("propagates relationships across layers when provided - PENDING: Cascade not yet implemented for user objects", async () => {
    const conceptualModel = await storageMock.createDataModelLayer({
      name: "Relationship Conceptual",
      layer: "conceptual"
    } satisfies InsertDataModelLayer);

    const logicalModel = await storageMock.createDataModelLayer({
      name: "Relationship Logical",
      layer: "logical",
      parentModelId: conceptualModel.id,
      dataModelId: conceptualModel.dataModelId
    } satisfies InsertDataModelLayer);

    const physicalModel = await storageMock.createDataModelLayer({
      name: "Relationship Physical",
      layer: "physical",
      parentModelId: conceptualModel.id,
      dataModelId: conceptualModel.dataModelId
    } satisfies InsertDataModelLayer);

    const productPayload = {
        name: "Product",
        modelId: conceptualModel.id,
        objectType: "entity",
        cascade: true
      } as any;

    const productResponse = await request(app)
      .post("/api/objects")
      .send(productPayload)
      .expect(201);

    const productConceptualId = productResponse.body.layers.conceptual.object.id as number;

    const orderPayload = {
        name: "Order",
        modelId: conceptualModel.id,
        objectType: "entity",
        cascade: true,
        relationships: [
          {
            targetObjectId: productConceptualId,
            type: "1:N"
          }
        ]
      } as any;

    const orderResponse = await request(app)
      .post("/api/objects")
      .send(orderPayload)
      .expect(201);

    const orderBody = orderResponse.body as {
      layers: Record<string, { object: DataObject; modelObject: DataModelObject }>;
    };

    const orderConceptualObject = orderBody.layers.conceptual!.object;

    const globalRelationships = store.dataObjectRelationships.filter(
      (relationship) =>
        (relationship.sourceDataObjectId === orderConceptualObject.id && relationship.targetDataObjectId === productConceptualId) ||
        (relationship.sourceDataObjectId === productConceptualId && relationship.targetDataObjectId === orderConceptualObject.id)
    );

    expect(globalRelationships).toHaveLength(1);

    const relationshipByModel = (modelId: number) => {
      const orderModelObject = store.dataModelObjects.find(
        (modelObject) =>
          modelObject.modelId === modelId && matchesConceptualOrigin(modelObject, orderConceptualObject.id)
      );
      const productModelObject = store.dataModelObjects.find(
        (modelObject) =>
          modelObject.modelId === modelId && matchesConceptualOrigin(modelObject, productConceptualId)
      );

      if (!orderModelObject || !productModelObject) {
        return undefined;
      }

      return store.dataModelObjectRelationships.find(
        (relationship) =>
          relationship.modelId === modelId &&
          relationship.sourceModelObjectId === orderModelObject.id &&
          relationship.targetModelObjectId === productModelObject.id
      );
    };

    expect(relationshipByModel(conceptualModel.id)).toBeDefined();
    expect(relationshipByModel(logicalModel.id)).toBeDefined();
    expect(relationshipByModel(physicalModel.id)).toBeDefined();
  });

  it.skip("propagates relationships when physical model is nested under logical - PENDING: Cascade not yet implemented for user objects", async () => {
    const conceptualModel = await storageMock.createDataModelLayer({
      name: "Nested Relationship Conceptual",
      layer: "conceptual",
    } satisfies InsertDataModelLayer);

    const logicalModel = await storageMock.createDataModelLayer({
      name: "Nested Relationship Logical",
      layer: "logical",
      parentModelId: conceptualModel.id,
      dataModelId: conceptualModel.dataModelId
    } satisfies InsertDataModelLayer);

    const physicalModel = await storageMock.createDataModelLayer({
      name: "Nested Relationship Physical",
      layer: "physical",
      parentModelId: logicalModel.id,
      dataModelId: conceptualModel.dataModelId
    } satisfies InsertDataModelLayer);

    const productPayload = {
        name: "Product",
        modelId: conceptualModel.id,
        objectType: "entity",
        cascade: true,
      } as any;

    const productResponse = await request(app)
      .post("/api/objects")
      .send(productPayload)
      .expect(201);

    const productConceptualId = productResponse.body.layers.conceptual.object.id as number;

    const orderPayload = {
        name: "Order",
        modelId: conceptualModel.id,
        objectType: "entity",
        cascade: true,
        relationships: [
          {
            targetObjectId: productConceptualId,
            type: "1:N",
          },
        ],
      } as any;

    const orderResponse = await request(app)
      .post("/api/objects")
      .send(orderPayload)
      .expect(201);

    const orderBody = orderResponse.body as {
      layers: Record<string, { object: DataObject; modelObject: DataModelObject }>;
    };

    const orderConceptualObject = orderBody.layers.conceptual!.object;

    const globalRelationships = store.dataObjectRelationships.filter(
      (relationship) =>
        (relationship.sourceDataObjectId === orderConceptualObject.id &&
          relationship.targetDataObjectId === productConceptualId) ||
        (relationship.sourceDataObjectId === productConceptualId &&
          relationship.targetDataObjectId === orderConceptualObject.id),
    );

    expect(globalRelationships).toHaveLength(1);

    const relationshipByModel = (modelId: number) => {
      const orderModelObject = store.dataModelObjects.find(
        (modelObject) =>
          modelObject.modelId === modelId &&
          matchesConceptualOrigin(modelObject, orderConceptualObject.id),
      );
      const productModelObject = store.dataModelObjects.find(
        (modelObject) =>
          modelObject.modelId === modelId &&
          matchesConceptualOrigin(modelObject, productConceptualId),
      );

      if (!orderModelObject || !productModelObject) {
        return undefined;
      }

      return store.dataModelObjectRelationships.find(
        (relationship) =>
          relationship.modelId === modelId &&
          relationship.sourceModelObjectId === orderModelObject.id &&
          relationship.targetModelObjectId === productModelObject.id,
      );
    };

    expect(relationshipByModel(conceptualModel.id)).toBeDefined();
    expect(relationshipByModel(logicalModel.id)).toBeDefined();
    expect(relationshipByModel(physicalModel.id)).toBeDefined();
  });

  describe("relationship synchronization endpoints", () => {
    async function createSynchronizedRelationship() {
      const context = await setupRelationshipSyncTestContext();

      const response = await request(app)
        .post("/api/relationships")
        .send({
          modelId: context.conceptualModel.id,
          sourceObjectId: context.source.object.id,
          targetObjectId: context.target.object.id,
          type: "1:N",
        })
        .expect(201);

      const findRelationship = (modelId: number, sourceId: number, targetId: number) =>
        store.dataModelObjectRelationships.find(
          (relationship) =>
            relationship.modelId === modelId &&
            relationship.sourceModelObjectId === sourceId &&
            relationship.targetModelObjectId === targetId,
        );

      const conceptualRelationship = findRelationship(
        context.conceptualModel.id,
        context.source.conceptual.id,
        context.target.conceptual.id,
      );
      const logicalRelationship = findRelationship(
        context.logicalModel.id,
        context.source.logical.id,
        context.target.logical.id,
      );
      const physicalRelationship = findRelationship(
        context.physicalModel.id,
        context.source.physical.id,
        context.target.physical.id,
      );

      const globalRelationship = store.dataObjectRelationships.find(
        (relationship) =>
          relationship.sourceDataObjectId === context.source.object.id &&
          relationship.targetDataObjectId === context.target.object.id,
      );

      expect(conceptualRelationship).toBeDefined();
      expect(logicalRelationship).toBeDefined();
      expect(physicalRelationship).toBeDefined();
      expect(globalRelationship).toBeDefined();

      return {
        context,
        responseBody: response.body as {
          id: number;
          dataObjectRelationshipId: number | null;
          syncedModelIds: number[];
          type: string;
        },
        conceptualRelationship: conceptualRelationship!,
        logicalRelationship: logicalRelationship!,
        physicalRelationship: physicalRelationship!,
        globalRelationship: globalRelationship!,
      };
    }

    it("creates synchronized relationships across all layers", async () => {
      const { context, responseBody, conceptualRelationship, logicalRelationship, physicalRelationship, globalRelationship } =
        await createSynchronizedRelationship();

      expect(responseBody.type).toBe("1:N");
      expect(responseBody.syncedModelIds).toEqual(
        expect.arrayContaining([
          context.conceptualModel.id,
          context.logicalModel.id,
          context.physicalModel.id,
        ]),
      );
      expect(responseBody.dataObjectRelationshipId).not.toBeNull();

      expect(conceptualRelationship.type).toBe("1:N");
      expect(logicalRelationship.type).toBe("1:N");
      expect(physicalRelationship.type).toBe("1:N");

      expect(globalRelationship.type).toBe("1:N");
      expect(globalRelationship.relationshipLevel).toBe("object");
    });

    it("updates synchronized relationships when modified", async () => {
      const { context, conceptualRelationship } = await createSynchronizedRelationship();

      const updateResponse = await request(app)
        .put(`/api/relationships/${conceptualRelationship.id}`)
        .send({
          type: "M:N",
          description: "Updated alignment",
        })
        .expect(200);

      const reloadedRelationships = (modelId: number) =>
        store.dataModelObjectRelationships.filter((relationship) => relationship.modelId === modelId);

      const conceptualMatches = reloadedRelationships(context.conceptualModel.id);
      const logicalMatches = reloadedRelationships(context.logicalModel.id);
      const physicalMatches = reloadedRelationships(context.physicalModel.id);

  expect(conceptualMatches).toHaveLength(1);
  expect(logicalMatches).toHaveLength(1);
  expect(physicalMatches).toHaveLength(1);

      expect(conceptualMatches.every((relationship) => relationship.type === "M:N")).toBe(true);
      expect(logicalMatches.every((relationship) => relationship.type === "M:N")).toBe(true);
      expect(physicalMatches.every((relationship) => relationship.type === "M:N")).toBe(true);

      const globalRelationship = store.dataObjectRelationships.find(
        (relationship) =>
          relationship.sourceDataObjectId === context.source.object.id &&
          relationship.targetDataObjectId === context.target.object.id,
      );

      expect(globalRelationship?.type).toBe("M:N");
      expect(globalRelationship?.description).toBe("Updated alignment");
      expect(updateResponse.body.syncedModelIds).toEqual(
        expect.arrayContaining([
          context.conceptualModel.id,
          context.logicalModel.id,
          context.physicalModel.id,
        ]),
      );
    });

    it.skip("removes synchronized relationships across the family - PENDING: Cascade delete may need adjustment", async () => {
      const { context, conceptualRelationship } = await createSynchronizedRelationship();

      await request(app)
        .delete(`/api/relationships/${conceptualRelationship.id}`)
        .expect(204);

      const remainingRelationships = store.dataModelObjectRelationships.filter((relationship) =>
        [
          context.conceptualModel.id,
          context.logicalModel.id,
          context.physicalModel.id,
        ].includes(relationship.modelId),
      );

      expect(remainingRelationships).toHaveLength(0);
      expect(store.dataObjectRelationships).toHaveLength(0);
    });
  });

  describe("canvas endpoints", () => {
    it.skip("returns nodes with common properties and metadata - PENDING: Canvas endpoint may need adjustment for new architecture", async () => {
      const context = await setupRelationshipSyncTestContext();

      const response = await request(app)
        .get(`/api/models/${context.conceptualModel.id}/canvas?layer=conceptual`)
        .expect(200);

      const body = response.body as {
        nodes: Array<{
          id: string;
          data: {
            objectId: number;
            commonProperties: Record<string, any> | null;
            metadata: Record<string, any> | null;
          };
        }>;
        edges: unknown[];
      };

      expect(body.nodes).toHaveLength(2);
      const orderNode = body.nodes.find((node) => node.id === context.source.object.id.toString());
      const customerNode = body.nodes.find((node) => node.id === context.target.object.id.toString());

      expect(orderNode?.data.commonProperties).toEqual({ steward: "Sales" });
      expect(orderNode?.data.metadata).toEqual({ owner: "OrderOps" });
      expect(customerNode?.data.commonProperties).toEqual({ steward: "CRM" });
      expect(customerNode?.data.metadata).toEqual({ owner: "CustomerSuccess" });

      expect(body.edges).toBeInstanceOf(Array);
    });

    it("persists conceptual positions to data objects", async () => {
      const context = await setupRelationshipSyncTestContext();

      const newPosition = { x: 410, y: 275 };

      const response = await request(app)
        .post(`/api/models/${context.conceptualModel.id}/canvas/positions`)
        .send({
          layer: "conceptual",
          positions: [
            {
              modelObjectId: context.source.conceptual.id,
              position: newPosition,
            },
          ],
        })
        .expect(200);

      expect(response.body).toMatchObject({ success: true, saved: 1 });

      const updatedModelObject = store.dataModelObjects.find(
        (modelObject) => modelObject.id === context.source.conceptual.id,
      );
      expect(updatedModelObject).toBeDefined();

      const layerConfig = (updatedModelObject!.layerSpecificConfig ?? {}) as Record<string, any>;
      const layers = (layerConfig.layers ?? {}) as Record<string, any>;
      expect(layers.conceptual?.position).toEqual(newPosition);
      expect(layerConfig.position).toEqual(newPosition);
      expect(layerConfig.lastUpdatedLayer).toBe("conceptual");

      const updatedDataObject = store.dataObjects.find(
        (object) => object.id === context.source.object.id,
      );
      expect(updatedDataObject?.position).toEqual(newPosition as any);

      const untouchedDataObject = store.dataObjects.find(
        (object) => object.id === context.target.object.id,
      );
      expect(untouchedDataObject?.position).toEqual(context.target.object.position);
    });
  });

  describe("GET /api/object-lake", () => {
    it("returns aggregated objects with totals across layers", async () => {
      const seeded = await seedObjectLakeData();

      const response = await request(app).get("/api/object-lake").expect(200);

      const body = response.body as {
        objects: Array<{ name: string }>;
        totals: { objectCount: number; attributeCount: number; relationshipCount: number; modelInstanceCount: number };
      };

      expect(body.objects).toHaveLength(2);
      expect(body.objects.map((object) => object.name)).toEqual(
        expect.arrayContaining([seeded.userObject.name, seeded.productObject.name])
      );
      expect(body.totals.objectCount).toBe(2);
      expect(body.totals.attributeCount).toBeGreaterThan(0);
      expect(body.totals.relationshipCount).toBeGreaterThan(0);
      expect(body.totals.modelInstanceCount).toBeGreaterThan(0);
    });

    it("supports filtering by layer while respecting instance visibility", async () => {
      const seeded = await seedObjectLakeData();

      const response = await request(app)
        .get("/api/object-lake?layer=logical")
        .expect(200);

      const body = response.body as { objects: Array<{ name: string; modelInstances: Array<{ model: { layer: string | null } | null }> }> };

      expect(body.objects).toHaveLength(1);
      expect(body.objects[0]?.name).toBe(seeded.userObject.name);
      expect(
        body.objects[0]?.modelInstances.some((instance) => instance.model?.layer === "logical")
      ).toBe(true);
    });

    it("includes nested relationships, attributes, and properties in the payload", async () => {
      const seeded = await seedObjectLakeData();

      const response = await request(app).get("/api/object-lake").expect(200);

      const body = response.body as {
        objects: Array<{
          name: string;
          relationships: { global: unknown[]; modelSpecific: unknown[] };
          attributes: Array<{ properties: unknown[] }>;
          modelInstances: Array<{ properties: unknown[] }>;
          properties: unknown[];
        }>;
      };

      const userObject = body.objects.find((object) => object.name === seeded.userObject.name);
      expect(userObject).toBeDefined();
      expect(userObject?.relationships.global.length).toBeGreaterThan(0);
      expect(userObject?.relationships.modelSpecific.length).toBeGreaterThan(0);
      expect(userObject?.attributes.length).toBeGreaterThanOrEqual(2);
      expect(userObject?.attributes.some((attribute) => attribute.properties.length > 0)).toBe(true);
      expect(userObject?.properties.length).toBeGreaterThan(0);
      expect(userObject?.modelInstances.length).toBeGreaterThan(0);
      expect(userObject?.modelInstances.some((instance) => instance.properties.length > 0)).toBe(true);
    });
  });
});