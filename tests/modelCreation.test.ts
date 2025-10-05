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
  type DataModelObject,
  type DataModelAttribute,
  type DataModelObjectRelationship,
  type DataModelProperty,
  type DataObject,
  type DataObjectRelationship,
  type InsertAttribute,
  type InsertDataArea,
  type InsertDataDomain,
  type InsertDataModel,
  type InsertDataModelObject,
  type InsertDataObject,
  type InsertSystem,
  type System
} from "../shared/schema";

interface MockStore {
  systems: System[];
  dataModels: DataModel[];
  dataDomains: DataDomain[];
  dataAreas: DataArea[];
  dataObjects: DataObject[];
  dataModelObjects: DataModelObject[];
  attributes: Attribute[];
  dataObjectRelationships: DataObjectRelationship[];
  dataModelAttributes: DataModelAttribute[];
  dataModelObjectRelationships: DataModelObjectRelationship[];
  dataModelProperties: DataModelProperty[];
}

const store: MockStore = {
  systems: [],
  dataModels: [],
  dataDomains: [],
  dataAreas: [],
  dataObjects: [],
  dataModelObjects: [],
  attributes: [],
  dataObjectRelationships: [],
  dataModelAttributes: [],
  dataModelObjectRelationships: [],
  dataModelProperties: []
};

const counters = {
  system: 0,
  dataModel: 0,
  dataDomain: 0,
  dataArea: 0,
  dataObject: 0,
  dataModelObject: 0,
  attribute: 0,
  dataObjectRelationship: 0,
  dataModelAttribute: 0,
  dataModelObjectRelationship: 0,
  dataModelProperty: 0
};

function resetMockStore() {
  store.systems.length = 0;
  store.dataModels.length = 0;
  store.dataDomains.length = 0;
  store.dataAreas.length = 0;
  store.dataObjects.length = 0;
  store.dataModelObjects.length = 0;
  store.attributes.length = 0;
  store.dataObjectRelationships.length = 0;
  store.dataModelAttributes.length = 0;
  store.dataModelObjectRelationships.length = 0;
  store.dataModelProperties.length = 0;
  counters.system = 0;
  counters.dataModel = 0;
  counters.dataDomain = 0;
  counters.dataArea = 0;
  counters.dataObject = 0;
  counters.dataModelObject = 0;
  counters.attribute = 0;
  counters.dataObjectRelationship = 0;
  counters.dataModelAttribute = 0;
  counters.dataModelObjectRelationship = 0;
  counters.dataModelProperty = 0;
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

  const conceptualModel = await storageMock.createDataModel({
    name: "Customer 360 Conceptual",
    layer: "conceptual",
    targetSystemId: targetSystem.id,
    domainId: domain.id,
    dataAreaId: dataArea.id
  } satisfies InsertDataModel);

  const logicalModel = await storageMock.createDataModel({
    name: "Customer 360 Logical",
    layer: "logical",
    parentModelId: conceptualModel.id,
    targetSystemId: targetSystem.id,
    domainId: domain.id,
    dataAreaId: dataArea.id
  } satisfies InsertDataModel);

  const physicalModel = await storageMock.createDataModel({
    name: "Customer 360 Physical",
    layer: "physical",
    parentModelId: conceptualModel.id,
    targetSystemId: targetSystem.id,
    domainId: domain.id,
    dataAreaId: dataArea.id
  } satisfies InsertDataModel);

  const userObject = await storageMock.createDataObject({
    name: "User",
    modelId: conceptualModel.id,
    domainId: domain.id,
    dataAreaId: dataArea.id,
    sourceSystemId: sourceSystem.id,
    targetSystemId: targetSystem.id,
    objectType: "entity",
    description: "Master user record",
    metadata: { steward: "Data Platform" },
    position: { x: 120, y: 80 },
    commonProperties: { retention: "7y" }
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
    metadata: { steward: "Commerce Team" },
    position: { x: 240, y: 140 },
    commonProperties: { retention: "5y" }
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
    metadata: { alias: "dim_user" },
    position: { x: 150, y: 100 },
    isVisible: true,
    layerSpecificConfig: { color: "blue" }
  } satisfies InsertDataModelObject);

  const userPhysicalInstance = await storageMock.createDataModelObject({
    objectId: userObject.id,
    modelId: physicalModel.id,
    targetSystemId: targetSystem.id,
    metadata: { table: "users" },
    position: { x: 220, y: 100 },
    isVisible: true,
    layerSpecificConfig: { schema: "public" }
  } satisfies InsertDataModelObject);

  const productLogicalInstance = await storageMock.createDataModelObject({
    objectId: productObject.id,
    modelId: logicalModel.id,
    targetSystemId: targetSystem.id,
    metadata: { alias: "dim_product" },
    position: { x: 260, y: 140 },
    isVisible: false,
    layerSpecificConfig: { color: "green" }
  } satisfies InsertDataModelObject);

  store.dataModelAttributes.push({
    id: ++counters.dataModelAttribute,
    attributeId: userIdAttribute.id,
    modelObjectId: userLogicalInstance.id,
    modelId: logicalModel.id,
    conceptualType: "Identifier",
    logicalType: "UUID",
    physicalType: "uuid",
    nullable: false,
    isPrimaryKey: true,
    isForeignKey: false,
    orderIndex: 1,
    layerSpecificConfig: { columnName: "user_id" },
    createdAt: new Date(),
    updatedAt: new Date()
  });

  store.dataModelAttributes.push({
    id: ++counters.dataModelAttribute,
    attributeId: userEmailAttribute.id,
    modelObjectId: userLogicalInstance.id,
    modelId: logicalModel.id,
    conceptualType: "Text",
    logicalType: "VARCHAR",
    physicalType: "varchar(255)",
    nullable: false,
    isPrimaryKey: false,
    isForeignKey: false,
    orderIndex: 2,
    layerSpecificConfig: { columnName: "email" },
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
      layer: model.layer,
      parentModelId: model.parentModelId ?? null,
      targetSystemId: model.targetSystemId ?? null,
      domainId: model.domainId ?? null,
      dataAreaId: model.dataAreaId ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataModels.push(newModel);
    return newModel;
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
      objectId: object.objectId,
      modelId: object.modelId,
      targetSystemId: object.targetSystemId ?? null,
      position: (object.position ?? null) as any,
      metadata: (object.metadata ?? null) as any,
      isVisible: object.isVisible ?? true,
      layerSpecificConfig: (object.layerSpecificConfig ?? null) as any,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataModelObjects.push(newModelObject);
    return newModelObject;
  },
  async getDataModelObjects(): Promise<DataModelObject[]> {
    return store.dataModelObjects;
  },
  async getDataModelObjectsByModel(modelId: number): Promise<DataModelObject[]> {
    return store.dataModelObjects.filter((modelObject) => modelObject.modelId === modelId);
  },
  async deleteDataModelObjectsByObject(objectId: number): Promise<void> {
    store.dataModelObjects = store.dataModelObjects.filter((modelObject) => modelObject.objectId !== objectId);
  },
  async getDataModelObjectRelationships(): Promise<DataModelObjectRelationship[]> {
    return store.dataModelObjectRelationships;
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
  async getDataModelAttributes(): Promise<DataModelAttribute[]> {
    return store.dataModelAttributes;
  },
  async getDataModelAttribute(id: number): Promise<DataModelAttribute | undefined> {
    return store.dataModelAttributes.find((attribute) => attribute.id === id);
  },
  async getDataObjectRelationships(): Promise<DataObjectRelationship[]> {
    return store.dataObjectRelationships;
  },
  async getDataObjectRelationship(id: number): Promise<DataObjectRelationship | undefined> {
    return store.dataObjectRelationships.find((relationship) => relationship.id === id);
  },
  async getDataModelProperties(): Promise<DataModelProperty[]> {
    return store.dataModelProperties;
  },
  async getDataModelPropertiesByEntity(entityType: string, entityId: number): Promise<DataModelProperty[]> {
    return store.dataModelProperties.filter((property) => property.entityType === entityType && property.entityId === entityId);
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

    const logicalModel = logicalResponse.body as DataModel;
    const physicalModel = physicalResponse.body as DataModel;

    expect(logicalModel.parentModelId).toBe(conceptualModel.id);
    expect(physicalModel.parentModelId).toBe(conceptualModel.id);
    expect(store.dataModels).toHaveLength(3);
  });

  it("creates conceptual, logical, and physical models with mapped objects", async () => {
    const response = await request(app)
      .post("/api/models/create-with-layers")
      .send({ name: "QA Verification Model", targetSystem: "Data Lake" })
      .expect(201);

    const { conceptual, logical, physical } = response.body as {
      conceptual: DataModel;
      logical: DataModel;
      physical: DataModel;
    };

    expect(store.dataModels).toHaveLength(3);
    expect(store.dataModels.map((model) => model.id)).toEqual(
      expect.arrayContaining([conceptual.id, logical.id, physical.id])
    );
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