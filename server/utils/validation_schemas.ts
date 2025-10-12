import { z } from "zod";

// Configuration schemas
export const configurationUpdateSchema = z
  .object({
    value: z.any().optional(),
    description: z.string().optional(),
  })
  .refine((data) => data.value !== undefined || data.description !== undefined, {
    message: "At least one of value or description is required",
  });

export const systemObjectUpdateSchema = z.object({
  domainId: z.number().int().positive().nullable().optional(),
  dataAreaId: z.number().int().positive().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const systemSyncRequestSchema = z.object({
  modelId: z.number().int().positive().optional(), // Optional - if provided, objects will be added to this model layer
  direction: z.enum(["source", "target"] as const).default("source").optional(),
  includeAttributes: z.boolean().default(true).optional(),
  domainId: z.number().int().positive().nullable().optional(),
  dataAreaId: z.number().int().positive().nullable().optional(),
  metadataOnly: z.boolean().default(false).optional(),
});

export const modelingAgentRequestSchema = z
  .object({
    rootModelId: z.number().int().positive().optional(),
    modelName: z.string().min(1).optional(),
    businessDescription: z.string().min(1),
    instructions: z.string().min(1),
    targetDatabase: z.string().min(1).optional(),
    sqlPlatforms: z.array(z.string().min(1)).optional(),
    allowDrop: z.boolean().optional(),
    generateSql: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.rootModelId) || Boolean(data.modelName), {
    message: "Provide either rootModelId or modelName",
    path: ["rootModelId"],
  });

export const relationshipTypeEnum = z.enum(["1:1", "1:N", "N:1", "N:M", "M:N"] as const);

export const createRelationshipRequestSchema = z.object({
  sourceObjectId: z.number().int().positive(),
  targetObjectId: z.number().int().positive(),
  type: relationshipTypeEnum,
  modelId: z.number().int().positive(),
  sourceAttributeId: z.number().int().positive().nullable().optional(),
  targetAttributeId: z.number().int().positive().nullable().optional(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
});

export const updateRelationshipRequestSchema = z
  .object({
    type: relationshipTypeEnum.optional(),
    sourceModelObjectId: z.number().int().positive().optional(),
    targetModelObjectId: z.number().int().positive().optional(),
    sourceAttributeId: z.number().int().positive().nullable().optional(),
    targetAttributeId: z.number().int().positive().nullable().optional(),
    sourceHandle: z.string().nullable().optional(),
    targetHandle: z.string().nullable().optional(),
    waypoints: z.array(z.object({
      x: z.number(),
      y: z.number(),
    })).nullable().optional(),
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const modelObjectConfigSchema = z
  .object({
    position: positionSchema.nullable().optional(),
    targetSystemId: z.number().int().positive().nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
    isVisible: z.boolean().optional(),
    layerSpecificConfig: z.record(z.any()).nullable().optional(),
  })
  .partial();

export const perLayerModelObjectConfigSchema = z
  .object({
    conceptual: modelObjectConfigSchema.optional(),
    logical: modelObjectConfigSchema.optional(),
    physical: modelObjectConfigSchema.optional(),
  })
  .partial();

export const attributeInputSchema = z
  .object({
    name: z.string().min(1),
    conceptualType: z.string().nullable().optional(),
    logicalType: z.string().nullable().optional(),
    physicalType: z.string().nullable().optional(),
    dataType: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    nullable: z.boolean().optional(),
    isPrimaryKey: z.boolean().optional(),
    isForeignKey: z.boolean().optional(),
    length: z.number().int().nullable().optional(),
    precision: z.number().int().nullable().optional(),
    scale: z.number().int().nullable().optional(),
    orderIndex: z.number().int().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

export const relationshipInputSchema = z
  .object({
    targetObjectId: z.number().int().positive(),
    type: relationshipTypeEnum.default("1:N").optional(),
    relationshipLevel: z.enum(["object", "attribute"] as const).optional(),
    sourceAttributeName: z.string().nullable().optional(),
    targetAttributeName: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
  })
  .strict();

export type AttributeInput = z.infer<typeof attributeInputSchema>;
export type RelationshipInput = z.infer<typeof relationshipInputSchema>;
export type ModelObjectConfigInput = z.infer<typeof modelObjectConfigSchema>;
export type SystemObjectDirection = "source" | "target";
export type RelationshipLevel = "object" | "attribute";
export type ModelLayer = "conceptual" | "logical" | "physical";
