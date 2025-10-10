import {
  dataModels,
  dataModelLayers,
  dataDomains,
  dataAreas,
  dataObjects,
  dataModelObjects,
  dataModelLayerObjects,
  attributes,
  dataModelAttributes,
  dataModelProperties,
  dataObjectRelationships,
  dataModelObjectRelationships,
  systems,
  configurations,
  businessCapabilities,
  capabilityDataDomainMappings,
  capabilityDataAreaMappings,
  capabilitySystemMappings,
  type DataModel,
  type InsertDataModel,
  type DataModelLayer,
  type InsertDataModelLayer,
  type DataModelLayerObject,
  type InsertDataModelLayerObject,
  type DataDomain,
  type InsertDataDomain,
  type DataArea,
  type InsertDataArea,
  type DataObject,
  type InsertDataObject,
  type DataModelObject,
  type InsertDataModelObject,
  type Attribute,
  type InsertAttribute,
  type DataModelAttribute,
  type InsertDataModelAttribute,
  type DataModelProperty,
  type InsertDataModelProperty,
  type DataObjectRelationship,
  type InsertDataObjectRelationship,
  type DataModelObjectRelationship,
  type InsertDataModelObjectRelationship,
  type System,
  type InsertSystem,
  type Configuration,
  type InsertConfiguration,
  type BusinessCapability,
  type InsertBusinessCapability,
  type CapabilityDataDomainMapping,
  type InsertCapabilityDataDomainMapping,
  type CapabilityDataAreaMapping,
  type InsertCapabilityDataAreaMapping,
  type CapabilitySystemMapping,
  type InsertCapabilitySystemMapping,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or } from "drizzle-orm";

export interface CapabilitySystemMappingDetail {
  capabilityId: number;
  systemId: number;
  mappingType: string;
  systemRole: string;
  coverage: string;
  systemName: string;
  systemCategory: string | null;
  systemType: string | null;
  systemColorCode: string | null;
}

export interface IStorage {
  // Data Models (parent table)
  getDataModels(): Promise<DataModel[]>;
  getDataModel(id: number): Promise<DataModel | undefined>;
  createDataModel(model: InsertDataModel): Promise<DataModel>;
  updateDataModel(id: number, model: Partial<InsertDataModel>): Promise<DataModel>;
  deleteDataModel(id: number): Promise<void>;

  // Data Model Layers (child table - Flow, Conceptual, Logical, Physical)
  getDataModelLayers(): Promise<DataModelLayer[]>;
  getDataModelLayer(id: number): Promise<DataModelLayer | undefined>;
  createDataModelLayer(layer: InsertDataModelLayer): Promise<DataModelLayer>;
  updateDataModelLayer(id: number, layer: Partial<InsertDataModelLayer>): Promise<DataModelLayer>;
  deleteDataModelLayer(id: number): Promise<void>;

  // Data Model Layer ↔ Object mappings
  getLayerObjectLinksByLayer(layerId: number): Promise<DataModelLayerObject[]>;
  linkDataModelObjectToLayer(link: InsertDataModelLayerObject): Promise<DataModelLayerObject>;
  unlinkDataModelObjectFromLayer(layerId: number, objectId: number): Promise<void>;

  // Data Domains
  getDataDomains(): Promise<DataDomain[]>;
  getDataDomain(id: number): Promise<DataDomain | undefined>;
  getDataDomainByName(name: string): Promise<DataDomain | undefined>;
  createDataDomain(domain: InsertDataDomain): Promise<DataDomain>;
  updateDataDomain(id: number, domain: Partial<InsertDataDomain>): Promise<DataDomain>;
  deleteDataDomain(id: number): Promise<void>;

  // Data Areas
  getDataAreas(): Promise<DataArea[]>;
  getDataArea(id: number): Promise<DataArea | undefined>;
  getDataAreaByName(name: string, domainId?: number): Promise<DataArea | undefined>;
  getDataAreasByDomain(domainId: number): Promise<DataArea[]>;
  createDataArea(area: InsertDataArea): Promise<DataArea>;
  updateDataArea(id: number, area: Partial<InsertDataArea>): Promise<DataArea>;
  deleteDataArea(id: number): Promise<void>;

  // Data Objects
  getDataObjects(): Promise<DataObject[]>;
  getAllDataObjects(): Promise<DataObject[]>;
  getDataObject(id: number): Promise<DataObject | undefined>;
  getDataObjectsByModel(modelId: number): Promise<DataObject[]>;
  getDataObjectsBySystem(systemId: number): Promise<DataObject[]>;
  createDataObject(object: InsertDataObject): Promise<DataObject>;
  updateDataObject(id: number, object: Partial<InsertDataObject>): Promise<DataObject>;
  deleteDataObject(id: number): Promise<void>;
  deleteDataModelObjectsByObject(objectId: number): Promise<void>;

  // Data Model Objects
  getDataModelObjects(): Promise<DataModelObject[]>;
  getDataModelObjectsByModel(modelId: number): Promise<DataModelObject[]>;
  getDataModelObject(id: number): Promise<DataModelObject | undefined>;
  createDataModelObject(object: InsertDataModelObject): Promise<DataModelObject>;
  updateDataModelObject(id: number, object: Partial<InsertDataModelObject>): Promise<DataModelObject>;
  deleteDataModelObject(id: number): Promise<void>;

  // Attributes
  getAttributes(): Promise<Attribute[]>;
  getAllAttributes(): Promise<Attribute[]>;
  getAttribute(id: number): Promise<Attribute | undefined>;
  getAttributesByObject(objectId: number): Promise<Attribute[]>;
  createAttribute(attribute: InsertAttribute): Promise<Attribute>;
  updateAttribute(id: number, attribute: Partial<InsertAttribute>): Promise<Attribute>;
  deleteAttribute(id: number): Promise<void>;
  deleteAttributesByObject(objectId: number): Promise<void>;

  // Data Model Attributes
  getDataModelAttributes(): Promise<DataModelAttribute[]>;
  getDataModelAttribute(id: number): Promise<DataModelAttribute | undefined>;
  createDataModelAttribute(attribute: InsertDataModelAttribute): Promise<DataModelAttribute>;
  updateDataModelAttribute(id: number, attribute: Partial<InsertDataModelAttribute>): Promise<DataModelAttribute>;
  deleteDataModelAttribute(id: number): Promise<void>;

  // Data Model Properties
  getDataModelProperties(): Promise<DataModelProperty[]>;
  getDataModelPropertiesByEntity(entityType: string, entityId: number): Promise<DataModelProperty[]>;

  // Data Object Relationships
  getDataObjectRelationships(): Promise<DataObjectRelationship[]>;
  getDataObjectRelationship(id: number): Promise<DataObjectRelationship | undefined>;
  getDataObjectRelationshipsByObject(objectId: number): Promise<DataObjectRelationship[]>;
  createDataObjectRelationship(relationship: InsertDataObjectRelationship): Promise<DataObjectRelationship>;
  updateDataObjectRelationship(id: number, relationship: Partial<InsertDataObjectRelationship>): Promise<DataObjectRelationship>;
  deleteDataObjectRelationship(id: number): Promise<void>;
  deleteDataObjectRelationshipsByObject(objectId: number): Promise<void>;

  // Data Model Object Relationships
  getDataModelObjectRelationships(): Promise<DataModelObjectRelationship[]>;
  getDataModelObjectRelationship(id: number): Promise<DataModelObjectRelationship | undefined>;
  getDataModelObjectRelationshipsByModel(modelId: number): Promise<DataModelObjectRelationship[]>;
  createDataModelObjectRelationship(relationship: InsertDataModelObjectRelationship): Promise<DataModelObjectRelationship>;
  updateDataModelObjectRelationship(id: number, relationship: Partial<InsertDataModelObjectRelationship>): Promise<DataModelObjectRelationship>;
  deleteDataModelObjectRelationship(id: number): Promise<void>;

  // Systems
  getSystems(): Promise<System[]>;
  getSystem(id: number): Promise<System | undefined>;
  createSystem(system: InsertSystem): Promise<System>;
  updateSystem(id: number, system: Partial<InsertSystem>): Promise<System>;
  deleteSystem(id: number): Promise<void>;

  // Configurations
  getConfigurations(): Promise<Configuration[]>;
  getConfigurationsByCategory(category: string): Promise<Configuration[]>;
  getConfiguration(category: string, key: string): Promise<Configuration | undefined>;
  getConfigurationByCategoryAndKey(category: string, key: string): Promise<Configuration | undefined>;
  createConfiguration(config: InsertConfiguration): Promise<Configuration>;
  updateConfiguration(id: number, config: Partial<InsertConfiguration>): Promise<Configuration>;
  deleteConfiguration(id: number): Promise<void>;

  // Business Capabilities
  getBusinessCapabilities(): Promise<BusinessCapability[]>;
  getBusinessCapability(id: number): Promise<BusinessCapability | undefined>;
  getBusinessCapabilityTree(): Promise<any>;
  getCapabilityMappings(capabilityId: number): Promise<any>;
  getAllCapabilitySystemMappings(): Promise<CapabilitySystemMappingDetail[]>;
  createBusinessCapability(capability: InsertBusinessCapability): Promise<BusinessCapability>;
  updateBusinessCapability(id: number, capability: Partial<InsertBusinessCapability>): Promise<BusinessCapability>;
  deleteBusinessCapability(id: number): Promise<void>;
  
  // Capability Mappings
  createCapabilityDomainMapping(mapping: InsertCapabilityDataDomainMapping): Promise<CapabilityDataDomainMapping>;
  createCapabilityDataAreaMapping(mapping: InsertCapabilityDataAreaMapping): Promise<CapabilityDataAreaMapping>;
  createCapabilitySystemMapping(mapping: InsertCapabilitySystemMapping): Promise<CapabilitySystemMapping>;
  deleteCapabilityDomainMapping(id: number): Promise<void>;
  deleteCapabilityDataAreaMapping(id: number): Promise<void>;
  deleteCapabilitySystemMapping(id: number): Promise<void>;
}

export class Storage implements IStorage {
  // Data Models
  async getDataModels(): Promise<DataModel[]> {
    return await db.select().from(dataModels);
  }

  async getDataModel(id: number): Promise<DataModel | undefined> {
    const result = await db.select().from(dataModels).where(eq(dataModels.id, id));
    return result[0];
  }

  async createDataModel(model: InsertDataModel): Promise<DataModel> {
    const result = await db.insert(dataModels).values(model).returning();
    return result[0];
  }

  async updateDataModel(id: number, model: Partial<InsertDataModel>): Promise<DataModel> {
    const result = await db.update(dataModels).set(model).where(eq(dataModels.id, id)).returning();
    return result[0];
  }

  async deleteDataModel(id: number): Promise<void> {
    await db.delete(dataModels).where(eq(dataModels.id, id));
  }

  // Data Model Layers (child table - Flow, Conceptual, Logical, Physical)
  async getDataModelLayers(): Promise<DataModelLayer[]> {
    return await db.select().from(dataModelLayers);
  }

  async getDataModelLayer(id: number): Promise<DataModelLayer | undefined> {
    const result = await db.select().from(dataModelLayers).where(eq(dataModelLayers.id, id));
    return result[0];
  }

  async createDataModelLayer(layer: InsertDataModelLayer): Promise<DataModelLayer> {
    const { dataModelId: providedDataModelId, ...layerData } = layer;

    let dataModelId = providedDataModelId ?? null;

    if (!dataModelId) {
      // Auto-create parent data model if not provided
      const modelInsert = await db
        .insert(dataModels)
        .values({
          name: layerData.name,
          targetSystemId: layerData.targetSystemId ?? null,
          domainId: layerData.domainId ?? null,
          dataAreaId: layerData.dataAreaId ?? null,
        })
        .returning();

      dataModelId = modelInsert[0]?.id ?? null;
    } else {
      // Keep the parent model metadata loosely in sync when explicit values are provided
      const modelUpdates: Partial<DataModel> = {};
      if (layerData.targetSystemId !== undefined) {
        modelUpdates.targetSystemId = layerData.targetSystemId;
      }
      if (layerData.domainId !== undefined) {
        modelUpdates.domainId = layerData.domainId;
      }
      if (layerData.dataAreaId !== undefined) {
        modelUpdates.dataAreaId = layerData.dataAreaId;
      }
      if (Object.keys(modelUpdates).length > 0) {
        await db
          .update(dataModels)
          .set({
            ...modelUpdates,
            updatedAt: new Date(),
          })
          .where(eq(dataModels.id, dataModelId));
      }
    }

    if (!dataModelId) {
      throw new Error("Failed to resolve data model for layer creation");
    }

    const result = await db
      .insert(dataModelLayers)
      .values({
        ...layerData,
        dataModelId,
      })
      .returning();

    return result[0];
  }

  async updateDataModelLayer(id: number, layer: Partial<InsertDataModelLayer>): Promise<DataModelLayer> {
    const existing = await this.getDataModelLayer(id);
    if (!existing) {
      throw new Error(`Data model layer ${id} not found`);
    }

    // Keep the parent model metadata loosely in sync
    const modelUpdates: Partial<DataModel> = {};
    if (layer.name !== undefined && existing.layer === "flow") {
      modelUpdates.name = layer.name;
    }
    if (layer.targetSystemId !== undefined) {
      modelUpdates.targetSystemId = layer.targetSystemId;
    }
    if (layer.domainId !== undefined) {
      modelUpdates.domainId = layer.domainId;
    }
    if (layer.dataAreaId !== undefined) {
      modelUpdates.dataAreaId = layer.dataAreaId;
    }
    if (Object.keys(modelUpdates).length > 0) {
      if (existing.dataModelId) {
        await db
          .update(dataModels)
          .set({
            ...modelUpdates,
            updatedAt: new Date(),
          })
          .where(eq(dataModels.id, existing.dataModelId));
      }
    }

    const result = await db
      .update(dataModelLayers)
      .set({
        ...layer,
        updatedAt: new Date(),
      })
      .where(eq(dataModelLayers.id, id))
      .returning();

    return result[0];
  }

  async deleteDataModelLayer(id: number): Promise<void> {
    const existing = await this.getDataModelLayer(id);
    if (!existing) {
      return;
    }

    await db.delete(dataModelLayers).where(eq(dataModelLayers.id, id));

    // Check if this was the last layer in the parent model
    const siblings = await db
      .select()
      .from(dataModelLayers)
      .where(eq(dataModelLayers.dataModelId, existing.dataModelId));

    if (siblings.length === 0) {
      await db.delete(dataModels).where(eq(dataModels.id, existing.dataModelId));
    }
  }

  // Data Model Layer ↔ Object mappings
  async getLayerObjectLinksByLayer(layerId: number): Promise<DataModelLayerObject[]> {
    return await db
      .select()
      .from(dataModelLayerObjects)
      .where(eq(dataModelLayerObjects.dataModelLayerId, layerId));
  }

  async linkDataModelObjectToLayer(link: InsertDataModelLayerObject): Promise<DataModelLayerObject> {
    // Check if link already exists
    const existing = await db
      .select()
      .from(dataModelLayerObjects)
      .where(
        and(
          eq(dataModelLayerObjects.dataModelLayerId, link.dataModelLayerId),
          eq(dataModelLayerObjects.dataModelObjectId, link.dataModelObjectId)
        )
      );

    if (existing.length > 0) {
      return existing[0];
    }

    const result = await db.insert(dataModelLayerObjects).values(link).returning();
    return result[0];
  }

  async unlinkDataModelObjectFromLayer(layerId: number, objectId: number): Promise<void> {
    await db
      .delete(dataModelLayerObjects)
      .where(
        and(
          eq(dataModelLayerObjects.dataModelLayerId, layerId),
          eq(dataModelLayerObjects.dataModelObjectId, objectId)
        )
      );
  }

  // Data Domains
  async getDataDomains(): Promise<DataDomain[]> {
    return await db.select().from(dataDomains);
  }

  async getDataDomain(id: number): Promise<DataDomain | undefined> {
    const result = await db.select().from(dataDomains).where(eq(dataDomains.id, id));
    return result[0];
  }

  async getDataDomainByName(name: string): Promise<DataDomain | undefined> {
    const result = await db.select().from(dataDomains).where(eq(dataDomains.name, name));
    return result[0];
  }

  async createDataDomain(domain: InsertDataDomain): Promise<DataDomain> {
    const result = await db.insert(dataDomains).values(domain).returning();
    return result[0];
  }

  async updateDataDomain(id: number, domain: Partial<InsertDataDomain>): Promise<DataDomain> {
    const result = await db.update(dataDomains).set(domain).where(eq(dataDomains.id, id)).returning();
    return result[0];
  }

  async deleteDataDomain(id: number): Promise<void> {
    await db.delete(dataDomains).where(eq(dataDomains.id, id));
  }

  // Data Areas
  async getDataAreas(): Promise<DataArea[]> {
    return await db.select().from(dataAreas);
  }

  async getDataArea(id: number): Promise<DataArea | undefined> {
    const result = await db.select().from(dataAreas).where(eq(dataAreas.id, id));
    return result[0];
  }

  async getDataAreaByName(name: string, domainId?: number): Promise<DataArea | undefined> {
    let query = db.select().from(dataAreas).where(eq(dataAreas.name, name));
    if (domainId) {
      query = query.where(eq(dataAreas.domainId, domainId));
    }
    const result = await query;
    return result[0];
  }

  async getDataAreasByDomain(domainId: number): Promise<DataArea[]> {
    return await db.select().from(dataAreas).where(eq(dataAreas.domainId, domainId));
  }

  async createDataArea(area: InsertDataArea): Promise<DataArea> {
    const result = await db.insert(dataAreas).values(area).returning();
    return result[0];
  }

  async updateDataArea(id: number, area: Partial<InsertDataArea>): Promise<DataArea> {
    const result = await db.update(dataAreas).set(area).where(eq(dataAreas.id, id)).returning();
    return result[0];
  }

  async deleteDataArea(id: number): Promise<void> {
    await db.delete(dataAreas).where(eq(dataAreas.id, id));
  }

  // Data Objects
  async getDataObjects(): Promise<DataObject[]> {
    return await db.select().from(dataObjects);
  }

  async getAllDataObjects(): Promise<DataObject[]> {
    return await db.select().from(dataObjects);
  }

  async getDataObject(id: number): Promise<DataObject | undefined> {
    const result = await db.select().from(dataObjects).where(eq(dataObjects.id, id));
    return result[0];
  }

  async createDataObject(object: InsertDataObject): Promise<DataObject> {
    const result = await db.insert(dataObjects).values(object).returning();
    return result[0];
  }

  async updateDataObject(id: number, object: Partial<InsertDataObject>): Promise<DataObject> {
    const result = await db.update(dataObjects).set(object).where(eq(dataObjects.id, id)).returning();
    return result[0];
  }

  async deleteDataObject(id: number): Promise<void> {
    await db.delete(dataObjects).where(eq(dataObjects.id, id));
  }

  async deleteDataModelObjectsByObject(objectId: number): Promise<void> {
    await db.delete(dataModelObjects).where(eq(dataModelObjects.objectId, objectId));
  }

  private async ensureLayerMappingsForModelObject(modelObject: DataModelObject): Promise<void> {
    const layerRecord = await db
      .select({
        id: dataModelLayers.id,
        dataModelId: dataModelLayers.dataModelId,
      })
      .from(dataModelLayers)
      .where(eq(dataModelLayers.id, modelObject.modelId))
      .limit(1);

    const baseLayer = layerRecord[0];
    if (!baseLayer) {
      return;
    }

    const siblingLayers = await db
      .select({ id: dataModelLayers.id })
      .from(dataModelLayers)
      .where(eq(dataModelLayers.dataModelId, baseLayer.dataModelId));

    if (siblingLayers.length === 0) {
      return;
    }

    const timestamp = new Date();

    await db
      .insert(dataModelLayerObjects)
      .values(
        siblingLayers.map((layer) => ({
          dataModelLayerId: layer.id,
          dataModelObjectId: modelObject.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        }))
      )
      .onConflictDoNothing({
        target: [dataModelLayerObjects.dataModelLayerId, dataModelLayerObjects.dataModelObjectId],
      });
  }

  async getDataObjectsByModel(modelId: number): Promise<DataObject[]> {
    const result = await db
      .select({ dataObject: dataObjects })
      .from(dataObjects)
      .innerJoin(dataModelObjects, eq(dataObjects.id, dataModelObjects.objectId))
      .where(eq(dataModelObjects.modelId, modelId));
    return result.map((row) => row.dataObject);
  }

  async getDataObjectsBySystem(systemId: number): Promise<DataObject[]> {
    return await db.select().from(dataObjects).where(eq(dataObjects.systemId, systemId));
  }

  // Data Model Objects
  async getDataModelObjects(): Promise<DataModelObject[]> {
    return await db.select().from(dataModelObjects);
  }

  async getDataModelObjectsByModel(modelId: number): Promise<DataModelObject[]> {
    const linkedObjects = await db
      .select({
        dataModelObject: dataModelObjects,
      })
      .from(dataModelLayerObjects)
      .innerJoin(
        dataModelObjects,
        eq(dataModelLayerObjects.dataModelObjectId, dataModelObjects.id)
      )
      .where(eq(dataModelLayerObjects.dataModelLayerId, modelId));

    const resolveTime = (value: Date | null | undefined): number => {
      if (!value) {
        return 0;
      }
      return value instanceof Date ? value.getTime() : new Date(value).getTime();
    };

    const byObjectKey = new Map<string | number, DataModelObject>();

    for (const entry of linkedObjects) {
      const modelObject = entry.dataModelObject;
      const key = modelObject.objectId ?? `model-${modelObject.id}`;
      const existing = byObjectKey.get(key);

      if (!existing) {
        byObjectKey.set(key, modelObject);
        continue;
      }

      const modelObjectMatchesLayer = modelObject.modelId === modelId;
      const existingMatchesLayer = existing.modelId === modelId;

      if (modelObjectMatchesLayer && !existingMatchesLayer) {
        byObjectKey.set(key, modelObject);
        continue;
      }

      if (modelObjectMatchesLayer === existingMatchesLayer) {
        if (resolveTime(modelObject.updatedAt) > resolveTime(existing.updatedAt)) {
          byObjectKey.set(key, modelObject);
        }
      }
    }

    return Array.from(byObjectKey.values());
  }

  async getDataModelObject(id: number): Promise<DataModelObject | undefined> {
    const result = await db.select().from(dataModelObjects).where(eq(dataModelObjects.id, id));
    return result[0];
  }

  async createDataModelObject(object: InsertDataModelObject): Promise<DataModelObject> {
    // If objectId is provided and name/description are not, fetch from data_objects
    let enrichedObject = { ...object };
    
    if (object.objectId && (!object.name || !object.description)) {
      const dataObject = await this.getDataObject(object.objectId);
      if (dataObject) {
        if (!enrichedObject.name) {
          enrichedObject.name = dataObject.name;
        }
        if (!enrichedObject.description) {
          enrichedObject.description = dataObject.description;
        }
        if (!enrichedObject.objectType) {
          enrichedObject.objectType = dataObject.objectType;
        }
        if (!enrichedObject.domainId) {
          enrichedObject.domainId = dataObject.domainId;
        }
        if (!enrichedObject.dataAreaId) {
          enrichedObject.dataAreaId = dataObject.dataAreaId;
        }
      }
    }

    const result = await db.insert(dataModelObjects).values(enrichedObject).returning();
    const created = result[0];

    if (!created) {
      throw new Error("Failed to create data model object");
    }

    await this.ensureLayerMappingsForModelObject(created);

    return created;
  }

  async updateDataModelObject(id: number, object: Partial<InsertDataModelObject>): Promise<DataModelObject> {
    const result = await db.update(dataModelObjects).set(object).where(eq(dataModelObjects.id, id)).returning();
    return result[0];
  }

  async deleteDataModelObject(id: number): Promise<void> {
    await db.delete(dataModelObjects).where(eq(dataModelObjects.id, id));
  }

  // Attributes
  async getAttributes(): Promise<Attribute[]> {
    return await db.select().from(attributes);
  }

  async getAllAttributes(): Promise<Attribute[]> {
    return await db.select().from(attributes);
  }

  async getAttribute(id: number): Promise<Attribute | undefined> {
    const result = await db.select().from(attributes).where(eq(attributes.id, id));
    return result[0];
  }

  async createAttribute(attribute: InsertAttribute): Promise<Attribute> {
    const result = await db.insert(attributes).values(attribute).returning();
    return result[0];
  }

  async updateAttribute(id: number, attribute: Partial<InsertAttribute>): Promise<Attribute> {
    const result = await db.update(attributes).set(attribute).where(eq(attributes.id, id)).returning();
    return result[0];
  }

  async deleteAttribute(id: number): Promise<void> {
    await db.delete(attributes).where(eq(attributes.id, id));
  }

  async deleteAttributesByObject(objectId: number): Promise<void> {
    await db.delete(attributes).where(eq(attributes.objectId, objectId));
  }

  async getAttributesByObject(objectId: number): Promise<Attribute[]> {
    const result = await db.select().from(attributes).where(eq(attributes.objectId, objectId));
    return result;
  }

  // Data Model Attributes
  async getDataModelAttributes(): Promise<DataModelAttribute[]> {
    return await db.select().from(dataModelAttributes);
  }

  async getDataModelAttribute(id: number): Promise<DataModelAttribute | undefined> {
    const result = await db.select().from(dataModelAttributes).where(eq(dataModelAttributes.id, id));
    return result[0];
  }

  async createDataModelAttribute(attribute: InsertDataModelAttribute): Promise<DataModelAttribute> {
    const result = await db.insert(dataModelAttributes).values(attribute).returning();
    return result[0];
  }

  async updateDataModelAttribute(id: number, attribute: Partial<InsertDataModelAttribute>): Promise<DataModelAttribute> {
    const result = await db.update(dataModelAttributes).set(attribute).where(eq(dataModelAttributes.id, id)).returning();
    return result[0];
  }

  async deleteDataModelAttribute(id: number): Promise<void> {
    await db.delete(dataModelAttributes).where(eq(dataModelAttributes.id, id));
  }

  // Data Model Properties
  async getDataModelProperties(): Promise<DataModelProperty[]> {
    return await db.select().from(dataModelProperties);
  }

  async getDataModelPropertiesByEntity(entityType: string, entityId: number): Promise<DataModelProperty[]> {
    return await db
      .select()
      .from(dataModelProperties)
      .where(
        and(
          eq(dataModelProperties.entityType, entityType),
          eq(dataModelProperties.entityId, entityId)
        )
      );
  }

  // Data Object Relationships
  async getDataObjectRelationships(): Promise<DataObjectRelationship[]> {
    return await db.select().from(dataObjectRelationships);
  }

  async getDataObjectRelationship(id: number): Promise<DataObjectRelationship | undefined> {
    const result = await db
      .select()
      .from(dataObjectRelationships)
      .where(eq(dataObjectRelationships.id, id));
    return result[0];
  }

  async getDataObjectRelationshipsByObject(objectId: number): Promise<DataObjectRelationship[]> {
    return await db
      .select()
      .from(dataObjectRelationships)
      .where(
        or(
          eq(dataObjectRelationships.sourceDataObjectId, objectId),
          eq(dataObjectRelationships.targetDataObjectId, objectId)
        )
      );
  }

  async createDataObjectRelationship(relationship: InsertDataObjectRelationship): Promise<DataObjectRelationship> {
    const result = await db.insert(dataObjectRelationships).values(relationship).returning();
    return result[0];
  }

  async updateDataObjectRelationship(
    id: number,
    relationship: Partial<InsertDataObjectRelationship>
  ): Promise<DataObjectRelationship> {
    const result = await db
      .update(dataObjectRelationships)
      .set(relationship)
      .where(eq(dataObjectRelationships.id, id))
      .returning();
    return result[0];
  }

  async deleteDataObjectRelationship(id: number): Promise<void> {
    await db.delete(dataObjectRelationships).where(eq(dataObjectRelationships.id, id));
  }

  async deleteDataObjectRelationshipsByObject(objectId: number): Promise<void> {
    await db
      .delete(dataObjectRelationships)
      .where(
        or(
          eq(dataObjectRelationships.sourceDataObjectId, objectId),
          eq(dataObjectRelationships.targetDataObjectId, objectId)
        )
      );
  }

  // Data Model Object Relationships
  async getDataModelObjectRelationships(): Promise<DataModelObjectRelationship[]> {
    return await db.select().from(dataModelObjectRelationships);
  }

  async getDataModelObjectRelationship(id: number): Promise<DataModelObjectRelationship | undefined> {
    const result = await db
      .select()
      .from(dataModelObjectRelationships)
      .where(eq(dataModelObjectRelationships.id, id));
    return result[0];
  }

  async getDataModelObjectRelationshipsByModel(modelId: number): Promise<DataModelObjectRelationship[]> {
    return await db
      .select()
      .from(dataModelObjectRelationships)
      .where(eq(dataModelObjectRelationships.modelId, modelId));
  }

  async createDataModelObjectRelationship(
    relationship: InsertDataModelObjectRelationship
  ): Promise<DataModelObjectRelationship> {
    const result = await db.insert(dataModelObjectRelationships).values(relationship).returning();
    return result[0];
  }

  async updateDataModelObjectRelationship(
    id: number,
    relationship: Partial<InsertDataModelObjectRelationship>
  ): Promise<DataModelObjectRelationship> {
    const result = await db
      .update(dataModelObjectRelationships)
      .set(relationship)
      .where(eq(dataModelObjectRelationships.id, id))
      .returning();
    return result[0];
  }

  async deleteDataModelObjectRelationship(id: number): Promise<void> {
    await db.delete(dataModelObjectRelationships).where(eq(dataModelObjectRelationships.id, id));
  }

  // Systems
  async getSystems(): Promise<System[]> {
    return await db.select().from(systems);
  }

  async getSystem(id: number): Promise<System | undefined> {
    const result = await db.select().from(systems).where(eq(systems.id, id));
    return result[0];
  }

  async createSystem(system: InsertSystem): Promise<System> {
    const result = await db.insert(systems).values(system).returning();
    return result[0];
  }

  async updateSystem(id: number, system: Partial<InsertSystem>): Promise<System> {
    const result = await db.update(systems).set(system).where(eq(systems.id, id)).returning();
    return result[0];
  }

  async deleteSystem(id: number): Promise<void> {
    await db.delete(systems).where(eq(systems.id, id));
  }

  // Configurations
  async getConfigurations(): Promise<Configuration[]> {
    return await db.select().from(configurations);
  }

  async getConfigurationsByCategory(category: string): Promise<Configuration[]> {
    return await db.select().from(configurations).where(eq(configurations.category, category));
  }

  async getConfiguration(category: string, key: string): Promise<Configuration | undefined> {
    const result = await db.select().from(configurations).where(
      and(eq(configurations.category, category), eq(configurations.key, key))
    );
    return result[0];
  }

  async getConfigurationByCategoryAndKey(category: string, key: string): Promise<Configuration | undefined> {
    return this.getConfiguration(category, key);
  }

  async createConfiguration(config: InsertConfiguration): Promise<Configuration> {
    const result = await db.insert(configurations).values(config).returning();
    return result[0];
  }

  async updateConfiguration(id: number, config: Partial<InsertConfiguration>): Promise<Configuration> {
    const result = await db.update(configurations).set(config).where(eq(configurations.id, id)).returning();
    return result[0];
  }

  async deleteConfiguration(id: number): Promise<void> {
    await db.delete(configurations).where(eq(configurations.id, id));
  }

  // Business Capabilities
  async getBusinessCapabilities(): Promise<BusinessCapability[]> {
    return await db.select().from(businessCapabilities);
  }

  async getBusinessCapability(id: number): Promise<BusinessCapability | undefined> {
    const result = await db.select().from(businessCapabilities).where(eq(businessCapabilities.id, id));
    return result[0];
  }

  async getBusinessCapabilityTree(): Promise<any> {
    const capabilities = await db.select().from(businessCapabilities);
    
    // Build hierarchical tree structure
    const buildTree = (parentId: number | null = null): any[] => {
      return capabilities
        .filter((cap: BusinessCapability) => cap.parentId === parentId)
        .sort((a: BusinessCapability, b: BusinessCapability) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((cap: BusinessCapability) => ({
          ...cap,
          children: buildTree(cap.id)
        }));
    };
    
    return buildTree();
  }

  async getCapabilityMappings(capabilityId: number): Promise<any> {
    const [domainMappings, datAreaMappings, systemMappings] = await Promise.all([
      db.select({
        id: capabilityDataDomainMappings.id,
        mappingType: capabilityDataDomainMappings.mappingType,
        importance: capabilityDataDomainMappings.importance,
        description: capabilityDataDomainMappings.description,
        domain: {
          id: dataDomains.id,
          name: dataDomains.name,
          description: dataDomains.description,
          colorCode: dataDomains.colorCode,
        }
      })
      .from(capabilityDataDomainMappings)
      .leftJoin(dataDomains, eq(capabilityDataDomainMappings.domainId, dataDomains.id))
      .where(eq(capabilityDataDomainMappings.capabilityId, capabilityId)),

      db.select({
        id: capabilityDataAreaMappings.id,
        mappingType: capabilityDataAreaMappings.mappingType,
        importance: capabilityDataAreaMappings.importance,
        description: capabilityDataAreaMappings.description,
        dataArea: {
          id: dataAreas.id,
          name: dataAreas.name,
          description: dataAreas.description,
          colorCode: dataAreas.colorCode,
        }
      })
      .from(capabilityDataAreaMappings)
      .leftJoin(dataAreas, eq(capabilityDataAreaMappings.dataAreaId, dataAreas.id))
      .where(eq(capabilityDataAreaMappings.capabilityId, capabilityId)),

      db.select({
        id: capabilitySystemMappings.id,
        mappingType: capabilitySystemMappings.mappingType,
        systemRole: capabilitySystemMappings.systemRole,
        coverage: capabilitySystemMappings.coverage,
        description: capabilitySystemMappings.description,
        system: {
          id: systems.id,
          name: systems.name,
          category: systems.category,
          type: systems.type,
          description: systems.description,
          colorCode: systems.colorCode,
        }
      })
      .from(capabilitySystemMappings)
      .leftJoin(systems, eq(capabilitySystemMappings.systemId, systems.id))
      .where(eq(capabilitySystemMappings.capabilityId, capabilityId))
    ]);

    return {
      domains: domainMappings,
      dataAreas: datAreaMappings,
      systems: systemMappings,
    };
  }

  async getAllCapabilitySystemMappings(): Promise<CapabilitySystemMappingDetail[]> {
    const mappings = await db
      .select({
        capabilityId: capabilitySystemMappings.capabilityId,
        systemId: capabilitySystemMappings.systemId,
        mappingType: capabilitySystemMappings.mappingType,
        systemRole: capabilitySystemMappings.systemRole,
        coverage: capabilitySystemMappings.coverage,
        systemName: systems.name,
        systemCategory: systems.category,
        systemType: systems.type,
        systemColorCode: systems.colorCode,
      })
      .from(capabilitySystemMappings)
      .innerJoin(systems, eq(capabilitySystemMappings.systemId, systems.id));

    return mappings;
  }

  async createBusinessCapability(capability: InsertBusinessCapability): Promise<BusinessCapability> {
    const result = await db.insert(businessCapabilities).values(capability).returning();
    return result[0];
  }

  async updateBusinessCapability(id: number, capability: Partial<InsertBusinessCapability>): Promise<BusinessCapability> {
    const result = await db.update(businessCapabilities).set(capability).where(eq(businessCapabilities.id, id)).returning();
    return result[0];
  }

  async deleteBusinessCapability(id: number): Promise<void> {
    await db.delete(businessCapabilities).where(eq(businessCapabilities.id, id));
  }

  // Capability Mappings
  async createCapabilityDomainMapping(mapping: InsertCapabilityDataDomainMapping): Promise<CapabilityDataDomainMapping> {
    const result = await db.insert(capabilityDataDomainMappings).values(mapping).returning();
    return result[0];
  }

  async createCapabilityDataAreaMapping(mapping: InsertCapabilityDataAreaMapping): Promise<CapabilityDataAreaMapping> {
    const result = await db.insert(capabilityDataAreaMappings).values(mapping).returning();
    return result[0];
  }

  async createCapabilitySystemMapping(mapping: InsertCapabilitySystemMapping): Promise<CapabilitySystemMapping> {
    const result = await db.insert(capabilitySystemMappings).values(mapping).returning();
    return result[0];
  }

  async deleteCapabilityDomainMapping(id: number): Promise<void> {
    await db.delete(capabilityDataDomainMappings).where(eq(capabilityDataDomainMappings.id, id));
  }

  async deleteCapabilityDataAreaMapping(id: number): Promise<void> {
    await db.delete(capabilityDataAreaMappings).where(eq(capabilityDataAreaMappings.id, id));
  }

  async deleteCapabilitySystemMapping(id: number): Promise<void> {
    await db.delete(capabilitySystemMappings).where(eq(capabilitySystemMappings.id, id));
  }
}

export const storage = new Storage();
