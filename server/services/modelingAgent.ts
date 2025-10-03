import OpenAI from "openai";
import { z } from "zod";
import {
  Attribute,
  DataModel,
  DataModelObject,
  DataObject,
  Relationship,
  type InsertAttribute,
  type InsertDataModel,
  type InsertDataModelObject,
  type InsertDataObject,
  type InsertRelationship,
} from "@shared/schema";
import { storage } from "../storage";
import { ExportService } from "./exportService";

type LayerName = "conceptual" | "logical" | "physical";
type DiffLayer = LayerName | "all";

type DesiredRelationshipCardinality = "1:1" | "1:N" | "N:1" | "N:M" | "M:N";

export interface ModelingAgentRequest {
  rootModelId?: number;
  modelName?: string;
  businessDescription: string;
  instructions: string;
  targetDatabase?: string;
  sqlPlatforms?: string[];
  allowDrop?: boolean;
  generateSql?: boolean;
}

export interface Issue {
  severity: "info" | "warning" | "error";
  message: string;
  entity?: string;
}

export interface DiffEntry {
  action:
    | "create_model_family"
    | "add_entity"
    | "update_entity"
    | "remove_entity"
    | "add_attribute"
    | "update_attribute"
    | "remove_attribute"
    | "add_relationship"
    | "update_relationship"
    | "remove_relationship";
  layer: DiffLayer;
  target: string;
  status: "applied" | "skipped";
  detail?: string;
  metadata?: Record<string, any>;
}

export interface ConceptualModelResponse {
  entities: Array<{
    name: string;
    description?: string | null;
    relationships: Array<{
      target: string;
      type: string;
      description?: string | null;
    }>;
  }>;
}

export interface LogicalModelEntityAttributeResponse {
  name: string;
  conceptualType?: string | null;
  logicalType?: string | null;
  physicalType?: string | null;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  description?: string | null;
}

export interface LogicalModelResponse {
  entities: Array<{
    name: string;
    description?: string | null;
    attributes: LogicalModelEntityAttributeResponse[];
  }>;
}

export interface ModelingAgentResponse {
  summary: string;
  assumptions: string[];
  conceptualModel: ConceptualModelResponse;
  logicalModel: LogicalModelResponse;
  physicalModel: LogicalModelResponse;
  sql: Record<string, string>;
  issues: Issue[];
  suggestions: string[];
  diff: DiffEntry[];
}

const conceptualRelationshipSchema = z.object({
  target: z.string(),
  type: z.enum(["1:1", "1:N", "N:1", "N:M", "M:N"]).default("1:N"),
  description: z.string().optional(),
  verb: z.string().optional(),
});

const conceptualEntitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  aliases: z.array(z.string()).default([]).optional(),
  relationships: z.array(conceptualRelationshipSchema).default([]),
});

const attributeReferenceSchema = z
  .object({
    entity: z.string(),
    attribute: z.string().optional(),
  })
  .partial()
  .optional();

const logicalAttributeSchema = z.object({
  name: z.string(),
  conceptualType: z.string().optional(),
  logicalType: z.string().optional(),
  physicalType: z.string().optional(),
  nullable: z.boolean().default(true),
  isPrimaryKey: z.boolean().default(false),
  isForeignKey: z.boolean().default(false),
  description: z.string().optional(),
  references: attributeReferenceSchema,
  unique: z.boolean().default(false),
});

const logicalEntitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  aliases: z.array(z.string()).default([]).optional(),
  attributes: z.array(logicalAttributeSchema).default([]),
});

const aiIssueSchema = z.object({
  severity: z.enum(["info", "warning", "error"]).default("warning"),
  message: z.string(),
  entity: z.string().optional(),
});

const modelingAgentSchema = z.object({
  summary: z.string(),
  assumptions: z.array(z.string()).default([]),
  conceptualModel: z.object({
    entities: z.array(conceptualEntitySchema).default([]),
  }),
  logicalModel: z.object({
    entities: z.array(logicalEntitySchema).default([]),
  }),
  physicalModel: z.object({
    entities: z.array(logicalEntitySchema).default([]),
  }),
  sql: z.record(z.string()).default({}),
  issues: z.array(aiIssueSchema).default([]),
  suggestions: z.array(z.string()).default([]),
});

type DesiredConceptualEntity = z.infer<typeof conceptualEntitySchema>;
type DesiredLogicalEntity = z.infer<typeof logicalEntitySchema>;
type DesiredLogicalAttribute = z.infer<typeof logicalAttributeSchema>;
type ModelingAgentAIResult = z.infer<typeof modelingAgentSchema>;

interface LayerEntityContext {
  object: DataObject;
  dataModelObject?: DataModelObject;
  attributes: Attribute[];
}

interface ModelLayerContext {
  model: DataModel;
  entities: LayerEntityContext[];
  relationships: Relationship[];
}

interface ModelingContext {
  rootModelId: number;
  conceptual?: ModelLayerContext;
  logical?: ModelLayerContext;
  physical?: ModelLayerContext;
}

interface SerializedContext {
  conceptual?: {
    entities: Array<{
      name: string;
      description?: string | null;
      relationships: Array<{ target: string; type: string }>;
    }>;
  };
  logical?: {
    entities: Array<{
      name: string;
      attributes: Array<{
        name: string;
        logicalType?: string | null;
        isPrimaryKey: boolean;
        isForeignKey: boolean;
        nullable: boolean;
      }>;
    }>;
  };
  physical?: {
    entities: Array<{
      name: string;
      attributes: Array<{
        name: string;
        physicalType?: string | null;
        isPrimaryKey: boolean;
        isForeignKey: boolean;
        nullable: boolean;
      }>;
    }>;
  };
}

const openAiJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    assumptions: {
      type: "array",
      items: { type: "string" },
    },
    conceptualModel: {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              aliases: {
                type: "array",
                items: { type: "string" },
              },
              relationships: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    target: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["1:1", "1:N", "N:1", "N:M", "M:N"],
                    },
                    description: { type: "string" },
                    verb: { type: "string" },
                  },
                  required: ["target", "type"],
                  additionalProperties: false,
                },
              },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["entities"],
      additionalProperties: false,
    },
    logicalModel: {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              aliases: {
                type: "array",
                items: { type: "string" },
              },
              attributes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    conceptualType: { type: "string" },
                    logicalType: { type: "string" },
                    physicalType: { type: "string" },
                    nullable: { type: "boolean" },
                    isPrimaryKey: { type: "boolean" },
                    isForeignKey: { type: "boolean" },
                    description: { type: "string" },
                    references: {
                      type: "object",
                      properties: {
                        entity: { type: "string" },
                        attribute: { type: "string" },
                      },
                      additionalProperties: false,
                    },
                    unique: { type: "boolean" },
                  },
                  required: ["name"],
                  additionalProperties: false,
                },
              },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["entities"],
      additionalProperties: false,
    },
    physicalModel: {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              aliases: {
                type: "array",
                items: { type: "string" },
              },
              attributes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    conceptualType: { type: "string" },
                    logicalType: { type: "string" },
                    physicalType: { type: "string" },
                    nullable: { type: "boolean" },
                    isPrimaryKey: { type: "boolean" },
                    isForeignKey: { type: "boolean" },
                    description: { type: "string" },
                    references: {
                      type: "object",
                      properties: {
                        entity: { type: "string" },
                        attribute: { type: "string" },
                      },
                      additionalProperties: false,
                    },
                    unique: { type: "boolean" },
                  },
                  required: ["name"],
                  additionalProperties: false,
                },
              },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["entities"],
      additionalProperties: false,
    },
    sql: {
      type: "object",
      additionalProperties: { type: "string" },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["info", "warning", "error"] },
          message: { type: "string" },
          entity: { type: "string" },
        },
        required: ["message"],
        additionalProperties: false,
      },
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["summary", "conceptualModel", "logicalModel", "physicalModel"],
  additionalProperties: false,
} as const;

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class ModelingAgentService {
  private exportService = new ExportService();

  async run(input: ModelingAgentRequest): Promise<ModelingAgentResponse> {
    if (!input.rootModelId && !input.modelName) {
      throw new Error("Either rootModelId or modelName must be provided");
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required to run the modeling agent");
    }

    const diffEntries: DiffEntry[] = [];
    const allowDrop = input.allowDrop ?? false;

    let context = input.rootModelId
      ? await this.buildContext(input.rootModelId)
      : await this.createInitialModelFamily(input.modelName!, diffEntries);

    context = await this.ensureLayerCompleteness(context, diffEntries);

    const aiResult = await this.invokeModelingAgent(input, context);

    const applyResult = await this.applyDesiredState(aiResult, context, allowDrop);
    context = applyResult.context;

    const combinedDiff = [...diffEntries, ...applyResult.diff];

    const computedIssues = await this.detectIssues(context);
    const mergedIssues = this.mergeIssues(aiResult.issues, computedIssues);

    const migrationSuggestions = this.buildMigrationSuggestions(combinedDiff, allowDrop);
    const mergedSuggestions = this.mergeSuggestions(aiResult.suggestions, migrationSuggestions);

    const sql = await this.generateSql(input, context);

    return {
      summary: aiResult.summary,
      assumptions: aiResult.assumptions,
      conceptualModel: this.formatConceptual(context),
      logicalModel: this.formatLogical(context),
      physicalModel: this.formatPhysical(context),
      sql,
      issues: mergedIssues,
      suggestions: mergedSuggestions,
      diff: combinedDiff,
    };
  }

  private async createInitialModelFamily(name: string, diff: DiffEntry[]): Promise<ModelingContext> {
    const conceptual = await storage.createDataModel({
      name,
      layer: "conceptual",
    } satisfies InsertDataModel);

    const logical = await storage.createDataModel({
      name,
      layer: "logical",
      parentModelId: conceptual.id,
      domainId: conceptual.domainId ?? null,
      dataAreaId: conceptual.dataAreaId ?? null,
      targetSystemId: conceptual.targetSystemId ?? null,
    } satisfies InsertDataModel);

    await storage.createDataModel({
      name,
      layer: "physical",
      parentModelId: conceptual.id,
      domainId: conceptual.domainId ?? null,
      dataAreaId: conceptual.dataAreaId ?? null,
      targetSystemId: conceptual.targetSystemId ?? null,
    } satisfies InsertDataModel);

    diff.push({
      action: "create_model_family",
      layer: "all",
      target: name,
      status: "applied",
      detail: "Created conceptual, logical, and physical models",
    });

    return this.buildContext(conceptual.id);
  }

  private async ensureLayerCompleteness(context: ModelingContext, diff: DiffEntry[]): Promise<ModelingContext> {
    const conceptual = context.conceptual?.model;
    if (!conceptual) {
      throw new Error("Conceptual model is required for AI data modeling agent");
    }

    let updatedContext = context;

    if (!context.logical) {
      await storage.createDataModel({
        name: conceptual.name,
        layer: "logical",
        parentModelId: conceptual.id,
        domainId: conceptual.domainId ?? null,
        dataAreaId: conceptual.dataAreaId ?? null,
        targetSystemId: conceptual.targetSystemId ?? null,
      } satisfies InsertDataModel);
      diff.push({
        action: "create_model_family",
        layer: "logical",
        target: conceptual.name,
        status: "applied",
        detail: "Created logical layer to align with conceptual model",
      });
      updatedContext = await this.buildContext(conceptual.id);
    }

    if (!updatedContext.physical) {
      const refreshedConceptual = updatedContext.conceptual?.model ?? conceptual;
      await storage.createDataModel({
        name: refreshedConceptual.name,
        layer: "physical",
        parentModelId: refreshedConceptual.id,
        domainId: refreshedConceptual.domainId ?? null,
        dataAreaId: refreshedConceptual.dataAreaId ?? null,
        targetSystemId: refreshedConceptual.targetSystemId ?? null,
      } satisfies InsertDataModel);
      diff.push({
        action: "create_model_family",
        layer: "physical",
        target: refreshedConceptual.name,
        status: "applied",
        detail: "Created physical layer to align with conceptual model",
      });
      updatedContext = await this.buildContext(refreshedConceptual.id);
    }

    return updatedContext;
  }

  private async buildContext(rootModelId: number): Promise<ModelingContext> {
    const models = await storage.getDataModels();
    const targetModel = models.find((model) => model.id === rootModelId);

    if (!targetModel) {
      throw new Error(`Model with id ${rootModelId} not found`);
    }

    const conceptualModel =
      targetModel.layer === "conceptual"
        ? targetModel
        : targetModel.parentModelId
        ? models.find((model) => model.id === targetModel.parentModelId) ?? targetModel
        : targetModel;

    const logicalModel =
      models.find((model) => model.parentModelId === conceptualModel.id && model.layer === "logical") ??
      (targetModel.layer === "logical" ? targetModel : undefined);

    const physicalModel =
      models.find((model) => model.parentModelId === conceptualModel.id && model.layer === "physical") ??
      (targetModel.layer === "physical" ? targetModel : undefined);

    const allObjects = await storage.getAllDataObjects();
    const allAttributes = await storage.getAllAttributes();

    const conceptual =
      conceptualModel.layer === "conceptual"
        ? await this.buildLayerContext(conceptualModel, allObjects, allAttributes)
        : undefined;

    const logical = logicalModel
      ? await this.buildLayerContext(logicalModel, allObjects, allAttributes)
      : undefined;

    const physical = physicalModel
      ? await this.buildLayerContext(physicalModel, allObjects, allAttributes)
      : undefined;

    return {
      rootModelId: conceptualModel.id,
      conceptual,
      logical,
      physical,
    };
  }

  private async buildLayerContext(
    model: DataModel,
    allObjects: DataObject[],
    allAttributes: Attribute[],
  ): Promise<ModelLayerContext> {
    const objects = allObjects.filter((object) => object.modelId === model.id);
    const attributesByObjectId = new Map<number, Attribute[]>();

    for (const attribute of allAttributes) {
      const existing = attributesByObjectId.get(attribute.objectId) ?? [];
      existing.push(attribute);
      attributesByObjectId.set(attribute.objectId, existing);
    }

    const dataModelObjects = await storage.getDataModelObjectsByModel(model.id);
    const dataModelObjectByObjectId = new Map<number, DataModelObject>();
    for (const dmo of dataModelObjects) {
      dataModelObjectByObjectId.set(dmo.objectId, dmo);
    }

    const relationships = await storage.getRelationshipsByModel(model.id);

    const entities: LayerEntityContext[] = objects.map((object) => ({
      object,
      dataModelObject: dataModelObjectByObjectId.get(object.id) ?? undefined,
      attributes: attributesByObjectId.get(object.id)?.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)) ?? [],
    }));

    return {
      model,
      entities,
      relationships,
    };
  }

  private serializeContext(context: ModelingContext, limit = 40): SerializedContext {
    const result: SerializedContext = {};

    if (context.conceptual) {
      const layer = context.conceptual;
      result.conceptual = {
        entities: layer.entities.slice(0, limit).map((entity) => ({
          name: entity.object.name,
          description: entity.object.description ?? null,
          relationships: this.mapConceptualRelationships(layer, entity),
        })),
      };
    }

    if (context.logical) {
      const layer = context.logical;
      result.logical = {
        entities: layer.entities.slice(0, limit).map((entity) => ({
          name: entity.object.name,
          attributes: entity.attributes.slice(0, 25).map((attribute) => ({
            name: attribute.name,
            logicalType: attribute.logicalType ?? attribute.conceptualType ?? null,
            isPrimaryKey: attribute.isPrimaryKey ?? false,
            isForeignKey: attribute.isForeignKey ?? false,
            nullable: attribute.nullable ?? true,
          })),
        })),
      };
    }

    if (context.physical) {
      const layer = context.physical;
      result.physical = {
        entities: layer.entities.slice(0, limit).map((entity) => ({
          name: entity.object.name,
          attributes: entity.attributes.slice(0, 25).map((attribute) => ({
            name: attribute.name,
            physicalType: attribute.physicalType ?? attribute.logicalType ?? null,
            isPrimaryKey: attribute.isPrimaryKey ?? false,
            isForeignKey: attribute.isForeignKey ?? false,
            nullable: attribute.nullable ?? true,
          })),
        })),
      };
    }

    return result;
  }

  private mapConceptualRelationships(
    layer: ModelLayerContext,
    entity: LayerEntityContext,
  ): Array<{ target: string; type: string }> {
    if (!entity.dataModelObject) {
      return [];
    }

    const relationships = layer.relationships.filter(
      (relationship) => relationship.relationshipLevel === "object" && relationship.sourceModelObjectId === entity.dataModelObject?.id,
    );

    return relationships.map((relationship) => {
      const targetEntity = layer.entities.find(
        (candidate) => candidate.dataModelObject?.id === relationship.targetModelObjectId,
      );

      return {
        target: targetEntity?.object.name ?? `object_${relationship.targetModelObjectId}`,
        type: relationship.type,
      };
    });
  }

  private async invokeModelingAgent(
    input: ModelingAgentRequest,
    context: ModelingContext,
  ): Promise<ModelingAgentAIResult> {
    const serialized = this.serializeContext(context);

    const systemPrompt = [
      "You are an expert enterprise data-modeling assistant.",
      "Create conceptual, logical, and physical data models from plain-language instructions.",
      "Respect naming rules: entities are singular nouns, logical/physical attribute names use snake_case.",
      "Ensure relationships include clear cardinalities.",
      "Only return JSON that conforms to the provided schema without additional commentary.",
    ].join(" ");

    const userPayload = {
      businessDescription: input.businessDescription,
      instructions: input.instructions,
      targetDatabase: input.targetDatabase ?? "generic",
      allowDrop: input.allowDrop ?? false,
      existingModels: serialized,
    };

    const userPrompt = [
      "Business context and modeling request are provided below in JSON.",
      "Generate the final desired state for conceptual, logical, and physical models.",
      "Include thoughtfully chosen assumptions if details are missing.",
      JSON.stringify(userPayload, null, 2),
    ].join("\n\n");

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      max_tokens: 4000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "modeling_agent_response",
          schema: openAiJsonSchema,
        },
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    try {
      const parsed = modelingAgentSchema.parse(JSON.parse(raw));
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse AI modeling response: ${(error as Error).message}`);
    }
  }

  private async applyDesiredState(
    aiResult: ModelingAgentAIResult,
    initialContext: ModelingContext,
    allowDrop: boolean,
  ): Promise<{ context: ModelingContext; diff: DiffEntry[] }> {
    let workingContext = initialContext;
    const diff: DiffEntry[] = [];

    if (workingContext.conceptual) {
      const layerDiff = await this.syncLayer(
        "conceptual",
        workingContext.conceptual,
        aiResult.conceptualModel.entities,
        allowDrop,
      );
      diff.push(...layerDiff);
      workingContext = await this.buildContext(workingContext.rootModelId);
    }

    if (workingContext.logical) {
      const layerDiff = await this.syncLayer(
        "logical",
        workingContext.logical,
        aiResult.logicalModel.entities,
        allowDrop,
      );
      diff.push(...layerDiff);
      workingContext = await this.buildContext(workingContext.rootModelId);
    }

    if (workingContext.physical) {
      const layerDiff = await this.syncLayer(
        "physical",
        workingContext.physical,
        aiResult.physicalModel.entities,
        allowDrop,
      );
      diff.push(...layerDiff);
      workingContext = await this.buildContext(workingContext.rootModelId);
    }

    if (workingContext.conceptual) {
      const relationshipDiff = await this.syncConceptualRelationships(
        workingContext.conceptual,
        aiResult.conceptualModel.entities,
        allowDrop,
      );
      diff.push(...relationshipDiff);
      workingContext = await this.buildContext(workingContext.rootModelId);
    }

    return { context: workingContext, diff };
  }

  private async syncLayer(
    layer: LayerName,
    layerContext: ModelLayerContext,
    desiredEntities: DesiredConceptualEntity[] | DesiredLogicalEntity[],
    allowDrop: boolean,
  ): Promise<DiffEntry[]> {
    const diff: DiffEntry[] = [];

    const existingMap = new Map<string, LayerEntityContext>();
    for (const entity of layerContext.entities) {
      existingMap.set(this.normalizeName(entity.object.name), entity);
    }

    const desiredLookup = new Map<string, DesiredConceptualEntity | DesiredLogicalEntity>();

    for (const desired of desiredEntities) {
      const aliases = "aliases" in desired && Array.isArray(desired.aliases) ? desired.aliases : [];
      const keys = [desired.name, ...aliases];
      for (const key of keys) {
        desiredLookup.set(this.normalizeName(key), desired);
      }
    }

    for (const desired of desiredEntities) {
      const keys = this.collectEntityKeys(desired);
      let existing: LayerEntityContext | undefined;

      for (const key of keys) {
        existing = existingMap.get(key);
        if (existing) {
          break;
        }
      }

      if (!existing) {
        const created = await this.createEntity(layer, layerContext.model, desired);
        diff.push({
          action: "add_entity",
          layer,
          target: desired.name,
          status: "applied",
          detail: "Entity created by AI modeling agent",
        });

        if (layer !== "conceptual" && "attributes" in desired) {
          const attrDiff = await this.syncAttributes(
            layer,
            created.object,
            [],
            desired.attributes ?? [],
            allowDrop,
          );
          diff.push(...attrDiff);
        }

        continue;
      }

      const updatePayload: Partial<InsertDataObject> = {};
      const desiredDescription = (desired as DesiredConceptualEntity | DesiredLogicalEntity).description ?? null;

      if (desired.name !== existing.object.name) {
        updatePayload.name = desired.name;
      }

      if ((existing.object.description ?? null) !== (desiredDescription ?? null)) {
        updatePayload.description = desiredDescription;
      }

      if (Object.keys(updatePayload).length > 0) {
        await storage.updateDataObject(existing.object.id, updatePayload);
        diff.push({
          action: "update_entity",
          layer,
          target: desired.name,
          status: "applied",
          detail: "Updated entity metadata",
        });
      }

      if (layer !== "conceptual" && "attributes" in desired) {
        const attrDiff = await this.syncAttributes(
          layer,
          existing.object,
          existing.attributes,
          desired.attributes ?? [],
          allowDrop,
        );
        diff.push(...attrDiff);
      }
    }

    for (const entity of layerContext.entities) {
      const key = this.normalizeName(entity.object.name);
      if (!desiredLookup.has(key)) {
        if (allowDrop) {
          await this.deleteEntity(layer, layerContext.model, entity);
          diff.push({
            action: "remove_entity",
            layer,
            target: entity.object.name,
            status: "applied",
            detail: "Entity removed per AI recommendation",
          });
        } else {
          diff.push({
            action: "remove_entity",
            layer,
            target: entity.object.name,
            status: "skipped",
            detail: "AI suggested removal but allowDrop=false",
          });
        }
      }
    }

    return diff;
  }

  private collectEntityKeys(entity: DesiredConceptualEntity | DesiredLogicalEntity): string[] {
    const aliases = "aliases" in entity && Array.isArray(entity.aliases) ? entity.aliases : [];
    return [entity.name, ...aliases].map((value) => this.normalizeName(value));
  }

  private async createEntity(
    layer: LayerName,
    model: DataModel,
    desired: DesiredConceptualEntity | DesiredLogicalEntity,
  ): Promise<LayerEntityContext> {
    const insertObject: InsertDataObject = {
      name: desired.name,
      modelId: model.id,
      description: desired.description ?? null,
      domainId: model.domainId ?? null,
      dataAreaId: model.dataAreaId ?? null,
      targetSystemId: model.targetSystemId ?? null,
      isNew: true,
      position: { x: 0, y: 0 },
    };

    const createdObject = await storage.createDataObject(insertObject);

    const dataModelObject = await storage.createDataModelObject({
      objectId: createdObject.id,
      modelId: model.id,
      targetSystemId: model.targetSystemId ?? null,
      position: { x: 0, y: 0 },
      isVisible: true,
      layerSpecificConfig: {
        layer,
        createdBy: "ai_modeling_agent",
      } as Record<string, any>,
    } satisfies InsertDataModelObject);

    return {
      object: createdObject,
      dataModelObject,
      attributes: [],
    };
  }

  private async deleteEntity(layer: LayerName, model: DataModel, entity: LayerEntityContext): Promise<void> {
    const dataModelObjects = await storage.getDataModelObjectsByModel(model.id);
    const relatedDataModelObjects = dataModelObjects.filter((dmo) => dmo.objectId === entity.object.id);

    for (const dmo of relatedDataModelObjects) {
      const relationships = await storage.getRelationshipsByModel(model.id);
      for (const relationship of relationships) {
        if (relationship.sourceModelObjectId === dmo.id || relationship.targetModelObjectId === dmo.id) {
          await storage.deleteRelationship(relationship.id);
        }
      }
      await storage.deleteDataModelObject(dmo.id);
    }

    await storage.deleteAttributesByObject(entity.object.id);
    await storage.deleteDataObject(entity.object.id);
  }

  private inferLogicalType(attribute: DesiredLogicalAttribute, layer: LayerName): string | null {
    if (attribute.logicalType) {
      return attribute.logicalType;
    }

    if (attribute.conceptualType) {
      return this.mapConceptualToLogical(attribute.conceptualType);
    }

    if (layer === "physical" && attribute.physicalType) {
      return this.mapPhysicalToLogical(attribute.physicalType);
    }

    return layer === "conceptual" ? null : "VARCHAR";
  }

  private inferPhysicalType(attribute: DesiredLogicalAttribute, logicalType: string | null): string | null {
    if (attribute.physicalType) {
      return attribute.physicalType;
    }

    if (!logicalType) {
      return null;
    }

    return this.mapLogicalToPhysical(logicalType);
  }

  private mapConceptualToLogical(conceptualType: string): string {
    const normalized = conceptualType.trim().toLowerCase();
    switch (normalized) {
      case "number":
      case "integer":
      case "int":
        return "INTEGER";
      case "decimal":
      case "currency":
      case "percentage":
        return "DECIMAL";
      case "date":
        return "DATE";
      case "datetime":
        return "TIMESTAMP";
      case "boolean":
        return "BOOLEAN";
      case "uuid":
        return "UUID";
      default:
        return "VARCHAR";
    }
  }

  private mapPhysicalToLogical(physicalType: string): string {
    const normalized = physicalType.trim().toLowerCase();
    if (normalized.includes("char") || normalized.includes("text")) {
      return "VARCHAR";
    }
    if (normalized.includes("int")) {
      return "INTEGER";
    }
    if (normalized.includes("decimal") || normalized.includes("numeric")) {
      return "DECIMAL";
    }
    if (normalized.includes("timestamp")) {
      return "TIMESTAMP";
    }
    if (normalized.includes("date")) {
      return "DATE";
    }
    if (normalized.includes("bool")) {
      return "BOOLEAN";
    }
    return "VARCHAR";
  }

  private mapLogicalToPhysical(logicalType: string): string {
    const normalized = logicalType.trim().toUpperCase();
    switch (normalized) {
      case "INTEGER":
      case "INT":
        return "INT";
      case "BIGINT":
        return "BIGINT";
      case "DECIMAL":
      case "NUMERIC":
        return "DECIMAL(18,2)";
      case "DATE":
        return "DATE";
      case "TIMESTAMP":
      case "DATETIME":
        return "TIMESTAMP";
      case "BOOLEAN":
        return "BOOLEAN";
      case "UUID":
        return "UUID";
      default:
        return "VARCHAR(255)";
    }
  }

  private async syncAttributes(
    layer: LayerName,
    object: DataObject,
    existingAttributes: Attribute[],
    desiredAttributes: DesiredLogicalAttribute[],
    allowDrop: boolean,
  ): Promise<DiffEntry[]> {
    const diff: DiffEntry[] = [];

    const existingMap = new Map<string, Attribute>();
    for (const attribute of existingAttributes) {
      existingMap.set(this.normalizeName(attribute.name), attribute);
    }

    const desiredMap = new Map<string, DesiredLogicalAttribute>();
    desiredAttributes.forEach((attribute) => {
      desiredMap.set(this.normalizeName(attribute.name), attribute);
    });

    for (let index = 0; index < desiredAttributes.length; index += 1) {
      const desired = desiredAttributes[index];
      const key = this.normalizeName(desired.name);
      const existing = existingMap.get(key);
      const normalizedName = this.normalizeAttributeName(desired.name);

      const logicalType = this.inferLogicalType(desired, layer);
      const physicalType = this.inferPhysicalType(desired, logicalType);
      const conceptualType = desired.conceptualType ?? null;

      if (!existing) {
        const created = await storage.createAttribute({
          name: normalizedName,
          objectId: object.id,
          conceptualType,
          logicalType,
          physicalType,
          nullable: desired.nullable ?? true,
          isPrimaryKey: desired.isPrimaryKey ?? false,
          isForeignKey: desired.isForeignKey ?? Boolean(desired.references),
          description: desired.description ?? null,
          orderIndex: index,
          isNew: true,
        } satisfies InsertAttribute);

        diff.push({
          action: "add_attribute",
          layer,
          target: `${object.name}.${created.name}`,
          status: "applied",
          detail: "Attribute created",
          metadata: {
            entity: object.name,
            attribute: created.name,
            logicalType,
            physicalType,
          },
        });

        continue;
      }

      const updatePayload: Partial<InsertAttribute> = {};
      let hasChanges = false;

      if (normalizedName !== existing.name) {
        updatePayload.name = normalizedName;
        hasChanges = true;
      }

      if ((existing.conceptualType ?? null) !== conceptualType) {
        updatePayload.conceptualType = conceptualType;
        hasChanges = true;
      }

      if ((existing.logicalType ?? null) !== (logicalType ?? null)) {
        updatePayload.logicalType = logicalType ?? null;
        hasChanges = true;
      }

      if ((existing.physicalType ?? null) !== (physicalType ?? null)) {
        updatePayload.physicalType = physicalType ?? null;
        hasChanges = true;
      }

      if ((existing.description ?? null) !== (desired.description ?? null)) {
        updatePayload.description = desired.description ?? null;
        hasChanges = true;
      }

      const desiredNullable = desired.nullable ?? true;
      if ((existing.nullable ?? true) !== desiredNullable) {
        updatePayload.nullable = desiredNullable;
        hasChanges = true;
      }

      const desiredPk = desired.isPrimaryKey ?? false;
      if ((existing.isPrimaryKey ?? false) !== desiredPk) {
        updatePayload.isPrimaryKey = desiredPk;
        hasChanges = true;
      }

      const desiredFk = desired.isForeignKey ?? Boolean(desired.references);
      if ((existing.isForeignKey ?? false) !== desiredFk) {
        updatePayload.isForeignKey = desiredFk;
        hasChanges = true;
      }

      if ((existing.orderIndex ?? 0) !== index) {
        updatePayload.orderIndex = index;
        hasChanges = true;
      }

      if (hasChanges) {
        await storage.updateAttribute(existing.id, updatePayload);
        diff.push({
          action: "update_attribute",
          layer,
          target: `${object.name}.${normalizedName}`,
          status: "applied",
          detail: "Attribute updated",
          metadata: {
            entity: object.name,
            attribute: normalizedName,
            logicalType,
            physicalType,
          },
        });
      }
    }

    for (const attribute of existingAttributes) {
      const key = this.normalizeName(attribute.name);
      if (!desiredMap.has(key)) {
        if (allowDrop) {
          await storage.deleteAttribute(attribute.id);
          diff.push({
            action: "remove_attribute",
            layer,
            target: `${object.name}.${attribute.name}`,
            status: "applied",
            detail: "Attribute removed",
            metadata: {
              entity: object.name,
              attribute: attribute.name,
            },
          });
        } else {
          diff.push({
            action: "remove_attribute",
            layer,
            target: `${object.name}.${attribute.name}`,
            status: "skipped",
            detail: "AI suggested attribute removal but allowDrop=false",
            metadata: {
              entity: object.name,
              attribute: attribute.name,
            },
          });
        }
      }
    }

    return diff;
  }

  private normalizeAttributeName(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }

    return trimmed
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^a-zA-Z0-9_]+/g, "_")
      .replace(/__+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  private async syncConceptualRelationships(
    layerContext: ModelLayerContext,
    desiredEntities: DesiredConceptualEntity[],
    allowDrop: boolean,
  ): Promise<DiffEntry[]> {
    const diff: DiffEntry[] = [];
    const model = layerContext.model;
    const dataModelObjects = await storage.getDataModelObjectsByModel(model.id);
    const dataModelObjectByObjectId = new Map<number, DataModelObject>();
    for (const dmo of dataModelObjects) {
      dataModelObjectByObjectId.set(dmo.objectId, dmo);
    }

    const entityByName = new Map<string, LayerEntityContext>();
    for (const entity of layerContext.entities) {
      entityByName.set(this.normalizeName(entity.object.name), entity);
    }

    const desiredMap = new Map<string, {
      sourceDmoId: number;
      targetDmoId: number;
      type: "1:1" | "1:N" | "N:M";
      description?: string | null;
    }>();

    for (const entity of desiredEntities) {
      const sourceEntity = entityByName.get(this.normalizeName(entity.name));
      if (!sourceEntity) {
        continue;
      }
      const sourceDmo = dataModelObjectByObjectId.get(sourceEntity.object.id);
      if (!sourceDmo) {
        continue;
      }

      for (const relationship of entity.relationships ?? []) {
        const normalized = this.normalizeRelationship(entity.name, relationship);
        if (!normalized) {
          continue;
        }

        const targetEntity = entityByName.get(this.normalizeName(normalized.target));
        if (!targetEntity) {
          continue;
        }

        const targetDmo = dataModelObjectByObjectId.get(targetEntity.object.id);
        if (!targetDmo) {
          continue;
        }

        const key = this.computeRelationshipKey(sourceDmo.id, targetDmo.id);
        desiredMap.set(key, {
          sourceDmoId: sourceDmo.id,
          targetDmoId: targetDmo.id,
          type: normalized.type,
          description: normalized.description ?? null,
        });
      }
    }

    const existingRelationships = layerContext.relationships.filter(
      (relationship) => relationship.relationshipLevel === "object",
    );

    const existingMap = new Map<string, Relationship>();
    for (const relationship of existingRelationships) {
      const key = this.computeRelationshipKey(
        relationship.sourceModelObjectId,
        relationship.targetModelObjectId,
      );
      existingMap.set(key, relationship);
    }

    const desiredEntries = Array.from(desiredMap.entries());
    for (let i = 0; i < desiredEntries.length; i += 1) {
      const [key, desired] = desiredEntries[i];
      const existing = existingMap.get(key);
      if (!existing) {
        await storage.createRelationship({
          sourceModelObjectId: desired.sourceDmoId,
          targetModelObjectId: desired.targetDmoId,
          type: desired.type,
          relationshipLevel: "object",
          sourceAttributeId: null,
          targetAttributeId: null,
          modelId: model.id,
          layer: "conceptual",
          name: null,
          description: desired.description ?? null,
        } satisfies InsertRelationship);

        diff.push({
          action: "add_relationship",
          layer: "conceptual",
          target: key,
          status: "applied",
          detail: "Relationship created",
          metadata: { type: desired.type },
        });

        continue;
      }

      if (existing.type !== desired.type || (existing.description ?? null) !== (desired.description ?? null)) {
        await storage.updateRelationship(existing.id, {
          type: desired.type,
          description: desired.description ?? null,
        });

        diff.push({
          action: "update_relationship",
          layer: "conceptual",
          target: key,
          status: "applied",
          detail: "Relationship updated",
          metadata: { type: desired.type },
        });
      }
    }

    const existingEntries = Array.from(existingMap.entries());
    for (let i = 0; i < existingEntries.length; i += 1) {
      const [key, relationship] = existingEntries[i];
      if (!desiredMap.has(key)) {
        if (allowDrop) {
          await storage.deleteRelationship(relationship.id);
          diff.push({
            action: "remove_relationship",
            layer: "conceptual",
            target: key,
            status: "applied",
            detail: "Relationship removed",
          });
        } else {
          diff.push({
            action: "remove_relationship",
            layer: "conceptual",
            target: key,
            status: "skipped",
            detail: "AI suggested relationship removal but allowDrop=false",
          });
        }
      }
    }

    return diff;
  }

  private normalizeRelationship(
    sourceName: string,
    relationship: z.infer<typeof conceptualRelationshipSchema>,
  ): { source: string; target: string; type: "1:1" | "1:N" | "N:M"; description?: string | null } | null {
    let type = (relationship.type as DesiredRelationshipCardinality).toUpperCase();
    let source = sourceName;
    let target = relationship.target;

    if (!target) {
      return null;
    }

    if (type === "M:N") {
      type = "N:M";
    }

    if (type === "N:1") {
      [source, target] = [relationship.target, sourceName];
      type = "1:N";
    }

    if (type !== "1:1" && type !== "1:N" && type !== "N:M") {
      type = "1:N";
    }

    return {
      source,
      target,
      type: type as "1:1" | "1:N" | "N:M",
      description: relationship.description ?? null,
    };
  }

  private computeRelationshipKey(sourceId: number, targetId: number): string {
    return `${sourceId}->${targetId}`;
  }

  private normalizeName(value: string): string {
    return value.trim().toLowerCase();
  }

  private mergeIssues(aiIssues: Issue[], computed: Issue[]): Issue[] {
    const map = new Map<string, Issue>();
    for (const issue of [...aiIssues, ...computed]) {
      const key = `${issue.severity}:${issue.entity ?? ""}:${issue.message}`;
      if (!map.has(key)) {
        map.set(key, issue);
      }
    }
    return Array.from(map.values());
  }

  private mergeSuggestions(primary: string[], secondary: string[]): string[] {
    const set = new Set<string>();
    for (const suggestion of [...primary, ...secondary]) {
      const trimmed = suggestion.trim();
      if (trimmed.length > 0) {
        set.add(trimmed);
      }
    }
    return Array.from(set.values());
  }

  private async detectIssues(context: ModelingContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    const attributeRelationships = async (layer?: ModelLayerContext) => {
      if (!layer) {
        return new Set<number>();
      }
      const relationships = await storage.getRelationshipsByModel(layer.model.id);
      const attributeIds = new Set<number>();
      for (const relationship of relationships) {
        if (relationship.relationshipLevel === "attribute") {
          if (relationship.sourceAttributeId) {
            attributeIds.add(relationship.sourceAttributeId);
          }
          if (relationship.targetAttributeId) {
            attributeIds.add(relationship.targetAttributeId);
          }
        }
      }
      return attributeIds;
    };

    const logicalAttributeRelationships = await attributeRelationships(context.logical);
    const physicalAttributeRelationships = await attributeRelationships(context.physical);

    const evaluateLayer = (
      layer?: ModelLayerContext,
      relationshipAttributeIds?: Set<number>,
    ) => {
      if (!layer) {
        return;
      }

      for (const entity of layer.entities) {
        for (const attribute of entity.attributes) {
          if ((attribute.isPrimaryKey ?? false) && (attribute.nullable ?? false)) {
            issues.push({
              severity: "error",
              message: `${entity.object.name}.${attribute.name} is a primary key but allows NULL values`,
              entity: entity.object.name,
            });
          }

          if (
            (attribute.isForeignKey ?? false) &&
            relationshipAttributeIds &&
            !relationshipAttributeIds.has(attribute.id)
          ) {
            issues.push({
              severity: "warning",
              message: `${entity.object.name}.${attribute.name} is marked as foreign key but no relationship references it`,
              entity: entity.object.name,
            });
          }
        }
      }
    };

    evaluateLayer(context.logical, logicalAttributeRelationships);
    evaluateLayer(context.physical, physicalAttributeRelationships);

    if (context.conceptual) {
      const cycles = await this.detectRelationshipCycles(context.conceptual);
      for (const cycle of cycles) {
        issues.push({
          severity: "warning",
          message: `Relationship cycle detected: ${cycle.join(" -> ")}`,
          entity: cycle[0],
        });
      }
    }

    return issues;
  }

  private async detectRelationshipCycles(layer: ModelLayerContext): Promise<string[][]> {
    const dataModelObjects = await storage.getDataModelObjectsByModel(layer.model.id);
    const nameByDataModelObjectId = new Map<number, string>();
    for (const entity of layer.entities) {
      const dmo = dataModelObjects.find((item) => item.objectId === entity.object.id);
      if (dmo) {
        nameByDataModelObjectId.set(dmo.id, entity.object.name);
      }
    }

    const adjacency = new Map<number, number[]>();
    for (const relationship of layer.relationships) {
      if (relationship.relationshipLevel !== "object") {
        continue;
      }
      const list = adjacency.get(relationship.sourceModelObjectId) ?? [];
      list.push(relationship.targetModelObjectId);
      adjacency.set(relationship.sourceModelObjectId, list);
    }

    const visited = new Set<number>();
    const stack = new Set<number>();
    const path: number[] = [];
    const cycles: string[][] = [];
    const seen = new Set<string>();

    const dfs = (node: number) => {
      visited.add(node);
      stack.add(node);
      path.push(node);

      for (const neighbor of adjacency.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (stack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            const cycleNodes = path.slice(cycleStart).concat([neighbor]);
            const names = cycleNodes.map(
              (id) => nameByDataModelObjectId.get(id) ?? `object_${id}`,
            );
            const key = names.join("->");
            if (!seen.has(key)) {
              seen.add(key);
              cycles.push(names);
            }
          }
        }
      }

      stack.delete(node);
      path.pop();
    };

    const adjacencyKeys = Array.from(adjacency.keys());
    for (let i = 0; i < adjacencyKeys.length; i += 1) {
      const node = adjacencyKeys[i];
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  private buildMigrationSuggestions(diff: DiffEntry[], allowDrop: boolean): string[] {
    const suggestions: string[] = [];

    for (const entry of diff) {
      if (entry.status !== "applied") {
        continue;
      }

      switch (entry.action) {
        case "add_entity":
          suggestions.push(`Plan a CREATE TABLE for ${entry.target}.`);
          break;
        case "add_attribute":
          if (entry.metadata?.entity && entry.metadata?.attribute) {
            suggestions.push(
              `Schedule ALTER TABLE ${entry.metadata.entity} ADD COLUMN ${entry.metadata.attribute}.`,
            );
          }
          break;
        case "update_attribute":
          if (entry.metadata?.entity && entry.metadata?.attribute) {
            suggestions.push(
              `Review ${entry.metadata.entity}.${entry.metadata.attribute} and apply ALTER COLUMN to align types/constraints.`,
            );
          }
          break;
        case "remove_entity":
          if (allowDrop) {
            suggestions.push(`Plan a DROP TABLE for ${entry.target} after validating downstream impacts.`);
          }
          break;
        case "remove_attribute":
          if (allowDrop && entry.metadata?.entity && entry.metadata?.attribute) {
            suggestions.push(
              `Prepare ALTER TABLE ${entry.metadata.entity} DROP COLUMN ${entry.metadata.attribute} with data backup.`,
            );
          }
          break;
        default:
          break;
      }
    }

  return Array.from(new Set(suggestions));
  }

  private async generateSql(
    input: ModelingAgentRequest,
    context: ModelingContext,
  ): Promise<Record<string, string>> {
    const shouldGenerate = Boolean(
      input.generateSql ||
        (input.sqlPlatforms && input.sqlPlatforms.length > 0) ||
        input.targetDatabase,
    );

    if (!shouldGenerate) {
      return {};
    }

    const physical = context.physical;
    if (!physical) {
      return {};
    }

    const objects = physical.entities.map((entity) => entity.object);
    const attributes = physical.entities.flatMap((entity) => entity.attributes);
    const relationships = physical.relationships;

    const sql = await this.exportService.exportModel(
      physical.model,
      objects,
      attributes,
      relationships,
      {
        format: "sql_ddl",
        layer: "physical",
        includePrimaryKeys: true,
        includeForeignKeys: true,
        includeConstraints: true,
        includeMetadata: false,
        includeDescriptions: true,
        includeLegend: false,
        includeTitle: false,
        includeTimestamp: false,
      },
    );

    const platforms = input.sqlPlatforms?.length
      ? input.sqlPlatforms
      : input.targetDatabase
      ? [input.targetDatabase]
      : ["generic"];

    const result: Record<string, string> = {};
    for (const platform of platforms) {
      result[platform.toLowerCase()] = sql;
    }

    return result;
  }

  private formatConceptual(context: ModelingContext): ConceptualModelResponse {
    const layer = context.conceptual;
    if (!layer) {
      return { entities: [] };
    }

    return {
      entities: layer.entities.map((entity) => {
        const relationships = layer.relationships.filter(
          (relationship) =>
            relationship.relationshipLevel === "object" &&
            entity.dataModelObject &&
            relationship.sourceModelObjectId === entity.dataModelObject.id,
        );

        return {
          name: entity.object.name,
          description: entity.object.description ?? null,
          relationships: relationships.map((relationship) => {
            const target = layer.entities.find(
              (candidate) => candidate.dataModelObject?.id === relationship.targetModelObjectId,
            );
            return {
              target: target?.object.name ?? `object_${relationship.targetModelObjectId}`,
              type: relationship.type,
              description: relationship.description ?? null,
            };
          }),
        };
      }),
    };
  }

  private formatLogical(context: ModelingContext): LogicalModelResponse {
    const layer = context.logical;
    if (!layer) {
      return { entities: [] };
    }

    return {
      entities: layer.entities.map((entity) => ({
        name: entity.object.name,
        description: entity.object.description ?? null,
        attributes: entity.attributes.map((attribute) => ({
          name: attribute.name,
          conceptualType: attribute.conceptualType ?? null,
          logicalType: attribute.logicalType ?? null,
          physicalType: attribute.physicalType ?? null,
          nullable: attribute.nullable ?? true,
          isPrimaryKey: attribute.isPrimaryKey ?? false,
          isForeignKey: attribute.isForeignKey ?? false,
          description: attribute.description ?? null,
        })),
      })),
    };
  }

  private formatPhysical(context: ModelingContext): LogicalModelResponse {
    const layer = context.physical;
    if (!layer) {
      return { entities: [] };
    }

    return {
      entities: layer.entities.map((entity) => ({
        name: entity.object.name,
        description: entity.object.description ?? null,
        attributes: entity.attributes.map((attribute) => ({
          name: attribute.name,
          conceptualType: attribute.conceptualType ?? null,
          logicalType: attribute.logicalType ?? null,
          physicalType: attribute.physicalType ?? null,
          nullable: attribute.nullable ?? true,
          isPrimaryKey: attribute.isPrimaryKey ?? false,
          isForeignKey: attribute.isForeignKey ?? false,
          description: attribute.description ?? null,
        })),
      })),
    };
  }
}

export const modelingAgentService = new ModelingAgentService();
