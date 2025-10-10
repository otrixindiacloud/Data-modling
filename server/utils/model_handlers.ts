import type { Storage } from "../storage";
import type { DataModelLayer, InsertDataModelLayer } from "@shared/schema";
import { getTargetSystemTemplate } from "../services/targetSystemTemplates";
import { parseOptionalNumber, resolveDomainAndArea, getSystemIdByName } from "./route_helpers";

export interface CreateModelWithLayersInput {
  name: string;
  targetSystem?: string;
  targetSystemId?: number | string;
  domainId?: number | string;
  dataAreaId?: number | string;
}

export interface CreateModelWithLayersResult {
  flow: DataModelLayer;
  conceptual: DataModelLayer;
  logical: DataModelLayer;
  physical: DataModelLayer;
  templatesAdded: number;
  message: string;
}

/**
 * Create a model with all 4 layers (Flow, Conceptual, Logical, Physical)
 * and optionally populate with template objects
 */
export async function createModelWithLayers(
  input: CreateModelWithLayersInput,
  storage: Storage
): Promise<CreateModelWithLayersResult> {
  const { name, targetSystem, targetSystemId, domainId, dataAreaId } = input;

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

  // Get template and populate objects if available
  let templatesAdded = 0;
  const template = getTargetSystemTemplate(selectedTargetSystem);
  
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

  return {
    flow: flowModel,
    conceptual: conceptualModel,
    logical: logicalModel,
    physical: physicalModel,
    templatesAdded,
    message: `Model created with all 4 layers${
      template ? ` and ${templatesAdded} template objects from ${selectedTargetSystem}` : ""
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
      modelId: conceptualModel.id,
      domainId: domainId,
      dataAreaId: areaId,
      sourceSystemId: await getSystemIdByName(storage, templateObj.sourceSystem),
      targetSystemId: resolvedTargetSystemId,
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
      modelId: logicalModel.id,
      domainId: domainId,
      dataAreaId: areaId,
      sourceSystemId: await getSystemIdByName(storage, templateObj.sourceSystem),
      targetSystemId: resolvedTargetSystemId,
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
      modelId: physicalModel.id,
      domainId: domainId,
      dataAreaId: areaId,
      sourceSystemId: await getSystemIdByName(storage, templateObj.sourceSystem),
      targetSystemId: resolvedTargetSystemId,
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
