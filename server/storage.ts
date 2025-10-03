import {
  dataModels,
  dataDomains,
  dataAreas,
  dataObjects,
  dataModelObjects,
  attributes,
  dataModelAttributes,
  dataModelProperties,
  relationships,
  systems,
  configurations,
  businessCapabilities,
  capabilityDataDomainMappings,
  capabilityDataAreaMappings,
  capabilitySystemMappings,
  type DataModel,
  type InsertDataModel,
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
  type Relationship,
  type InsertRelationship,
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
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Data Models
  getDataModels(): Promise<DataModel[]>;
  getDataModel(id: number): Promise<DataModel | undefined>;
  createDataModel(model: InsertDataModel): Promise<DataModel>;
  updateDataModel(id: number, model: Partial<InsertDataModel>): Promise<DataModel>;
  deleteDataModel(id: number): Promise<void>;

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
  getDataObjectsBySourceSystem(systemId: number): Promise<DataObject[]>;
  getDataObjectsByTargetSystem(systemId: number): Promise<DataObject[]>;
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

  // Relationships
  getRelationships(): Promise<Relationship[]>;
  getRelationship(id: number): Promise<Relationship | undefined>;
  getRelationshipsByModel(modelId: number): Promise<Relationship[]>;
  createRelationship(relationship: InsertRelationship): Promise<Relationship>;
  updateRelationship(id: number, relationship: Partial<InsertRelationship>): Promise<Relationship>;
  deleteRelationship(id: number): Promise<void>;

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
  createBusinessCapability(capability: InsertBusinessCapability): Promise<BusinessCapability>;
  updateBusinessCapability(id: number, capability: Partial<InsertBusinessCapability>): Promise<BusinessCapability>;
  deleteBusinessCapability(id: number): Promise<void>;
  
  // Capability Mappings
  createCapabilityDomainMapping(mapping: InsertCapabilityDataDomainMapping): Promise<CapabilityDataDomainMapping>;
  createCapabilityDataAreaMapping(mapping: InsertCapabilityDataAreaMapping): Promise<CapabilityDataAreaMapping>;
  createCapabilitySystemMapping(mapping: InsertCapabilitySystemMapping): Promise<CapabilitySystemMapping>;
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

  async getDataObjectsByModel(modelId: number): Promise<DataObject[]> {
    const result = await db
      .select({
        id: dataObjects.id,
        name: dataObjects.name,
        description: dataObjects.description,
        domainId: dataObjects.domainId,
        dataAreaId: dataObjects.dataAreaId,
        createdAt: dataObjects.createdAt,
        updatedAt: dataObjects.updatedAt
      })
      .from(dataObjects)
      .innerJoin(dataModelObjects, eq(dataObjects.id, dataModelObjects.objectId))
      .where(eq(dataModelObjects.modelId, modelId));
    return result;
  }

  async getDataObjectsBySourceSystem(systemId: number): Promise<DataObject[]> {
    return await db.select().from(dataObjects).where(eq(dataObjects.sourceSystemId, systemId));
  }

  async getDataObjectsByTargetSystem(systemId: number): Promise<DataObject[]> {
    return await db.select().from(dataObjects).where(eq(dataObjects.targetSystemId, systemId));
  }

  // Data Model Objects
  async getDataModelObjects(): Promise<DataModelObject[]> {
    return await db.select().from(dataModelObjects);
  }

  async getDataModelObjectsByModel(modelId: number): Promise<DataModelObject[]> {
    return await db.select().from(dataModelObjects).where(eq(dataModelObjects.modelId, modelId));
  }

  async getDataModelObject(id: number): Promise<DataModelObject | undefined> {
    const result = await db.select().from(dataModelObjects).where(eq(dataModelObjects.id, id));
    return result[0];
  }

  async createDataModelObject(object: InsertDataModelObject): Promise<DataModelObject> {
    const result = await db.insert(dataModelObjects).values(object).returning();
    return result[0];
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

  // Relationships
  async getRelationships(): Promise<Relationship[]> {
    return await db.select().from(relationships);
  }

  async getRelationship(id: number): Promise<Relationship | undefined> {
    const result = await db.select().from(relationships).where(eq(relationships.id, id));
    return result[0];
  }

  async getRelationshipsByModel(modelId: number): Promise<Relationship[]> {
    return await db.select().from(relationships).where(eq(relationships.modelId, modelId));
  }

  async createRelationship(relationship: InsertRelationship): Promise<Relationship> {
    const result = await db.insert(relationships).values(relationship).returning();
    return result[0];
  }

  async updateRelationship(id: number, relationship: Partial<InsertRelationship>): Promise<Relationship> {
    const result = await db.update(relationships).set(relationship).where(eq(relationships.id, id)).returning();
    return result[0];
  }

  async deleteRelationship(id: number): Promise<void> {
    await db.delete(relationships).where(eq(relationships.id, id));
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
}

export const storage = new Storage();
