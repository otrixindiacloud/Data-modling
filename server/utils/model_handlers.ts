import type { Storage } from "../storage";
import type { 
  DataModelLayer, 
  InsertDataModelLayer, 
  InsertDataModelObject,
  InsertDataModelObjectAttribute,
  InsertDataModelObjectRelationship,
  DataObject,
  Attribute,
  DataObjectRelationship
} from "@shared/schema";
import { getTargetSystemTemplate } from "../services/targetSystemTemplates";
import { parseOptionalNumber, resolveDomainAndArea, getSystemIdByName } from "./route_helpers";

export interface CreateModelWithLayersInput {
  name: string;
  targetSystem?: string;
  targetSystemId?: number | string;
  domainId?: number | string;
  dataAreaId?: number | string;
  selectedObjectIds?: number[]; // Array of data object IDs to include
}

export interface CreateModelWithLayersResult {
  flow: DataModelLayer;
  conceptual: DataModelLayer;
  logical: DataModelLayer;
  physical: DataModelLayer;
  templatesAdded: number;
  objectsAdded: number;
  message: string;
}

/**
 * Create a model with all 4 layers (Flow, Conceptual, Logical, Physical)
 * and optionally populate with template objects or selected data objects
 */
export async function createModelWithLayers(
  input: CreateModelWithLayersInput,
  storage: Storage
): Promise<CreateModelWithLayersResult> {
  const { name, targetSystem, targetSystemId, domainId, dataAreaId, selectedObjectIds } = input;

  if (!name) {
    throw new Error("Model name is required");
  }

  // Resolve target system
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

  // Resolve domain and data area
  const { domainId: resolvedDomainId, dataAreaId: resolvedDataAreaId } =
    await resolveDomainAndArea(storage, domainId, dataAreaId);

  // Create conceptual model first (parent model)
  const conceptualModel = await storage.createDataModelLayer({
    name,
    layer: "conceptual",
    targetSystemId: resolvedTargetSystemId,
    domainId: resolvedDomainId,
    dataAreaId: resolvedDataAreaId,
  });

  const flowModel = await storage.createDataModelLayer({
    name,
    layer: "flow",
    parentModelId: conceptualModel.id,
    dataModelId: conceptualModel.dataModelId,
    targetSystemId: resolvedTargetSystemId,
    domainId: resolvedDomainId,
    dataAreaId: resolvedDataAreaId,
  });

  // Create logical model linked to conceptual
  const logicalModel = await storage.createDataModelLayer({
    name,
    layer: "logical",
    dataModelId: conceptualModel.dataModelId,
    parentModelId: conceptualModel.id,
    targetSystemId: resolvedTargetSystemId,
    domainId: resolvedDomainId,
    dataAreaId: resolvedDataAreaId,
  });

  // Create physical model linked to conceptual
  const physicalModel = await storage.createDataModelLayer({
    name,
    layer: "physical",
    dataModelId: conceptualModel.dataModelId,
    parentModelId: conceptualModel.id,
    targetSystemId: resolvedTargetSystemId,
    domainId: resolvedDomainId,
    dataAreaId: resolvedDataAreaId,
  });

  let templatesAdded = 0;
  let objectsAdded = 0;
  let template = null;

  // Populate with selected data objects if provided
  if (selectedObjectIds && selectedObjectIds.length > 0) {
    console.log(`[MODEL_HANDLERS] Populating model with ${selectedObjectIds.length} selected data objects...`);
    console.log('[MODEL_HANDLERS] Selected object IDs:', selectedObjectIds);
    
    objectsAdded = await populateModelsWithSelectedObjects(
      {
        conceptualModel,
        logicalModel,
        physicalModel,
      },
      selectedObjectIds,
      storage
    );
    
    console.log(`[MODEL_HANDLERS] Successfully added ${objectsAdded} objects with their attributes and relationships to all layers`);
  } else {
    console.log('[MODEL_HANDLERS] No selectedObjectIds provided, using template-based population');
    // Get template and populate objects if available (original behavior)
    template = getTargetSystemTemplate(selectedTargetSystem);
    
    if (template) {
      console.log(`Adding template objects for ${selectedTargetSystem}...`);
      
      templatesAdded = await populateModelsFromTemplate(
        {
          conceptualModel,
          logicalModel,
          physicalModel,
        },
        template,
        selectedTargetSystem,
        resolvedTargetSystemId,
        storage
      );
      
      console.log(`Successfully added ${templatesAdded} template objects to all layers`);
    }
  }

  return {
    flow: flowModel,
    conceptual: conceptualModel,
    logical: logicalModel,
    physical: physicalModel,
    templatesAdded,
    objectsAdded,
    message: `Model created with all 4 layers${
      objectsAdded > 0 
        ? ` and ${objectsAdded} selected objects with their attributes and relationships` 
        : template 
          ? ` and ${templatesAdded} template objects from ${selectedTargetSystem}` 
          : ""
    }`,
  };
}

/**
 * Populate models with template objects and attributes
 */
async function populateModelsFromTemplate(
  models: {
    conceptualModel: DataModelLayer;
    logicalModel: DataModelLayer;
    physicalModel: DataModelLayer;
  },
  template: any,
  selectedTargetSystem: string,
  resolvedTargetSystemId: number | null,
  storage: Storage
): Promise<number> {
  const { conceptualModel, logicalModel, physicalModel } = models;
  
  // Create domains and data areas from template
  const createdDomains = new Map<string, number>();
  const createdAreas = new Map<string, number>();

  for (const domainName of template.defaultDomains) {
    // Check if domain already exists
    let domain = await storage.getDataDomainByName(domainName);
    if (!domain) {
      domain = await storage.createDataDomain({
        name: domainName,
        description: `${domainName} domain for ${selectedTargetSystem}`,
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
            description: `${areaName} area in ${domainName} domain`,
          });
        }
        createdAreas.set(`${domainName}:${areaName}`, area.id);
      } catch (error) {
        console.log(`Error creating area ${areaName}:`, error);
      }
    }
  }

  // Create template objects and attributes in all three layers
  let objectsCreated = 0;
  
  for (const templateObj of template.objects) {
    const domainId = createdDomains.get(templateObj.domainName);
    const areaId = createdAreas.get(
      `${templateObj.domainName}:${templateObj.dataAreaName}`
    );

    if (!domainId) {
      console.log(
        `Domain ${templateObj.domainName} not found, skipping object ${templateObj.name}`
      );
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
      domainId: domainId,
      dataAreaId: areaId,
      systemId: await getSystemIdByName(storage, templateObj.sourceSystem),
      isNew: false,
      position: basePosition,
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
        layer: "conceptual",
      } as Record<string, any>,
    });

    // Create object in logical layer
    const logicalObject = await storage.createDataObject({
      name: templateObj.name,
      domainId: domainId,
      dataAreaId: areaId,
      systemId: await getSystemIdByName(storage, templateObj.sourceSystem),
      isNew: false,
      position: basePosition,
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
        layer: "logical",
      } as Record<string, any>,
    });

    // Create object in physical layer
    const physicalObject = await storage.createDataObject({
      name: templateObj.name,
      domainId: domainId,
      dataAreaId: areaId,
      systemId: await getSystemIdByName(storage, templateObj.sourceSystem),
      isNew: false,
      position: basePosition,
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
        layer: "physical",
      } as Record<string, any>,
    });

    // Create attributes for logical and physical layers
    // (conceptual layer doesn't show attributes)
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
        orderIndex: templateAttr.orderIndex,
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
        orderIndex: templateAttr.orderIndex,
      });
    }

    objectsCreated++;
  }

  return objectsCreated;
}

/**
 * Populate models with selected data objects, their attributes, and relationships
 */
async function populateModelsWithSelectedObjects(
  models: {
    conceptualModel: DataModelLayer;
    logicalModel: DataModelLayer;
    physicalModel: DataModelLayer;
  },
  selectedObjectIds: number[],
  storage: Storage
): Promise<number> {
  const { conceptualModel, logicalModel, physicalModel } = models;
  
  console.log('[POPULATE_OBJECTS] Starting optimized batch population...');
  console.log('[POPULATE_OBJECTS] Models:', {
    conceptual: conceptualModel.id,
    logical: logicalModel.id,
    physical: physicalModel.id
  });
  console.log('[POPULATE_OBJECTS] Object IDs to populate:', selectedObjectIds);
  
  let objectsAdded = 0;
  
  // Batch fetch all data objects at once
  console.log('[POPULATE_OBJECTS] Batch fetching all data objects...');
  const dataObjectsPromises = selectedObjectIds.map(id => storage.getDataObject(id));
  const dataObjectsResults = await Promise.all(dataObjectsPromises);
  const dataObjects = dataObjectsResults.filter((obj): obj is NonNullable<typeof obj> => obj !== null && obj !== undefined);
  
  if (dataObjects.length === 0) {
    console.warn('[POPULATE_OBJECTS] No valid data objects found');
    return 0;
  }
  
  console.log(`[POPULATE_OBJECTS] Found ${dataObjects.length} valid data objects`);
  
  // Batch fetch all attributes for all objects at once
  console.log('[POPULATE_OBJECTS] Batch fetching attributes for all objects...');
  const attributesPromises = dataObjects.map(obj => storage.getAttributesByObject(obj.id));
  const attributesResults = await Promise.all(attributesPromises);
  const attributesByObjectId = new Map<number, typeof attributesResults[0]>();
  dataObjects.forEach((obj, idx) => {
    attributesByObjectId.set(obj.id, attributesResults[idx]);
  });
  
  // Prepare batch inserts for model objects
  const conceptualModelObjects: InsertDataModelObject[] = [];
  const logicalModelObjects: InsertDataModelObject[] = [];
  const physicalModelObjects: InsertDataModelObject[] = [];
  
  for (const dataObject of dataObjects) {
    const baseModelObject = {
      objectId: dataObject.id,
      name: dataObject.name,
      description: dataObject.description,
      objectType: dataObject.objectType,
      domainId: dataObject.domainId,
      dataAreaId: dataObject.dataAreaId,
      targetSystemId: null as number | null,
      position: null,
      metadata: dataObject.metadata || {},
      isVisible: true,
      layerSpecificConfig: {},
    };
    
    conceptualModelObjects.push({
      ...baseModelObject,
      modelId: conceptualModel.id,
      targetSystemId: conceptualModel.targetSystemId,
    });
    
    logicalModelObjects.push({
      ...baseModelObject,
      modelId: logicalModel.id,
      targetSystemId: logicalModel.targetSystemId,
    });
    
    physicalModelObjects.push({
      ...baseModelObject,
      modelId: physicalModel.id,
      targetSystemId: physicalModel.targetSystemId,
    });
  }
  
  // Batch create all model objects (3 parallel batches, one per layer)
  console.log('[POPULATE_OBJECTS] Batch creating model objects across all layers...');
  const [createdConceptual, createdLogical, createdPhysical] = await Promise.all([
    storage.createDataModelObjectsBatch(conceptualModelObjects),
    storage.createDataModelObjectsBatch(logicalModelObjects),
    storage.createDataModelObjectsBatch(physicalModelObjects),
  ]);
  
  console.log(`[POPULATE_OBJECTS] Created ${createdConceptual.length} conceptual, ${createdLogical.length} logical, ${createdPhysical.length} physical objects`);
  
  // Build maps for quick lookup
  const conceptualObjectMap = new Map<number, number>(); // dataObjectId -> modelObjectId
  const logicalObjectMap = new Map<number, number>();
  const physicalObjectMap = new Map<number, number>();
  
  createdConceptual.forEach((obj, idx) => {
    conceptualObjectMap.set(dataObjects[idx].id, obj.id);
  });
  createdLogical.forEach((obj, idx) => {
    logicalObjectMap.set(dataObjects[idx].id, obj.id);
  });
  createdPhysical.forEach((obj, idx) => {
    physicalObjectMap.set(dataObjects[idx].id, obj.id);
  });
  
  // Prepare batch inserts for attributes
  const conceptualAttributes: InsertDataModelObjectAttribute[] = [];
  const logicalAttributes: InsertDataModelObjectAttribute[] = [];
  const physicalAttributes: InsertDataModelObjectAttribute[] = [];
  
  for (let i = 0; i < dataObjects.length; i++) {
    const dataObject = dataObjects[i];
    const attributes = attributesByObjectId.get(dataObject.id) || [];
    const conceptualModelObjectId = createdConceptual[i].id;
    const logicalModelObjectId = createdLogical[i].id;
    const physicalModelObjectId = createdPhysical[i].id;
    
    for (const attr of attributes) {
      const baseAttr = {
        attributeId: attr.id,
        name: attr.name,
        description: attr.description,
        conceptualType: attr.conceptualType,
        logicalType: attr.logicalType,
        physicalType: attr.physicalType,
        dataType: attr.dataType,
        length: attr.length,
        precision: attr.precision,
        scale: attr.scale,
        nullable: attr.nullable,
        isPrimaryKey: attr.isPrimaryKey,
        isForeignKey: attr.isForeignKey,
        orderIndex: attr.orderIndex,
      };
      
      conceptualAttributes.push({
        ...baseAttr,
        modelObjectId: conceptualModelObjectId,
        modelId: conceptualModel.dataModelId,
      });
      
      logicalAttributes.push({
        ...baseAttr,
        modelObjectId: logicalModelObjectId,
        modelId: logicalModel.dataModelId,
      });
      
      physicalAttributes.push({
        ...baseAttr,
        modelObjectId: physicalModelObjectId,
        modelId: physicalModel.dataModelId,
      });
    }
  }
  
  // Batch create all attributes (3 parallel batches, one per layer)
  console.log('[POPULATE_OBJECTS] Batch creating attributes across all layers...');
  await Promise.all([
    storage.createDataModelObjectAttributesBatch(conceptualAttributes),
    storage.createDataModelObjectAttributesBatch(logicalAttributes),
    storage.createDataModelObjectAttributesBatch(physicalAttributes),
  ]);
  
  console.log(`[POPULATE_OBJECTS] Created ${conceptualAttributes.length} attributes per layer`);
  
  objectsAdded = dataObjects.length;
  
  // Batch fetch all relationships at once
  console.log('[POPULATE_OBJECTS] Batch fetching relationships for all objects...');
  const relationshipsPromises = selectedObjectIds.map(id => 
    storage.getDataObjectRelationshipsByObject(id)
  );
  const relationshipsResults = await Promise.all(relationshipsPromises);
  const allRelationships = relationshipsResults.flat();
  
  // Filter relationships to only those between selected objects
  const validRelationships = allRelationships.filter(rel =>
    selectedObjectIds.includes(rel.sourceDataObjectId) &&
    selectedObjectIds.includes(rel.targetDataObjectId)
  );
  
  // Remove duplicates (since we fetched by source object, we might have duplicates)
  const uniqueRelationships = Array.from(
    new Map(validRelationships.map(rel => [
      `${rel.sourceDataObjectId}-${rel.targetDataObjectId}-${rel.type}`,
      rel
    ])).values()
  );
  
  console.log(`[POPULATE_OBJECTS] Found ${uniqueRelationships.length} valid relationships to create`);
  
  // Prepare batch inserts for relationships
  const conceptualRelationships: InsertDataModelObjectRelationship[] = [];
  const logicalRelationships: InsertDataModelObjectRelationship[] = [];
  const physicalRelationships: InsertDataModelObjectRelationship[] = [];
  
  for (const rel of uniqueRelationships) {
    const conceptualSourceId = conceptualObjectMap.get(rel.sourceDataObjectId);
    const conceptualTargetId = conceptualObjectMap.get(rel.targetDataObjectId);
    const logicalSourceId = logicalObjectMap.get(rel.sourceDataObjectId);
    const logicalTargetId = logicalObjectMap.get(rel.targetDataObjectId);
    const physicalSourceId = physicalObjectMap.get(rel.sourceDataObjectId);
    const physicalTargetId = physicalObjectMap.get(rel.targetDataObjectId);
    
    const baseRelationship = {
      type: rel.type,
      relationshipLevel: rel.relationshipLevel,
      sourceAttributeId: rel.sourceAttributeId,
      targetAttributeId: rel.targetAttributeId,
      name: rel.name,
      description: rel.description,
    };
    
    if (conceptualSourceId && conceptualTargetId) {
      conceptualRelationships.push({
        ...baseRelationship,
        sourceModelObjectId: conceptualSourceId,
        targetModelObjectId: conceptualTargetId,
        modelId: conceptualModel.dataModelId,
        layer: 'conceptual',
      });
    }
    
    if (logicalSourceId && logicalTargetId) {
      logicalRelationships.push({
        ...baseRelationship,
        sourceModelObjectId: logicalSourceId,
        targetModelObjectId: logicalTargetId,
        modelId: logicalModel.dataModelId,
        layer: 'logical',
      });
    }
    
    if (physicalSourceId && physicalTargetId) {
      physicalRelationships.push({
        ...baseRelationship,
        sourceModelObjectId: physicalSourceId,
        targetModelObjectId: physicalTargetId,
        modelId: physicalModel.dataModelId,
        layer: 'physical',
      });
    }
  }
  
  // Batch create all relationships (3 parallel batches, one per layer)
  console.log('[POPULATE_OBJECTS] Batch creating relationships across all layers...');
  await Promise.all([
    storage.createDataModelObjectRelationshipsBatch(conceptualRelationships),
    storage.createDataModelObjectRelationshipsBatch(logicalRelationships),
    storage.createDataModelObjectRelationshipsBatch(physicalRelationships),
  ]);
  
  console.log(`[POPULATE_OBJECTS] Created ${conceptualRelationships.length} relationships per layer`);
  console.log('[POPULATE_OBJECTS] Batch population completed successfully!');
  
  return objectsAdded;
}
