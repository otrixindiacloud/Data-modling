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
  type DataObject,
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
}

const store: MockStore = {
  systems: [],
  dataModels: [],
  dataDomains: [],
  dataAreas: [],
  dataObjects: [],
  dataModelObjects: [],
  attributes: []
};

const counters = {
  system: 0,
  dataModel: 0,
  dataDomain: 0,
  dataArea: 0,
  dataObject: 0,
  dataModelObject: 0,
  attribute: 0
};

function resetMockStore() {
  store.systems.length = 0;
  store.dataModels.length = 0;
  store.dataDomains.length = 0;
  store.dataAreas.length = 0;
  store.dataObjects.length = 0;
  store.dataModelObjects.length = 0;
  store.attributes.length = 0;
  counters.system = 0;
  counters.dataModel = 0;
  counters.dataDomain = 0;
  counters.dataArea = 0;
  counters.dataObject = 0;
  counters.dataModelObject = 0;
  counters.attribute = 0;
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
      createdAt: new Date(),
      updatedAt: new Date()
    };
    store.dataModels.push(newModel);
    return newModel;
  },
  async getDataDomains(): Promise<DataDomain[]> {
    return store.dataDomains;
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

describe("/api/models/create-with-layers", () => {
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
});