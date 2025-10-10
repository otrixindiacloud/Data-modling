import type { Storage } from "../storage";
import type { System, DataObject, Attribute } from "@shared/schema";
import { z } from "zod";
import {
  extractPreferredDomainId,
  extractPreferredDataAreaIds,
  retrieveSystemMetadata,
} from "./system_utils";
import { buildRelationshipKey } from "./relationship_utils";
import { generateHeuristicForeignKeys } from "../services/relationshipHeuristics";
import { systemSyncRequestSchema, type SystemObjectDirection } from "./validation_schemas";

export interface SyncSystemObjectsInput {
  systemId: number;
  modelId: number;
  direction?: SystemObjectDirection;
  includeAttributes?: boolean;
  domainId?: number | null;
  dataAreaId?: number | null;
  metadataOnly?: boolean;
  connection?: {
    configuration?: Record<string, unknown>;
    connectionString?: string | null;
  };
}

export interface SyncSystemObjectsResult {
  metadataCount: number;
  createdCount: number;
  updatedCount: number;
  relationshipsCreated: number;
  heuristicRelationshipsCreated: number;
  created: DataObject[];
  updated: DataObject[];
  attributes: Record<string, number>;
  metadata?: any[];
}

/**
 * Sync objects from an external system into a model
 * This handles:
 * - Retrieving metadata from the system
 * - Creating/updating data objects
 * - Creating/updating attributes
 * - Creating relationships based on foreign keys
 * - Heuristic relationship detection
 */
export async function syncSystemObjects(
  input: SyncSystemObjectsInput,
  storage: Storage
): Promise<SyncSystemObjectsResult> {
  const {
    systemId,
    modelId,
    direction = "source",
    includeAttributes = true,
    domainId,
    dataAreaId,
    metadataOnly,
    connection,
  } = input;

  // Validate system exists
  const system = await storage.getSystem(systemId);
  if (!system) {
    throw new Error("System not found");
  }

  // Validate direction compatibility
  if (direction === "source" && system.canBeSource === false) {
    throw new Error("System cannot act as a source");
  }
  if (direction === "target" && system.canBeTarget === false) {
    throw new Error("System cannot act as a target");
  }

  // Validate model exists
  const model = await storage.getDataModel(modelId);
  if (!model) {
    throw new Error("Model not found");
  }

  // Resolve domain and data area
  let effectiveDomainId = extractPreferredDomainId(system, domainId ?? null);
  let effectiveDataAreaId = dataAreaId ?? null;

  if (effectiveDataAreaId === null) {
    const preferredAreas = extractPreferredDataAreaIds(system);
    if (preferredAreas.length > 0) {
      effectiveDataAreaId = preferredAreas[0];
    }
  }

  // Validate data area and domain compatibility
  if (effectiveDataAreaId !== null) {
    const area = await storage.getDataArea(effectiveDataAreaId);
    if (!area) {
      throw new Error("Provided data area does not exist");
    }
    if (effectiveDomainId !== null && area.domainId !== effectiveDomainId) {
      throw new Error("Data area does not belong to the specified domain");
    }
    if (effectiveDomainId === null) {
      effectiveDomainId = area.domainId;
    }
  }

  if (effectiveDomainId !== null) {
    const domain = await storage.getDataDomain(effectiveDomainId);
    if (!domain) {
      throw new Error("Provided domain does not exist");
    }
  }

  // Retrieve metadata from the system
  const metadata = await retrieveSystemMetadata(system, {
    configurationOverride: connection?.configuration,
    connectionStringOverride: connection?.connectionString ?? null,
  });

  // If only metadata requested, return early
  if (metadataOnly) {
    return {
      metadataCount: metadata.length,
      createdCount: 0,
      updatedCount: 0,
      relationshipsCreated: 0,
      heuristicRelationshipsCreated: 0,
      created: [],
      updated: [],
      attributes: {},
      metadata,
    };
  }

  // Build object registry and identify existing objects
  const existingObjects = await storage.getDataObjectsByModel(modelId);
  const relevantExisting = new Map<string, DataObject>();
  const objectRegistry = new Map<string, DataObject>();

  existingObjects.forEach((object) => {
    const key = object.name.toLowerCase();
    objectRegistry.set(key, object);
    if (object.systemId === systemId) {
      relevantExisting.set(key, object);
    }
  });

  // Attribute cache for performance
  const attributeCache = new Map<number, Attribute[]>();
  const loadAttributesForObject = async (objectId: number): Promise<Attribute[]> => {
    if (!attributeCache.has(objectId)) {
      const attrs = await storage.getAttributesByObject(objectId);
      attributeCache.set(objectId, attrs);
    }
    return attributeCache.get(objectId) ?? [];
  };

  // Process tables/objects from metadata
  const created: DataObject[] = [];
  const updated: DataObject[] = [];
  const attributeSummary: Record<string, number> = {};

  for (const table of metadata) {
    const tableKey = table.name.toLowerCase();
    const existingObject = relevantExisting.get(tableKey);
    const priorObject = objectRegistry.get(tableKey);

    const metadataPayload: Record<string, any> = {
      ...(priorObject?.metadata ?? {}),
      syncedFromSystemId: systemId,
      systemDirection: direction,
      rawMetadata: table,
      syncedAt: new Date().toISOString(),
    };

    if (existingObject) {
      // Update existing object
      const updatedObject = await storage.updateDataObject(existingObject.id, {
        metadata: metadataPayload,
        domainId: effectiveDomainId ?? existingObject.domainId ?? null,
        dataAreaId: effectiveDataAreaId ?? existingObject.dataAreaId ?? null,
        systemId,
        isNew: false,
      });
      updated.push(updatedObject);
      objectRegistry.set(tableKey, updatedObject);

      // Update attributes if requested
      if (includeAttributes && Array.isArray(table.columns)) {
        attributeCache.delete(updatedObject.id);
        await storage.deleteAttributesByObject(updatedObject.id);

        const attributesForObject = await createAttributesFromColumns(
          storage,
          table.columns,
          updatedObject.id
        );
        attributeCache.set(updatedObject.id, attributesForObject);
        attributeSummary[updatedObject.id.toString()] = attributesForObject.length;
      }
    } else {
      // Create new object
      const createdObject = await storage.createDataObject({
        name: table.name,
        domainId: effectiveDomainId ?? null,
        dataAreaId: effectiveDataAreaId ?? null,
        systemId,
        metadata: metadataPayload,
        objectType: Array.isArray(table.columns) && table.columns.length ? "table" : "entity",
        isNew: true,
      });
      created.push(createdObject);
      objectRegistry.set(tableKey, createdObject);

      // Create attributes if requested
      if (includeAttributes && Array.isArray(table.columns)) {
        const attributesForObject = await createAttributesFromColumns(
          storage,
          table.columns,
          createdObject.id
        );
        attributeCache.set(createdObject.id, attributesForObject);
        attributeSummary[createdObject.id.toString()] = attributesForObject.length;
      }
    }
  }

  // Create relationships based on foreign keys
  const { relationshipsCreated, heuristicRelationshipsCreated } =
    await createRelationshipsFromMetadata(
      storage,
      metadata,
      objectRegistry,
      loadAttributesForObject
    );

  return {
    metadataCount: metadata.length,
    createdCount: created.length,
    updatedCount: updated.length,
    relationshipsCreated,
    heuristicRelationshipsCreated,
    created,
    updated,
    attributes: attributeSummary,
  };
}

/**
 * Create attributes from column metadata
 */
async function createAttributesFromColumns(
  storage: Storage,
  columns: any[],
  objectId: number
): Promise<Attribute[]> {
  const attributes: Attribute[] = [];

  for (let index = 0; index < columns.length; index++) {
    const column = columns[index];
    const attribute = await storage.createAttribute({
      name: column.name,
      objectId: objectId,
      conceptualType: column.type,
      logicalType: column.type,
      physicalType: column.type,
      nullable: column.nullable ?? true,
      isPrimaryKey: column.isPrimaryKey ?? false,
      dataType: column.type,
      orderIndex: index,
    });
    attributes.push(attribute);
  }

  return attributes;
}

/**
 * Create relationships from foreign key metadata
 */
async function createRelationshipsFromMetadata(
  storage: Storage,
  metadata: any[],
  objectRegistry: Map<string, DataObject>,
  loadAttributesForObject: (objectId: number) => Promise<Attribute[]>
): Promise<{ relationshipsCreated: number; heuristicRelationshipsCreated: number }> {
  // Build existing relationship registry
  const existingRelationships = await storage.getDataObjectRelationships();
  const relationshipRegistry = new Set<string>();

  existingRelationships.forEach((relationship) => {
    const normalizedLevel: "object" | "attribute" =
      relationship.relationshipLevel === "attribute" ? "attribute" : "object";
    relationshipRegistry.add(
      buildRelationshipKey(
        relationship.sourceDataObjectId,
        relationship.targetDataObjectId,
        normalizedLevel,
        relationship.sourceAttributeId ?? null,
        relationship.targetAttributeId ?? null
      )
    );
  });

  let relationshipsCreated = 0;
  let heuristicRelationshipsCreated = 0;

  // Process each table's foreign keys
  for (const table of metadata) {
    const explicitForeignKeys = Array.isArray(table.foreignKeys) ? table.foreignKeys : [];
    const heuristicForeignKeys = generateHeuristicForeignKeys(
      table,
      metadata,
      explicitForeignKeys
    );
    const candidateForeignKeys = [...explicitForeignKeys, ...heuristicForeignKeys];

    if (candidateForeignKeys.length === 0) {
      continue;
    }

    const sourceKey = table.name.toLowerCase();
    const sourceObject = objectRegistry.get(sourceKey);
    if (!sourceObject) {
      continue;
    }

    const sourceAttributes = await loadAttributesForObject(sourceObject.id);

    for (const fk of candidateForeignKeys) {
      if (!fk || fk.columns.length !== 1 || fk.referencedColumns.length !== 1) {
        continue;
      }

      // Find target object
      const normalizedTargetKey = fk.referencedTable.toLowerCase();
      let targetObject = objectRegistry.get(normalizedTargetKey);
      if (!targetObject && normalizedTargetKey.includes(".")) {
        const fallbackKey = normalizedTargetKey.split(".").pop();
        if (fallbackKey) {
          targetObject = objectRegistry.get(fallbackKey);
        }
      }

      if (!targetObject) {
        continue;
      }

      const targetAttributes = await loadAttributesForObject(targetObject.id);
      const sourceAttribute = sourceAttributes.find(
        (attr) => attr.name.toLowerCase() === fk.columns[0].toLowerCase()
      );
      const targetAttribute = targetAttributes.find(
        (attr) => attr.name.toLowerCase() === fk.referencedColumns[0].toLowerCase()
      );

      const relationshipType = fk.relationshipType ?? "N:1";
      const isHeuristic = fk.constraintName?.startsWith("heuristic_fk_") ?? false;

      const metadataPayload: Record<string, unknown> = {
        constraintName: fk.constraintName ?? null,
        sourceColumn: fk.columns[0],
        targetColumn: fk.referencedColumns[0],
        referencedTable: fk.referencedTable,
        referencedSchema: fk.referencedSchema ?? null,
        updateRule: fk.updateRule ?? null,
        deleteRule: fk.deleteRule ?? null,
        detectionStrategy: isHeuristic ? "heuristic" : "constraint",
      };

      // Try attribute-level relationship first
      if (sourceAttribute && targetAttribute) {
        const directKey = buildRelationshipKey(
          sourceObject.id,
          targetObject.id,
          "attribute",
          sourceAttribute.id,
          targetAttribute.id
        );
        const reverseKey = buildRelationshipKey(
          targetObject.id,
          sourceObject.id,
          "attribute",
          targetAttribute.id,
          sourceAttribute.id
        );

        if (!relationshipRegistry.has(directKey) && !relationshipRegistry.has(reverseKey)) {
          await storage.createDataObjectRelationship({
            sourceDataObjectId: sourceObject.id,
            targetDataObjectId: targetObject.id,
            type: relationshipType,
            relationshipLevel: "attribute",
            sourceAttributeId: sourceAttribute.id,
            targetAttributeId: targetAttribute.id,
            name:
              fk.constraintName ??
              `${sourceObject.name}.${sourceAttribute.name} → ${targetObject.name}.${targetAttribute.name}`,
            description: "Auto-created from system sync metadata",
            metadata: metadataPayload,
          });

          relationshipRegistry.add(directKey);
          relationshipsCreated += 1;
          if (isHeuristic) {
            heuristicRelationshipsCreated += 1;
          }
          continue;
        }
      }

      // Fallback to object-level relationship
      const objectLevelKey = buildRelationshipKey(
        sourceObject.id,
        targetObject.id,
        "object",
        null,
        null
      );
      const reverseObjectKey = buildRelationshipKey(
        targetObject.id,
        sourceObject.id,
        "object",
        null,
        null
      );

      if (!relationshipRegistry.has(objectLevelKey) && !relationshipRegistry.has(reverseObjectKey)) {
        await storage.createDataObjectRelationship({
          sourceDataObjectId: sourceObject.id,
          targetDataObjectId: targetObject.id,
          type: relationshipType,
          relationshipLevel: "object",
          sourceAttributeId: null,
          targetAttributeId: null,
          name: fk.constraintName ?? `${sourceObject.name} → ${targetObject.name}`,
          description: "Auto-created from system sync metadata (object-level fallback)",
          metadata: metadataPayload,
        });

        relationshipRegistry.add(objectLevelKey);
        relationshipsCreated += 1;
        if (isHeuristic) {
          heuristicRelationshipsCreated += 1;
        }
      }
    }
  }

  return { relationshipsCreated, heuristicRelationshipsCreated };
}
