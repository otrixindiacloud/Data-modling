/**
 * User Object Handlers - For creating objects directly in data_model_objects
 * WITHOUT creating data_objects entries (system sync only)
 */

import { z } from "zod";
import type { Storage } from "../storage";
import type {
  InsertDataModelObject,
  InsertDataModelAttribute,
  DataModelObject,
  DataModelAttribute,
  DataModel,
} from "../../shared/schema";

// Input schema for user-created objects (no objectId)
export const userObjectInputSchema = z.object({
  modelId: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
  objectType: z.string().optional(),
  domainId: z.number().optional(),
  dataAreaId: z.number().optional(),
  sourceSystemId: z.number().optional(),
  targetSystemId: z.number().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  metadata: z.record(z.any()).optional(),
  attributes: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    dataType: z.string().optional(),
    conceptualType: z.string().optional(),
    logicalType: z.string().optional(),
    physicalType: z.string().optional(),
    length: z.number().optional(),
    precision: z.number().optional(),
    scale: z.number().optional(),
    nullable: z.boolean().optional(),
    isPrimaryKey: z.boolean().optional(),
    isForeignKey: z.boolean().optional(),
    orderIndex: z.number().optional(),
  })).optional(),
});

export type UserObjectInput = z.infer<typeof userObjectInputSchema>;

export interface UserObjectResult {
  modelObject: DataModelObject;
  attributes: DataModelAttribute[];
}

/**
 * Create a user-defined object directly in data_model_objects
 * Does NOT create entry in data_objects (system sync only)
 */
export async function createUserObject(
  input: UserObjectInput,
  storage: Storage
): Promise<UserObjectResult> {
  // Validate input
  const validated = userObjectInputSchema.parse(input);

  // Get model to determine layer
  const model = await storage.getDataModel(validated.modelId);
  if (!model) {
    throw new Error(`Model with ID ${validated.modelId} not found`);
  }

  const layer = (model.layer ?? "conceptual") as "conceptual" | "logical" | "physical";

  // Create model object entry (NO objectId - user created)
  const modelObjectPayload: InsertDataModelObject = {
    objectId: null, // NULL = user-created object (not from system sync)
    modelId: validated.modelId,
    name: validated.name,
    description: validated.description ?? null,
    objectType: validated.objectType ?? null,
    domainId: validated.domainId ?? null,
    dataAreaId: validated.dataAreaId ?? null,
    sourceSystemId: validated.sourceSystemId ?? null,
    targetSystemId: validated.targetSystemId ?? null,
    position: validated.position ?? null,
    metadata: validated.metadata ?? null,
    isVisible: true,
    layerSpecificConfig: {},
  };

  const modelObject = await storage.createDataModelObject(modelObjectPayload);

  // Create attributes directly in data_model_attributes (NO attributeId)
  const attributes: DataModelAttribute[] = [];
  if (validated.attributes && validated.attributes.length > 0) {
    for (let i = 0; i < validated.attributes.length; i++) {
      const attr = validated.attributes[i];
      
      const attributePayload: InsertDataModelAttribute = {
        attributeId: null, // NULL = user-created attribute (not from system sync)
        modelObjectId: modelObject.id,
        modelId: validated.modelId,
        name: attr.name,
        description: attr.description ?? null,
        dataType: attr.dataType ?? null,
        conceptualType: attr.conceptualType ?? null,
        logicalType: attr.logicalType ?? null,
        physicalType: attr.physicalType ?? null,
        length: attr.length ?? null,
        precision: attr.precision ?? null,
        scale: attr.scale ?? null,
        nullable: attr.nullable ?? true,
        isPrimaryKey: attr.isPrimaryKey ?? false,
        isForeignKey: attr.isForeignKey ?? false,
        orderIndex: attr.orderIndex ?? i,
        layerSpecificConfig: {},
      };

      const createdAttr = await storage.createDataModelAttribute(attributePayload);
      attributes.push(createdAttr);
    }
  }

  return {
    modelObject,
    attributes,
  };
}

/**
 * Update a user-created object (in data_model_objects)
 */
export async function updateUserObject(
  modelObjectId: number,
  updates: Partial<UserObjectInput>,
  storage: Storage
): Promise<DataModelObject> {
  // Build update payload
  const updatePayload: Partial<InsertDataModelObject> = {};
  
  if (updates.name !== undefined) updatePayload.name = updates.name;
  if (updates.description !== undefined) updatePayload.description = updates.description;
  if (updates.objectType !== undefined) updatePayload.objectType = updates.objectType;
  if (updates.domainId !== undefined) updatePayload.domainId = updates.domainId;
  if (updates.dataAreaId !== undefined) updatePayload.dataAreaId = updates.dataAreaId;
  if (updates.sourceSystemId !== undefined) updatePayload.sourceSystemId = updates.sourceSystemId;
  if (updates.targetSystemId !== undefined) updatePayload.targetSystemId = updates.targetSystemId;
  if (updates.position !== undefined) updatePayload.position = updates.position;
  if (updates.metadata !== undefined) updatePayload.metadata = updates.metadata;

  return await storage.updateDataModelObject(modelObjectId, updatePayload);
}

/**
 * Delete a user-created object and its attributes
 */
export async function deleteUserObject(
  modelObjectId: number,
  storage: Storage
): Promise<void> {
  // Attributes will cascade delete due to foreign key constraints
  await storage.deleteDataModelObject(modelObjectId);
}
