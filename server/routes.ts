import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticationMiddleware } from "./middleware/auth";
import { authService } from "./services/authService";
import { signAuthToken } from "./auth/jwt";
import { aiEngine } from "./services/aiEngine";
import { dataConnectors } from "./services/dataConnectors";
import { generateHeuristicForeignKeys } from "./services/relationshipHeuristics";
import { exportService } from "./services/exportService";
import { modelingAgentService } from "./services/modelingAgent";
import { getTargetSystemTemplate } from "./services/targetSystemTemplates";
import multer from "multer";
import { z } from "zod";

// Import schemas and types from utils
import {
  configurationUpdateSchema,
  systemObjectUpdateSchema,
  systemSyncRequestSchema,
  modelingAgentRequestSchema,
  relationshipTypeEnum,
  createRelationshipRequestSchema,
  updateRelationshipRequestSchema,
  positionSchema,
  modelObjectConfigSchema,
  perLayerModelObjectConfigSchema,
  attributeInputSchema,
  relationshipInputSchema,
  type AttributeInput,
  type RelationshipInput,
  type ModelObjectConfigInput,
  type SystemObjectDirection,
  type RelationshipLevel,
  type ModelLayer,
} from "./utils/validation_schemas";

// Import model utilities
import {
  mapConceptualToLogicalType,
  findConceptualRoot,
  resolveModelFamily,
  findDataModelAttributeId,
  mergeLayerConfig,
  replicateObjectToLayer,
  type LayerCreationResult,
  type ModelFamily,
} from "./utils/model_utils";

// Import relationship utilities
import {
  determineRelationshipLevel,
  buildRelationshipKey,
  findMatchingDataObjectRelationship,
  synchronizeFamilyRelationships,
  removeFamilyRelationships,
  type RelationshipSyncInput,
} from "./utils/relationship_utils";

// Import system utilities
import {
  coerceNumericId,
  extractPreferredDomainId,
  extractPreferredDataAreaIds,
  mapToDatabaseConnectorType,
  parseConnectionString,
  buildDatabaseConfig,
  buildAdlsConfig,
  testSystemConnectivity,
  retrieveSystemMetadata,
} from "./utils/system_utils";

// Import configuration utilities
import { upsertConfigurationEntry } from "./utils/configuration_utils";

// Import route helpers
import {
  parseOptionalNumber,
  parseRequiredNumber,
  resolveDomainAndArea,
  handleError,
  extractErrorMessage,
  isZodError,
} from "./utils/route_helpers";

// Import model handlers
import {
  createModelWithLayers,
  type CreateModelWithLayersInput,
} from "./utils/model_handlers";

// Import system sync handlers
import {
  syncSystemObjects,
  type SyncSystemObjectsInput,
} from "./utils/system_sync_handlers";

// Import object handlers
import {
  createDataObjectWithCascade,
  deleteDataObjectCascade,
  type CreateObjectInput,
} from "./utils/object_handlers";

// Import user object handlers (for UI-created objects without system sync)
import {
  createUserObject,
  updateUserObject,
  deleteUserObject,
  type UserObjectInput,
} from "./utils/user_object_handlers";

// Import export handlers
import {
  exportModelData,
  generateSVGDiagram,
} from "./utils/export_handlers";

// Import AI handlers
import {
  executeModelingAgent,
  suggestDomainClassification,
  suggestRelationshipsForModel,
  suggestTypeMappings,
  suggestNormalizationImprovements,
} from "./utils/ai_handlers";

// Import relationship handlers
import {
  createRelationship,
  updateRelationship,
  deleteRelationship,
} from "./utils/relationship_handlers";

// Import attribute handlers
import {
  getAllAttributes,
  createAttribute,
  updateAttributeWithCascade,
  deleteAttribute,
  enhanceAttribute,
  bulkEnhanceAttributes,
  mapLogicalToPhysicalType,
  getDefaultLength,
} from "./utils/attribute_handlers";

// Import object generation handlers
import {
  generateNextLayerObject,
  generateLogicalObject,
  generatePhysicalObject,
  type GenerateNextLayerInput,
} from "./utils/object_generation_handlers";

// Import schema types
import { 
  insertDataModelLayerSchema,
  insertDataDomainSchema,
  insertDataAreaSchema,
  insertDataObjectSchema,
  insertAttributeSchema,
  insertDataObjectRelationshipSchema,
  insertDataModelObjectRelationshipSchema,
  insertSystemSchema,
  insertConfigurationSchema,
  type DataModel,
  type DataModelLayer,
  type DataModelObject,
  type DataModelObjectAttribute,
  type DataModelObjectRelationship,
  type DataModelProperty,
  type DataObject,
  type DataDomain,
  type DataArea,
  type DataObjectRelationship,
  type Attribute,
  type System,
  type InsertDataObject,
  type InsertAttribute,
  type InsertDataModelObject,
  type InsertDataModelObjectAttribute,
  type InsertDataObjectRelationship
} from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  const loginSchema = z.object({
    identifier: z.string().min(3, "User ID is required"),
    password: z.string().min(6, "Password is required"),
  });

  const registerSchema = z
    .object({
      organizationName: z.string().min(3, "Organization name is required"),
      organizationSlug: z
        .string()
        .regex(/^[a-z0-9-]+$/i, "Slug may contain letters, numbers, and dashes")
        .min(3, "Slug must be at least 3 characters")
        .max(64, "Slug is too long")
        .optional(),
      email: z.string().email("Valid email is required"),
      password: z.string().min(8, "Password must be at least 8 characters"),
      userName: z.string().min(1, "Name is required").max(120, "Name is too long").optional(),
    })
    .strict();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = loginSchema.parse(req.body);
      const result = await authService.authenticateWithPassword(identifier, password);

      if (!result) {
        return res.status(401).json({ message: "Invalid user ID or password" });
      }

      const roles = result.memberships.map((membership) => membership.role);
      const context = {
        userId: result.user.id,
        organizationId: result.user.organizationId,
        roles,
        isSuperAdmin: Boolean(result.user.isSuperAdmin),
      };

      const token = signAuthToken(context);

      res.json({
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          isSuperAdmin: result.user.isSuperAdmin,
        },
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
        },
        roles,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid login payload", errors: error.flatten() });
        return;
      }
      console.error("Login failed", error);
      res.status(500).json({ message: "Failed to authenticate user" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const payload = registerSchema.parse(req.body);
      const result = await authService.registerAccount({
        organizationName: payload.organizationName,
        organizationSlug: payload.organizationSlug,
        email: payload.email,
        password: payload.password,
        userName: payload.userName,
      });

      const roles = result.memberships.map((membership) => membership.role);
      const context = {
        userId: result.user.id,
        organizationId: result.user.organizationId,
        roles,
        isSuperAdmin: Boolean(result.user.isSuperAdmin),
      };

      const token = signAuthToken(context);

      res.status(201).json({
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          isSuperAdmin: result.user.isSuperAdmin,
        },
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
        },
        roles,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid registration payload", errors: error.flatten() });
        return;
      }

      const message = error instanceof Error ? error.message : "Registration failed";
      const statusCode = message.includes("already exists") ? 409 : 500;
      console.error("Registration failed", error);
      res.status(statusCode).json({ message });
    }
  });

  app.use(authenticationMiddleware);

  app.post("/api/auth/logout", async (_req, res) => {
    res.status(204).send();
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.auth) {
        return res.status(401).json({ message: "Unauthenticated" });
      }

      const profile = await authService.getUserProfile(req.auth.userId);
      if (!profile) {
        return res.status(404).json({ message: "User not found" });
      }

      const roles = profile.memberships.map((membership) => membership.role);
      res.json({
        user: {
          id: profile.user.id,
          email: profile.user.email,
          name: profile.user.name,
          isSuperAdmin: profile.user.isSuperAdmin,
        },
        organization: {
          id: profile.organization.id,
          name: profile.organization.name,
          slug: profile.organization.slug,
        },
        roles,
      });
    } catch (error) {
      console.error("Failed to load authenticated profile", error);
      res.status(500).json({ message: "Failed to load authenticated profile" });
    }
  });

  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getDataModelLayers();
      res.json(models);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch models" });
    }
  });

  app.get("/api/models/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const model = await storage.getDataModelLayer(id);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
      }
      res.json(model);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch model" });
    }
  });

  app.post("/api/models", async (req, res) => {
    try {
      const validatedData = insertDataModelLayerSchema.parse(req.body);
      const model = await storage.createDataModelLayer(validatedData);
      res.status(201).json(model);
    } catch (error) {
      res.status(400).json({ message: "Invalid model data" });
    }
  });

  // Create model with all 4 layers (Flow, Conceptual, Logical, Physical)
  app.post("/api/models/create-with-layers", async (req, res) => {
    try {
      const input: CreateModelWithLayersInput = req.body;
      const result = await createModelWithLayers(input, storage);
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating model with layers:", error);
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.put("/api/models/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDataModelLayerSchema.partial().parse(req.body);
      const model = await storage.updateDataModelLayer(id, validatedData);
      res.json(model);
    } catch (error) {
      res.status(400).json({ message: "Failed to update model" });
    }
  });

  app.delete("/api/models/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDataModelLayer(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete model" });
    }
  });

  // Data Domains
  app.get("/api/domains", async (req, res) => {
    try {
      const domains = await storage.getDataDomains();
      res.json(domains);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch domains" });
    }
  });

  app.post("/api/domains", async (req, res) => {
    try {
      console.log("Creating domain with data:", req.body);
      const validatedData = insertDataDomainSchema.parse(req.body);
      const domain = await storage.createDataDomain(validatedData);
      res.status(201).json(domain);
    } catch (error: any) {
      console.error("Domain creation error:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          message: "Invalid domain data", 
          details: error.errors,
          errors: error.errors 
        });
      } else if (error.code === '23505' || error.message?.includes('UNIQUE constraint failed') || error.message?.includes('duplicate key')) {
        res.status(409).json({ 
          message: "Domain name already exists", 
          details: "A domain with this name already exists. Please choose a different name."
        });
      } else {
        res.status(500).json({ 
          message: error.message || "Failed to create domain" 
        });
      }
    }
  });

  app.patch("/api/domains/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDataDomainSchema.partial().parse(req.body);
      const domain = await storage.updateDataDomain(id, validatedData);
      res.json(domain);
    } catch (error) {
      res.status(400).json({ message: "Failed to update domain" });
    }
  });

  // PUT endpoint for /api/domains/:id (full update)
  app.put("/api/domains/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("Updating domain", id, "with data:", req.body);
      const validatedData = insertDataDomainSchema.parse(req.body);
      const domain = await storage.updateDataDomain(id, validatedData);
      res.json(domain);
    } catch (error: any) {
      console.error("Failed to update domain:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          message: "Invalid domain data", 
          details: error.errors,
          errors: error.errors 
        });
      } else if (error.code === '23505' || error.message?.includes('UNIQUE constraint failed') || error.message?.includes('duplicate key')) {
        res.status(409).json({ 
          message: "Domain name already exists", 
          details: "A domain with this name already exists. Please choose a different name."
        });
      } else {
        res.status(500).json({ 
          message: error.message || "Failed to update domain" 
        });
      }
    }
  });

  // DELETE endpoint for /api/domains/:id
  app.delete("/api/domains/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDataDomain(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete domain:", error);
      res.status(500).json({ message: "Failed to delete domain" });
    }
  });

  // Data Areas
  app.get("/api/domains/:domainId/areas", async (req, res) => {
    try {
      const domainParam = req.params.domainId;
      let domainId: number;
      
      // Check if domainParam is a number or a domain name
      if (isNaN(parseInt(domainParam))) {
        // It's a domain name, find the domain by name
        const domain = await storage.getDataDomainByName(domainParam);
        if (!domain) {
          return res.status(404).json({ message: "Domain not found" });
        }
        domainId = domain.id;
      } else {
        // It's a numeric domain ID
        domainId = parseInt(domainParam);
      }
      
      const areas = await storage.getDataAreasByDomain(domainId);
      res.json(areas);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch data areas" });
    }
  });

  app.get("/api/areas", async (req, res) => {
    try {
      const areas = await storage.getDataAreas();
      res.json(areas);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch areas" });
    }
  });

  // Alias for data areas
  app.get("/api/data-areas", async (req, res) => {
    try {
      const areas = await storage.getDataAreas();
      res.json(areas);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch data areas" });
    }
  });

  app.post("/api/areas", async (req, res) => {
    try {
      const validatedData = insertDataAreaSchema.parse(req.body);
      const area = await storage.createDataArea(validatedData);
      res.status(201).json(area);
    } catch (error) {
      res.status(400).json({ message: "Invalid area data" });
    }
  });

  app.patch("/api/areas/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDataAreaSchema.partial().parse(req.body);
      const area = await storage.updateDataArea(id, validatedData);
      res.json(area);
    } catch (error) {
      res.status(400).json({ message: "Failed to update area" });
    }
  });

  app.delete("/api/areas/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDataArea(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete area:", error);
      res.status(500).json({ message: "Failed to delete area" });
    }
  });

  // Data Objects
  app.get("/api/models/:modelId/objects", async (req, res) => {
    try {
      const modelId = parseInt(req.params.modelId);
      const objects = await storage.getDataObjectsByModel(modelId);
      res.json(objects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch objects" });
    }
  });

  // Add existing object to a model (creates data_model_object entry)
  app.post("/api/models/:modelId/objects", async (req, res) => {
    try {
      const modelId = parseInt(req.params.modelId);
      const { objectId, position, targetSystem, isVisible, layerSpecificConfig } = req.body;
      
      if (!objectId || typeof objectId !== 'number') {
        return res.status(400).json({ message: "Valid objectId is required" });
      }
      
      // Check if object already exists in this specific model
      const existingModelObjects = await storage.getDataModelObjects();
      const existingEntry = existingModelObjects.find(mo => mo.objectId === objectId && mo.modelId === modelId);
      
      if (existingEntry) {
        return res.status(409).json({ message: "Object already exists in this model" });
      }
      
      // Verify the object exists globally
      const globalObject = await storage.getDataObject(objectId);
      if (!globalObject) {
        return res.status(404).json({ message: "Object not found" });
      }
      
      // Create the data model object entry
      const dataModelObject = await storage.createDataModelObject({
        objectId,
        modelId,
        targetSystemId: targetSystem || null,
        position: position || null,
        metadata: {},
        isVisible: isVisible !== undefined ? isVisible : true,
        layerSpecificConfig: layerSpecificConfig || {}
      });
      
      // CRITICAL FIX: Create attribute projections for this model object
      // Get canonical attributes for the data object
      const canonicalAttributes = await storage.getAttributesByObject(objectId);
      
      // Create data_model_object_attributes for each canonical attribute
      for (const canonicalAttr of canonicalAttributes) {
        await storage.createDataModelObjectAttribute({
          attributeId: canonicalAttr.id,
          modelObjectId: dataModelObject.id,
          modelId: modelId,
          name: canonicalAttr.name,
          description: canonicalAttr.description ?? undefined,
          dataType: canonicalAttr.dataType ?? undefined,
          conceptualType: canonicalAttr.conceptualType ?? undefined,
          logicalType: canonicalAttr.logicalType ?? undefined,
          physicalType: canonicalAttr.physicalType ?? undefined,
          length: canonicalAttr.length ?? undefined,
          precision: canonicalAttr.precision ?? undefined,
          scale: canonicalAttr.scale ?? undefined,
          nullable: canonicalAttr.nullable ?? true,
          isPrimaryKey: canonicalAttr.isPrimaryKey ?? false,
          isForeignKey: canonicalAttr.isForeignKey ?? false,
          orderIndex: canonicalAttr.orderIndex ?? 0,
          layerSpecificConfig: {},
        });
      }
      
      console.log(`✅ Created data_model_object and ${canonicalAttributes.length} attribute projections for object ${objectId} in model ${modelId}`);
      
      res.status(201).json(dataModelObject);
    } catch (error) {
      console.error("Error adding object to model:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;
      console.error("Error details:", {
        modelId: req.params.modelId,
        objectId: req.body.objectId,
        error: message,
        stack,
      });
      res.status(500).json({ 
        message: "Failed to add object to model",
        error: message 
      });
    }
  });

  app.get("/api/objects", async (req, res) => {
    try {
      const objects = await storage.getAllDataObjects();

      // Enhance objects with resolved names for domain, dataArea, and owning system
      const enhancedObjects = await Promise.all(
        objects.map(async (obj) => {
          let domainName: string | undefined;
          let dataAreaName: string | undefined;
          let systemName: string | undefined;

          if (obj.domainId) {
            const domain = await storage.getDataDomain(obj.domainId);
            domainName = domain?.name;
          }

          if (obj.dataAreaId) {
            const dataArea = await storage.getDataArea(obj.dataAreaId);
            dataAreaName = dataArea?.name;
          }

          if (obj.systemId) {
            const system = await storage.getSystem(obj.systemId);
            systemName = system?.name;
          }

          return {
            ...obj,
            domainName,
            dataAreaName,
            system: systemName,
          };
        })
      );

      res.json(enhancedObjects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch all objects" });
    }
  });

  app.get("/api/objects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // First, try to find in data_model_objects (user-created objects)
      const modelObject = await storage.getDataModelObject(id);
      
      if (modelObject) {
        // User-created object - fetch attributes from data_model_attributes
        const allModelAttributes = await storage.getDataModelObjectAttributes();
        const attributes = allModelAttributes.filter(attr => attr.modelObjectId === id);
        
        // Get domain and area names
        let domainName, dataAreaName;
        if (modelObject.domainId) {
          const domain = await storage.getDataDomain(modelObject.domainId);
          domainName = domain?.name;
        }
        if (modelObject.dataAreaId) {
          const area = await storage.getDataArea(modelObject.dataAreaId);
          dataAreaName = area?.name;
        }
        
        return res.json({
          id: modelObject.id,
          name: modelObject.name,
          description: modelObject.description,
          objectType: modelObject.objectType,
          domainId: modelObject.domainId,
          domainName,
          dataAreaId: modelObject.dataAreaId,
          dataAreaName,
          sourceSystemId: modelObject.sourceSystemId,
          targetSystemId: modelObject.targetSystemId,
          metadata: modelObject.metadata,
          attributes: attributes.map(attr => ({
            id: attr.id,
            name: attr.name,
            description: attr.description,
            dataType: attr.dataType,
            conceptualType: attr.conceptualType,
            logicalType: attr.logicalType,
            physicalType: attr.physicalType,
            nullable: attr.nullable,
            isPrimaryKey: attr.isPrimaryKey,
            isForeignKey: attr.isForeignKey,
            length: attr.length,
            precision: attr.precision,
            scale: attr.scale,
            orderIndex: attr.orderIndex,
          })),
          isUserCreated: true,
        });
      }
      
      // If not found in data_model_objects, try data_objects (system-synced objects)
      const object = await storage.getDataObject(id);
      if (!object) {
        return res.status(404).json({ message: "Object not found" });
      }
      
      // System-synced object - fetch attributes from attributes table
      const attributes = await storage.getAttributesByObject(id);
      
      res.json({
        ...object,
        attributes,
        isUserCreated: false,
      });
    } catch (error) {
      console.error("Error fetching object:", error);
      res.status(500).json({ message: "Failed to fetch object" });
    }
  });

  app.post("/api/objects", async (req, res) => {
    try {
      console.log("Received object creation request:", req.body);
      
      // Use new user_object_handlers - creates only data_model_objects entries
      // data_objects table is reserved for system sync only
      const input: UserObjectInput = req.body;
      const result = await createUserObject(input, storage);
      
      res.status(201).json({
        success: true,
        modelObject: result.modelObject,
        attributes: result.attributes,
      });
    } catch (error) {
      console.error("Error creating object:", error);
      if ((error as any).errors) {
        console.error("Validation errors:", (error as any).errors);
      }
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.put("/api/objects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if this is a user-created object
      const modelObject = await storage.getDataModelObject(id);
      
      if (modelObject) {
        // User-created object - update in data_model_objects
        const updateData = {
          name: req.body.name ?? modelObject.name,
          description: req.body.description ?? modelObject.description,
          objectType: req.body.objectType ?? modelObject.objectType,
          domainId: req.body.domainId !== undefined ? req.body.domainId : modelObject.domainId,
          dataAreaId: req.body.dataAreaId !== undefined ? req.body.dataAreaId : modelObject.dataAreaId,
          sourceSystemId: req.body.sourceSystemId !== undefined ? req.body.sourceSystemId : modelObject.sourceSystemId,
          targetSystemId: req.body.targetSystemId !== undefined ? req.body.targetSystemId : modelObject.targetSystemId,
        };
        
        const updated = await storage.updateDataModelObject(id, updateData);
        return res.json(updated);
      }
      
      // System-synced object - update in data_objects
      const validatedData = insertDataObjectSchema.partial().parse(req.body);
      const object = await storage.updateDataObject(id, validatedData);
      res.json(object);
    } catch (error) {
      console.error("Error updating object:", error);
      res.status(400).json({ message: "Failed to update object" });
    }
  });

  app.delete("/api/objects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await deleteDataObjectCascade(id, storage);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting object:", error);
      res.status(500).json({ message: "Failed to delete object" });
    }
  });

  // Layer-to-Layer Object Generation
  // Generate object in next layer (Conceptual → Logical or Logical → Physical)
  app.post("/api/objects/:id/generate-next-layer", async (req, res) => {
    try {
      const sourceObjectId = parseInt(req.params.id);
      const { targetModelId, config } = req.body;

      const input: GenerateNextLayerInput = {
        sourceObjectId,
        targetModelId: targetModelId ? parseInt(targetModelId) : undefined,
        config: config || {},
      };

      const result = await generateNextLayerObject(input, storage);

      res.status(201).json({
        success: true,
        message: `Successfully generated ${result.targetLayer} object from ${result.sourceModel.layer} object`,
        data: {
          sourceObject: result.sourceObject,
          sourceModel: result.sourceModel,
          targetLayer: result.targetLayer,
          targetModel: result.model,
          createdObject: result.object,
          createdModelObject: result.modelObject,
          attributes: result.attributes,
          dataModelAttributes: result.dataModelAttributes,
        },
      });
    } catch (error) {
      console.error("Error generating next layer object:", error);
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  // Generate logical object from conceptual object
  app.post("/api/objects/:id/generate-logical", async (req, res) => {
    try {
      const sourceObjectId = parseInt(req.params.id);
      const { targetModelId, config } = req.body;

      const result = await generateLogicalObject(
        sourceObjectId,
        targetModelId ? parseInt(targetModelId) : undefined,
        config,
        storage
      );

      res.status(201).json({
        success: true,
        message: "Successfully generated logical object from conceptual object",
        data: {
          sourceObject: result.sourceObject,
          sourceModel: result.sourceModel,
          targetModel: result.model,
          createdObject: result.object,
          createdModelObject: result.modelObject,
          attributes: result.attributes,
          dataModelAttributes: result.dataModelAttributes,
        },
      });
    } catch (error) {
      console.error("Error generating logical object:", error);
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  // Generate physical object from logical object
  app.post("/api/objects/:id/generate-physical", async (req, res) => {
    try {
      const sourceObjectId = parseInt(req.params.id);
      const { targetModelId, config } = req.body;

      const result = await generatePhysicalObject(
        sourceObjectId,
        targetModelId ? parseInt(targetModelId) : undefined,
        config,
        storage
      );

      res.status(201).json({
        success: true,
        message: "Successfully generated physical object from logical object",
        data: {
          sourceObject: result.sourceObject,
          sourceModel: result.sourceModel,
          targetModel: result.model,
          createdObject: result.object,
          createdModelObject: result.modelObject,
          attributes: result.attributes,
          dataModelAttributes: result.dataModelAttributes,
        },
      });
    } catch (error) {
      console.error("Error generating physical object:", error);
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  // Attributes  
  app.get("/api/objects/:objectId/attributes", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      console.log('Fetching attributes for objectId:', objectId);
      
      // First check if this is a user-created object (exists in data_model_objects)
      const modelObject = await storage.getDataModelObject(objectId);
      
      if (modelObject) {
        // User-created object - fetch from data_model_attributes by modelObjectId
        const allModelAttributes = await storage.getDataModelObjectAttributes();
        const attributes = allModelAttributes.filter(attr => attr.modelObjectId === objectId);
        
        console.log('Found user-created attributes:', attributes);
        return res.json(attributes);
      }
      
      // System-synced object - fetch from attributes table by objectId
      const allAttributes = await storage.getAllAttributes();
      const objectAttributes = allAttributes.filter(attr => attr.objectId === objectId);
      
      console.log('Found system-synced attributes:', objectAttributes);
      res.json(objectAttributes);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      res.status(500).json({ message: "Failed to fetch attributes" });
    }
  });

  // Get all attributes
  app.get("/api/attributes", async (req, res) => {
    try {
      const attributes = await getAllAttributes(storage);
      res.json(attributes);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  // Create an attribute for a specific object
  app.post("/api/objects/:objectId/attributes", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      
      // Check if this is a user-created object
      const modelObject = await storage.getDataModelObject(objectId);
      
      if (modelObject) {
        // User-created object - create in data_model_attributes
        const attributePayload: InsertDataModelObjectAttribute = {
          attributeId: null, // NULL = user-created attribute
          modelObjectId: objectId,
          modelId: modelObject.modelId,
          name: req.body.name,
          description: req.body.description ?? null,
          dataType: req.body.dataType ?? null,
          conceptualType: req.body.conceptualType ?? null,
          logicalType: req.body.logicalType ?? null,
          physicalType: req.body.physicalType ?? null,
          length: req.body.length ?? null,
          precision: req.body.precision ?? null,
          scale: req.body.scale ?? null,
          nullable: req.body.nullable ?? true,
          isPrimaryKey: req.body.isPrimaryKey ?? false,
          isForeignKey: req.body.isForeignKey ?? false,
          orderIndex: req.body.orderIndex ?? 0,
          layerSpecificConfig: {},
        };
        
        const attribute = await storage.createDataModelObjectAttribute(attributePayload);
        return res.status(201).json(attribute);
      }
      
      // System-synced object - create in attributes table
      const attributeData = { ...req.body, objectId };
      const attribute = await createAttribute(attributeData, storage);
      res.status(201).json(attribute);
    } catch (error) {
      console.error('Error creating attribute:', error);
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.post("/api/attributes", async (req, res) => {
    try {
      const attribute = await createAttribute(req.body, storage);
      res.status(201).json(attribute);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  // Update an attribute with PATCH
  app.patch("/api/attributes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if this is a user-created attribute
      const modelAttribute = await storage.getDataModelAttribute(id);
      if (modelAttribute) {
        // Update in data_model_attributes (partial update)
        const updated = await storage.updateDataModelObjectAttribute(id, req.body);
        return res.json(updated);
      }
      
      // System-synced attribute - use cascade logic
      const attribute = await updateAttributeWithCascade(id, req.body, storage);
      res.json(attribute);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  // Get a specific attribute by ID
  app.get("/api/attributes/:id", async (req, res) => {
    try {
      const attributeId = parseInt(req.params.id);
      
      // First check data_model_attributes (user-created)
      const modelAttribute = await storage.getDataModelAttribute(attributeId);
      if (modelAttribute) {
        return res.json(modelAttribute);
      }
      
      // Then check attributes table (system-synced)
      const attribute = await storage.getAttribute(attributeId);
      if (!attribute) {
        return res.status(404).json({ error: "Attribute not found" });
      }
      res.json(attribute);
    } catch (error) {
      console.error("Error fetching attribute:", error);
      res.status(500).json({ error: "Failed to fetch attribute" });
    }
  });

  app.put("/api/attributes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if this is a user-created attribute
      const modelAttribute = await storage.getDataModelAttribute(id);
      if (modelAttribute) {
        // Update in data_model_attributes
        const updateData = {
          name: req.body.name ?? modelAttribute.name,
          description: req.body.description ?? modelAttribute.description,
          dataType: req.body.dataType ?? modelAttribute.dataType,
          conceptualType: req.body.conceptualType ?? modelAttribute.conceptualType,
          logicalType: req.body.logicalType ?? modelAttribute.logicalType,
          physicalType: req.body.physicalType ?? modelAttribute.physicalType,
          length: req.body.length ?? modelAttribute.length,
          precision: req.body.precision ?? modelAttribute.precision,
          scale: req.body.scale ?? modelAttribute.scale,
          nullable: req.body.nullable ?? modelAttribute.nullable,
          isPrimaryKey: req.body.isPrimaryKey ?? modelAttribute.isPrimaryKey,
          isForeignKey: req.body.isForeignKey ?? modelAttribute.isForeignKey,
          orderIndex: req.body.orderIndex ?? modelAttribute.orderIndex,
        };
        const updated = await storage.updateDataModelObjectAttribute(id, updateData);
        return res.json(updated);
      }
      
      // System-synced attribute - use cascade logic
      const attribute = await updateAttributeWithCascade(id, req.body, storage);
      res.json(attribute);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.delete("/api/attributes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if this is a user-created attribute
      const modelAttribute = await storage.getDataModelAttribute(id);
      if (modelAttribute) {
        // Delete from data_model_attributes
        await storage.deleteDataModelObjectAttribute(id);
        return res.status(204).send();
      }
      
      // System-synced attribute
      await deleteAttribute(id, storage);
      res.status(204).send();
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  // Auto-enhance attribute with layer-specific type mapping
  app.post("/api/attributes/:id/enhance", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { targetLayer } = req.body;
      const attribute = await enhanceAttribute(id, targetLayer, storage);
      res.json(attribute);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  // Bulk enhance attributes for an object
  app.post("/api/objects/:objectId/attributes/enhance", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      const { targetLayer } = req.body;
      const enhancedAttributes = await bulkEnhanceAttributes(objectId, targetLayer, storage);
      res.json(enhancedAttributes);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.get("/api/object-lake", async (req, res) => {
    try {
      const {
        search,
        domainId,
        dataAreaId,
        systemId,
        modelId,
        layer,
        objectType,
        hasAttributes,
        relationshipType,
        includeHidden,
        page = "1",
        pageSize = "50",
        sortBy = "name",
        sortOrder = "asc"
      } = req.query as Record<string, string | undefined>;

      const parseOptionalNumber = (value?: string): number | null => {
        if (!value) return null;
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const selectedDomainId = parseOptionalNumber(domainId);
      const selectedAreaId = parseOptionalNumber(dataAreaId);
      const selectedSystemId = parseOptionalNumber(systemId);
      const selectedModelId = parseOptionalNumber(modelId);
      const normalizedLayer = layer ? layer.toLowerCase() : null;
      const normalizedObjectType = objectType ? objectType.toLowerCase() : null;
      const hasAttributesFilter = typeof hasAttributes === "string"
        ? hasAttributes.toLowerCase() === "true"
          ? true
          : hasAttributes.toLowerCase() === "false"
            ? false
            : null
        : null;
      const normalizedRelationshipType = relationshipType ? relationshipType.toUpperCase() : null;
      const includeHiddenInstances = includeHidden?.toLowerCase() === "true";
      const pageNumber = Math.max(1, parseOptionalNumber(page) ?? 1);
      const pageSizeNumber = Math.min(200, Math.max(10, parseOptionalNumber(pageSize) ?? 50));
      const sortKey = ["name", "updatedAt", "attributeCount", "modelInstanceCount", "relationshipCount"].includes(sortBy ?? "")
        ? (sortBy as string)
        : "name";
      const sortDirection = sortOrder?.toLowerCase() === "desc" ? "desc" : "asc";

      const [
        objects,
        modelObjects,
        attributes,
        modelAttributes,
        relationships,
        modelRelationships,
        properties,
        systems,
        models,
        domains,
        areas
      ] = await Promise.all([
        storage.getAllDataObjects(),
        storage.getDataModelObjects(),
        storage.getAllAttributes(),
        storage.getDataModelObjectAttributes(),
        storage.getDataObjectRelationships(),
        storage.getDataModelObjectRelationships(),
        storage.getDataModelProperties(),
        storage.getSystems(),
        storage.getDataModelLayers(),
        storage.getDataDomains(),
        storage.getDataAreas()
      ]);

      const systemById = new Map<number, System>();
      systems.forEach((system) => {
        systemById.set(system.id, system);
      });

      const modelById = new Map<number, DataModelLayer>();
      models.forEach((model) => {
        modelById.set(model.id, model);
      });

      const domainById = new Map<number, DataDomain>();
      domains.forEach((domain) => {
        domainById.set(domain.id, domain);
      });

      const areaById = new Map<number, DataArea>();
      areas.forEach((area) => {
        areaById.set(area.id, area);
      });

      const attributesByObjectId = new Map<number, Attribute[]>();
      attributes.forEach((attr) => {
        const list = attributesByObjectId.get(attr.objectId) ?? [];
        list.push(attr);
        attributesByObjectId.set(attr.objectId, list);
      });

      const modelObjectsByObjectId = new Map<number, DataModelObject[]>();
      const modelObjectById = new Map<number, DataModelObject>();
      modelObjects.forEach((modelObject) => {
        modelObjectById.set(modelObject.id, modelObject);
        // Only add to objectId map if it's a system-synced object (has objectId)
        if (modelObject.objectId !== null) {
          const list = modelObjectsByObjectId.get(modelObject.objectId) ?? [];
          list.push(modelObject);
          modelObjectsByObjectId.set(modelObject.objectId, list);
        }
      });

      const modelAttributesByModelObjectId = new Map<number, DataModelObjectAttribute[]>();
      const modelAttributesByAttributeId = new Map<number, DataModelObjectAttribute[]>();
      modelAttributes.forEach((modelAttr) => {
        const listByModelObject = modelAttributesByModelObjectId.get(modelAttr.modelObjectId) ?? [];
        listByModelObject.push(modelAttr);
        modelAttributesByModelObjectId.set(modelAttr.modelObjectId, listByModelObject);

        // Only add to attributeId map if it's a system-synced attribute (has attributeId)
        if (modelAttr.attributeId !== null) {
          const listByAttribute = modelAttributesByAttributeId.get(modelAttr.attributeId) ?? [];
          listByAttribute.push(modelAttr);
          modelAttributesByAttributeId.set(modelAttr.attributeId, listByAttribute);
        }
      });

      const modelRelationshipsByModelObjectId = new Map<number, DataModelObjectRelationship[]>();
      modelRelationships.forEach((rel) => {
        const sourceList = modelRelationshipsByModelObjectId.get(rel.sourceModelObjectId) ?? [];
        sourceList.push(rel);
        modelRelationshipsByModelObjectId.set(rel.sourceModelObjectId, sourceList);

        const targetList = modelRelationshipsByModelObjectId.get(rel.targetModelObjectId) ?? [];
        targetList.push(rel);
        modelRelationshipsByModelObjectId.set(rel.targetModelObjectId, targetList);
      });

      const globalRelationshipsByObjectId = new Map<number, DataObjectRelationship[]>();
      relationships.forEach((rel) => {
        const sourceList = globalRelationshipsByObjectId.get(rel.sourceDataObjectId) ?? [];
        sourceList.push(rel);
        globalRelationshipsByObjectId.set(rel.sourceDataObjectId, sourceList);

        const targetList = globalRelationshipsByObjectId.get(rel.targetDataObjectId) ?? [];
        targetList.push(rel);
        globalRelationshipsByObjectId.set(rel.targetDataObjectId, targetList);
      });

      const propertiesByType = new Map<string, Map<number, DataModelProperty[]>>();
      const propertyTypeAliases: Record<string, string> = {
        object: "object",
        data_object: "object",
        dataobject: "object",
        "model-object": "model_object",
        model_object: "model_object",
        modelobject: "model_object",
        data_model_object: "model_object",
        attribute: "attribute",
        data_attribute: "attribute",
        dataattribute: "attribute"
      };

      const normalizePropertyType = (rawType: string): string => {
        const key = rawType.toLowerCase().replace(/\s+/g, "_");
        return propertyTypeAliases[key] ?? key;
      };

      properties.forEach((property) => {
        const typeKey = normalizePropertyType(property.entityType);
        const typeMap = propertiesByType.get(typeKey) ?? new Map<number, DataModelProperty[]>();
        const list = typeMap.get(property.entityId) ?? [];
        list.push(property);
        typeMap.set(property.entityId, list);
        propertiesByType.set(typeKey, typeMap);
      });

      const getPropertiesFor = (entityTypeKeys: string[], entityId: number): DataModelProperty[] => {
        const results: DataModelProperty[] = [];
        for (const key of entityTypeKeys) {
          const typeMap = propertiesByType.get(key);
          if (!typeMap) continue;
          const props = typeMap.get(entityId);
          if (props) {
            results.push(...props);
          }
        }
        return results;
      };

      type ObjectLakeModelAttribute = {
        id: number;
        modelId: number;
        modelObjectId: number;
        conceptualType: string | null;
        logicalType: string | null;
        physicalType: string | null;
        nullable: boolean | null;
        isPrimaryKey: boolean | null;
        isForeignKey: boolean | null;
        orderIndex: number | null;
        layerSpecificConfig: Record<string, any> | null;
      };

      type ObjectLakeRelationship = {
        id: number;
        modelId: number | null;
        layer: string | null;
        sourceModelObjectId: number | null;
        targetModelObjectId: number | null;
        type: string;
        relationshipLevel: string;
        name: string | null;
        description: string | null;
      };

      type ObjectLakeObject = {
        id: number;
        name: string;
        description: string | null;
        objectType: string | null;
        domain: DataDomain | null;
        dataArea: DataArea | null;
        sourceSystem: System | null;
        targetSystem: System | null;
        baseModel: DataModelLayer | null;
        baseMetadata: {
          position?: Record<string, any> | null;
          metadata?: Record<string, any> | null;
          commonProperties?: Record<string, any> | null;
        };
        stats: {
          attributeCount: number;
          relationshipCount: number;
          modelInstanceCount: number;
          lastUpdated: string | null;
        };
        modelInstances: Array<{
          id: number;
          model: DataModelLayer | null;
          targetSystem: System | null;
          position: Record<string, any> | null;
          metadata: Record<string, any> | null;
          isVisible: boolean;
          layerSpecificConfig: Record<string, any> | null;
          properties: DataModelProperty[];
          attributes: ObjectLakeModelAttribute[];
          relationships: ObjectLakeRelationship[];
        }>;
        attributes: Array<{
          id: number;
          name: string;
          description: string | null;
          nullable: boolean;
          isPrimaryKey: boolean;
          isForeignKey: boolean;
          dataType: string | null;
          conceptualType: string | null;
          logicalType: string | null;
          physicalType: string | null;
          length: number | null;
          precision: number | null;
          scale: number | null;
          orderIndex: number | null;
          commonProperties: Record<string, any> | null;
          metadataByModel: Record<number, ObjectLakeModelAttribute>;
          properties: DataModelProperty[];
        }>;
        relationships: {
          global: ObjectLakeRelationship[];
          modelSpecific: ObjectLakeRelationship[];
        };
        properties: DataModelProperty[];
        tags: string[];
        updatedAt: string | null;
      };

      const buildModelRelationshipSummary = (rel: DataModelObjectRelationship): ObjectLakeRelationship => ({
        id: rel.id,
        modelId: rel.modelId,
        layer: rel.layer,
        sourceModelObjectId: rel.sourceModelObjectId,
        targetModelObjectId: rel.targetModelObjectId,
        type: rel.type,
        relationshipLevel: rel.relationshipLevel,
        name: rel.name ?? null,
        description: rel.description ?? null
      });

      const buildGlobalRelationshipSummary = (rel: DataObjectRelationship): ObjectLakeRelationship => ({
        id: rel.id,
        modelId: null,
        layer: null,
        sourceModelObjectId: null,
        targetModelObjectId: null,
        type: rel.type,
        relationshipLevel: rel.relationshipLevel,
        name: rel.name ?? null,
        description: rel.description ?? null
      });

      const enrichedObjects: ObjectLakeObject[] = objects.map((object) => {
        const attributeList = attributesByObjectId.get(object.id) ?? [];
        const globalRels = globalRelationshipsByObjectId.get(object.id) ?? [];
        const instanceListRaw = modelObjectsByObjectId.get(object.id) ?? [];
        const visibleInstances = includeHiddenInstances
          ? instanceListRaw
          : instanceListRaw.filter((instance) => instance.isVisible !== false);

        const modelInstances = visibleInstances.map((instance) => {
          const instanceModel = modelById.get(instance.modelId) ?? null;
          const targetSystem = instance.targetSystemId ? systemById.get(instance.targetSystemId) ?? null : null;
          const instanceAttributes = modelAttributesByModelObjectId.get(instance.id) ?? [];
          const instanceRelationships = modelRelationshipsByModelObjectId.get(instance.id) ?? [];

          const detailedAttributes: ObjectLakeModelAttribute[] = instanceAttributes.map((modelAttr) => ({
            id: modelAttr.id,
            modelId: modelAttr.modelId,
            modelObjectId: modelAttr.modelObjectId,
            conceptualType: modelAttr.conceptualType ?? null,
            logicalType: modelAttr.logicalType ?? null,
            physicalType: modelAttr.physicalType ?? null,
            nullable: modelAttr.nullable ?? null,
            isPrimaryKey: modelAttr.isPrimaryKey ?? null,
            isForeignKey: modelAttr.isForeignKey ?? null,
            orderIndex: modelAttr.orderIndex ?? null,
            layerSpecificConfig: modelAttr.layerSpecificConfig ?? null
          }));

          const detailedRelationships = instanceRelationships.map(buildModelRelationshipSummary);

          return {
            id: instance.id,
            model: instanceModel,
            targetSystem,
            position: instance.position ?? null,
            metadata: instance.metadata ?? null,
            isVisible: instance.isVisible ?? true,
            layerSpecificConfig: instance.layerSpecificConfig ?? null,
            properties: getPropertiesFor(["model_object"], instance.id),
            attributes: detailedAttributes,
            relationships: detailedRelationships
          };
        });

        const attributeSummaries = attributeList.map((attr) => {
          const metadataMap: Record<number, ObjectLakeModelAttribute> = {};
          const overrides = modelAttributesByAttributeId.get(attr.id) ?? [];
          overrides.forEach((override) => {
            metadataMap[override.modelId] = {
              id: override.id,
              modelId: override.modelId,
              modelObjectId: override.modelObjectId,
              conceptualType: override.conceptualType ?? null,
              logicalType: override.logicalType ?? null,
              physicalType: override.physicalType ?? null,
              nullable: override.nullable ?? null,
              isPrimaryKey: override.isPrimaryKey ?? null,
              isForeignKey: override.isForeignKey ?? null,
              orderIndex: override.orderIndex ?? null,
              layerSpecificConfig: override.layerSpecificConfig ?? null
            };
          });

          return {
            id: attr.id,
            name: attr.name,
            description: attr.description ?? null,
            nullable: attr.nullable ?? true,
            isPrimaryKey: attr.isPrimaryKey ?? false,
            isForeignKey: attr.isForeignKey ?? false,
            dataType: attr.dataType ?? null,
            conceptualType: attr.conceptualType ?? null,
            logicalType: attr.logicalType ?? null,
            physicalType: attr.physicalType ?? null,
            length: attr.length ?? null,
            precision: attr.precision ?? null,
            scale: attr.scale ?? null,
            orderIndex: attr.orderIndex ?? null,
            commonProperties: attr.commonProperties ?? null,
            metadataByModel: metadataMap,
            properties: getPropertiesFor(["attribute"], attr.id)
          };
        });

        const modelSpecificRelationships = modelInstances.flatMap((instance) => instance.relationships);
        const globalRelationshipSummaries = globalRels.map(buildGlobalRelationshipSummary);

        const domain = object.domainId ? domainById.get(object.domainId) ?? null : null;
        const dataArea = object.dataAreaId ? areaById.get(object.dataAreaId) ?? null : null;
        const baseModel =
          modelInstances.find((instance) => instance.model?.layer === "conceptual")?.model ??
          modelInstances[0]?.model ??
          null;
        const owningSystem = object.systemId ? systemById.get(object.systemId) ?? null : null;

        const stats = {
          attributeCount: attributeSummaries.length,
          relationshipCount: globalRelationshipSummaries.length + modelSpecificRelationships.length,
          modelInstanceCount: modelInstances.length,
          lastUpdated: object.updatedAt ? new Date(object.updatedAt).toISOString() : null
        };

        const tags = [object.objectType, domain?.name, dataArea?.name, owningSystem?.name]
          .filter((value): value is string => Boolean(value));

        return {
          id: object.id,
          name: object.name,
          description: object.description ?? null,
          objectType: object.objectType ?? null,
          domain,
          dataArea,
          system: owningSystem,
          baseModel,
          baseMetadata: {
            position: object.position ?? null,
            metadata: object.metadata ?? null,
            commonProperties: object.commonProperties ?? null
          },
          stats,
          modelInstances,
          attributes: attributeSummaries,
          relationships: {
            global: globalRelationshipSummaries,
            modelSpecific: modelSpecificRelationships
          },
          properties: getPropertiesFor(["object"], object.id),
          tags,
          updatedAt: stats.lastUpdated
        };
      });

      const filteredObjects = enrichedObjects.filter((object) => {
        if (search) {
          const searchValue = search.toLowerCase();
          const matchesSearch =
            object.name.toLowerCase().includes(searchValue) ||
            (object.description?.toLowerCase().includes(searchValue) ?? false) ||
            (object.system?.name.toLowerCase().includes(searchValue) ?? false) ||
            object.tags.some((tag) => tag.toLowerCase().includes(searchValue));
          if (!matchesSearch) {
            return false;
          }
        }

        if (selectedDomainId !== null && object.domain?.id !== selectedDomainId) {
          return false;
        }

        if (selectedAreaId !== null && object.dataArea?.id !== selectedAreaId) {
          return false;
        }

        if (selectedSystemId !== null) {
          const matchesBaseSystem = object.system?.id === selectedSystemId;
          const matchesInstanceSystem = object.modelInstances.some((instance) => instance.targetSystem?.id === selectedSystemId);
          if (!matchesBaseSystem && !matchesInstanceSystem) {
            return false;
          }
        }

        if (selectedModelId !== null) {
          const matchesBaseModel = object.baseModel?.id === selectedModelId;
          const matchesInstanceModel = object.modelInstances.some((instance) => instance.model?.id === selectedModelId);
          if (!matchesBaseModel && !matchesInstanceModel) {
            return false;
          }
        }

        if (normalizedLayer) {
          const matchesBaseLayer = object.baseModel?.layer?.toLowerCase() === normalizedLayer;
          const matchesInstanceLayer = object.modelInstances.some((instance) => instance.model?.layer?.toLowerCase() === normalizedLayer);
          if (!matchesBaseLayer && !matchesInstanceLayer) {
            return false;
          }
        }

        if (normalizedObjectType && object.objectType?.toLowerCase() !== normalizedObjectType) {
          return false;
        }

        if (hasAttributesFilter !== null) {
          if (hasAttributesFilter && object.stats.attributeCount === 0) {
            return false;
          }
          if (!hasAttributesFilter && object.stats.attributeCount > 0) {
            return false;
          }
        }

        if (normalizedRelationshipType) {
          const hasRelationship =
            object.relationships.global.some((rel) => rel.type.toUpperCase() === normalizedRelationshipType) ||
            object.relationships.modelSpecific.some((rel) => rel.type.toUpperCase() === normalizedRelationshipType);
          if (!hasRelationship) {
            return false;
          }
        }

        return true;
      });

      const sortMultiplier = sortDirection === "desc" ? -1 : 1;
      filteredObjects.sort((a, b) => {
        const compareByKey = (key: typeof sortKey): number => {
          switch (key) {
            case "updatedAt": {
              const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
              const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
              return aTime - bTime;
            }
            case "attributeCount":
              return a.stats.attributeCount - b.stats.attributeCount;
            case "modelInstanceCount":
              return a.stats.modelInstanceCount - b.stats.modelInstanceCount;
            case "relationshipCount":
              return a.stats.relationshipCount - b.stats.relationshipCount;
            case "name":
            default:
              return a.name.localeCompare(b.name);
          }
        };

        const result = compareByKey(sortKey);
        return result * sortMultiplier;
      });

      const startIndex = (pageNumber - 1) * pageSizeNumber;
      const endIndex = startIndex + pageSizeNumber;
      const paginatedObjects = filteredObjects.slice(startIndex, endIndex);

      const totalAttributeCount = filteredObjects.reduce((sum, obj) => sum + obj.stats.attributeCount, 0);
      const totalRelationshipCount = filteredObjects.reduce((sum, obj) => sum + obj.stats.relationshipCount, 0);
      const totalModelInstances = filteredObjects.reduce((sum, obj) => sum + obj.stats.modelInstanceCount, 0);

      res.json({
        objects: paginatedObjects,
        totals: {
          objectCount: filteredObjects.length,
          attributeCount: totalAttributeCount,
          relationshipCount: totalRelationshipCount,
          modelInstanceCount: totalModelInstances
        },
        appliedFilters: {
          search: search ?? null,
          domainId: selectedDomainId,
          dataAreaId: selectedAreaId,
          systemId: selectedSystemId,
          modelId: selectedModelId,
          layer: normalizedLayer,
          objectType: normalizedObjectType,
          hasAttributes: hasAttributesFilter,
          relationshipType: normalizedRelationshipType,
          includeHidden: includeHiddenInstances,
          sortBy: sortKey,
          sortOrder: sortDirection
        },
        meta: {
          page: pageNumber,
          pageSize: pageSizeNumber,
          hasMore: endIndex < filteredObjects.length,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Failed to build Object Lake response:", error);
      res.status(500).json({ message: "Failed to load object lake data" });
    }
  });

  // Data Object Relationships
  app.get("/api/object-relationships", async (_req, res) => {
    try {
      const relationships = await storage.getDataObjectRelationships();
      res.json(relationships);
    } catch (error) {
      console.error("Failed to fetch data object relationships:", error);
      res.status(500).json({ message: "Failed to fetch data object relationships" });
    }
  });

  app.get("/api/object-relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid relationship id" });
      }

      const relationship = await storage.getDataObjectRelationship(id);
      if (!relationship) {
        return res.status(404).json({ message: "Relationship not found" });
      }

      res.json(relationship);
    } catch (error) {
      console.error("Failed to fetch data object relationship:", error);
      res.status(500).json({ message: "Failed to fetch data object relationship" });
    }
  });

  app.get("/api/objects/:objectId/relationships", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      if (Number.isNaN(objectId)) {
        return res.status(400).json({ message: "Invalid object id" });
      }

      const relationships = await storage.getDataObjectRelationshipsByObject(objectId);
      res.json(relationships);
    } catch (error) {
      console.error("Failed to fetch relationships for object:", error);
      res.status(500).json({ message: "Failed to fetch relationships for object" });
    }
  });

  app.post("/api/object-relationships", async (req, res) => {
    try {
      const validatedData = insertDataObjectRelationshipSchema.parse(req.body);
      const relationship = await storage.createDataObjectRelationship(validatedData);
      res.status(201).json(relationship);
    } catch (error: any) {
      console.error("Invalid data object relationship payload:", error);
      if (error?.name === "ZodError") {
        res.status(400).json({ message: "Invalid relationship data", details: error.errors });
      } else {
        res.status(400).json({ message: "Invalid relationship data" });
      }
    }
  });

  app.put("/api/object-relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid relationship id" });
      }

      const validatedData = insertDataObjectRelationshipSchema.partial().parse(req.body);
      const relationship = await storage.updateDataObjectRelationship(id, validatedData);
      res.json(relationship);
    } catch (error: any) {
      console.error("Failed to update data object relationship:", error);
      if (error?.name === "ZodError") {
        res.status(400).json({ message: "Invalid relationship data", details: error.errors });
      } else {
        res.status(400).json({ message: "Failed to update relationship" });
      }
    }
  });

  app.delete("/api/object-relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid relationship id" });
      }

      await storage.deleteDataObjectRelationship(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete data object relationship:", error);
      res.status(500).json({ message: "Failed to delete relationship" });
    }
  });

  // Data Model Object Relationships
  app.get("/api/models/:modelId/relationships", async (req, res) => {
    try {
      const modelId = parseInt(req.params.modelId);
      if (Number.isNaN(modelId)) {
        return res.status(400).json({ message: "Invalid model id" });
      }

      const [relationships, modelObjects, dataObjectRelationships] = await Promise.all([
        storage.getDataModelObjectRelationshipsByModel(modelId),
        storage.getDataModelObjectsByModel(modelId),
        storage.getDataObjectRelationships(),
      ]);

      const objectIdByModelObjectId = new Map(modelObjects.map((modelObject) => [modelObject.id, modelObject.objectId]));
      const relevantObjectIds = new Set(modelObjects.map((modelObject) => modelObject.objectId));
      const globalRelationshipMap = new Map<string, DataObjectRelationship>();

      for (const relationship of dataObjectRelationships) {
        if (
          !relevantObjectIds.has(relationship.sourceDataObjectId) ||
          !relevantObjectIds.has(relationship.targetDataObjectId)
        ) {
          continue;
        }

        const key = buildRelationshipKey(
          relationship.sourceDataObjectId,
          relationship.targetDataObjectId,
          relationship.relationshipLevel === "attribute" ? "attribute" : "object",
          relationship.sourceAttributeId ?? null,
          relationship.targetAttributeId ?? null,
        );

        if (!globalRelationshipMap.has(key)) {
          globalRelationshipMap.set(key, relationship);
        }
      }

      const enrichedRelationships = relationships.map((relationship) => {
        const sourceObjectId = objectIdByModelObjectId.get(relationship.sourceModelObjectId);
        const targetObjectId = objectIdByModelObjectId.get(relationship.targetModelObjectId);
        let dataObjectRelationshipId: number | null = null;

        if (typeof sourceObjectId === "number" && typeof targetObjectId === "number") {
          const key = buildRelationshipKey(
            sourceObjectId,
            targetObjectId,
            relationship.relationshipLevel === "attribute" ? "attribute" : "object",
            relationship.sourceAttributeId ?? null,
            relationship.targetAttributeId ?? null,
          );

          dataObjectRelationshipId = globalRelationshipMap.get(key)?.id ?? null;
        }

        return {
          ...relationship,
          dataObjectRelationshipId,
        };
      });

      res.json(enrichedRelationships);
    } catch (error) {
      console.error("Failed to fetch relationships:", error);
      res.status(500).json({ message: "Failed to fetch relationships" });
    }
  });

  app.post("/api/relationships", async (req, res) => {
    try {
      console.log("[RELATIONSHIP] Creating relationship with payload:", JSON.stringify(req.body, null, 2));
      const result = await createRelationship(req.body, storage);
      res.status(201).json(result);
    } catch (error) {
      console.error("[RELATIONSHIP] Error creating relationship:", error instanceof Error ? error.message : error);
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.put("/api/relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid relationship id" });
      }

      const result = await updateRelationship(id, req.body, storage);
      res.json(result);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.delete("/api/relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid relationship id" });
      }

      await deleteRelationship(id, storage);
      res.status(204).send();
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  // Systems (backward compatible with /api/sources route)
  app.get("/api/sources", async (req, res) => {
    try {
      const systems = await storage.getSystems();
      res.json(systems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch systems" });
    }
  });

  app.get("/api/sources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const system = await storage.getSystem(id);
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }
      res.json(system);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system" });
    }
  });

  app.get("/api/systems", async (req, res) => {
    try {
      const systems = await storage.getSystems();
      res.json(systems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch systems" });
    }
  });

  app.get("/api/systems/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const system = await storage.getSystem(id);
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }
      res.json(system);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system" });
    }
  });

  app.post("/api/sources", async (req, res) => {
    try {
      const validatedData = insertSystemSchema.parse(req.body);
      const system = await storage.createSystem(validatedData);
      res.status(201).json(system);
    } catch (error: any) {
      console.error("Failed to create system:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid system data", details: error.errors });
      } else {
        res.status(500).json({ message: error.message || "Failed to create system" });
      }
    }
  });

  app.post("/api/systems", async (req, res) => {
    try {
      const validatedData = insertSystemSchema.parse(req.body);
      const system = await storage.createSystem(validatedData);
      res.status(201).json(system);
    } catch (error: any) {
      console.error("Failed to create system:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid system data", details: error.errors });
      } else {
        res.status(500).json({ message: error.message || "Failed to create system" });
      }
    }
  });

  app.patch("/api/sources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSystemSchema.partial().parse(req.body);
      const system = await storage.updateSystem(id, validatedData);
      res.json(system);
    } catch (error) {
      res.status(400).json({ message: "Failed to update system" });
    }
  });

  app.patch("/api/systems/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSystemSchema.partial().parse(req.body);
      const system = await storage.updateSystem(id, validatedData);
      res.json(system);
    } catch (error) {
      res.status(400).json({ message: "Failed to update system" });
    }
  });

  // PUT endpoint for /api/sources/:id (full update)
  app.put("/api/sources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSystemSchema.parse(req.body);
      const system = await storage.updateSystem(id, validatedData);
      res.json(system);
    } catch (error: any) {
      console.error("Failed to update system:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid system data", details: error.errors });
      } else {
        res.status(500).json({ message: error.message || "Failed to update system" });
      }
    }
  });

  // DELETE endpoint for /api/sources/:id
  app.delete("/api/sources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSystem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete system:", error);
      res.status(500).json({ message: "Failed to delete system" });
    }
  });

  // PUT endpoint for /api/systems/:id (full update)
  app.put("/api/systems/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSystemSchema.parse(req.body);
      const system = await storage.updateSystem(id, validatedData);
      res.json(system);
    } catch (error: any) {
      console.error("Failed to update system:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid system data", details: error.errors });
      } else {
        res.status(500).json({ message: error.message || "Failed to update system" });
      }
    }
  });

  // DELETE endpoint for /api/systems/:id
  app.delete("/api/systems/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSystem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete system:", error);
      res.status(500).json({ message: "Failed to delete system" });
    }
  });

  app.get("/api/systems/:id/objects", async (req, res) => {
    try {
      const systemId = parseInt(req.params.id);
      if (!Number.isFinite(systemId)) {
        return res.status(400).json({ message: "Invalid system id" });
      }

      const system = await storage.getSystem(systemId);
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }

      const objects = await storage.getDataObjectsBySystem(systemId);

      const [models, attributes, modelObjects] = await Promise.all([
        storage.getDataModelLayers(),
        storage.getAllAttributes(),
        storage.getDataModelObjects(),
      ]);

      const attributeCounts = new Map<number, number>();
      attributes.forEach((attribute) => {
        const count = attributeCounts.get(attribute.objectId) ?? 0;
        attributeCounts.set(attribute.objectId, count + 1);
      });

      const modelMap = new Map<number, DataModelLayer>();
      models.forEach((model) => modelMap.set(model.id, model));

      const modelObjectsByDataObject = new Map<number, DataModelObject[]>();
      modelObjects.forEach((modelObject) => {
        if (modelObject.objectId === null) {
          return;
        }
        const existing = modelObjectsByDataObject.get(modelObject.objectId) ?? [];
        existing.push(modelObject);
        modelObjectsByDataObject.set(modelObject.objectId, existing);
      });

      const enriched = objects.map((object) => {
        const modelLinks = modelObjectsByDataObject.get(object.id) ?? [];
        const primaryModel =
          modelLinks
            .map((link) => modelMap.get(link.modelId) ?? null)
            .find((model) => model?.layer === "conceptual") ??
          (modelLinks.length > 0 ? modelMap.get(modelLinks[0].modelId) ?? null : null);
        return {
          ...object,
          attributeCount: attributeCounts.get(object.id) ?? 0,
          model: primaryModel
            ? {
                id: primaryModel.id,
                name: primaryModel.name,
                layer: primaryModel.layer,
              }
            : null,
          systemAssociation: object.systemId === systemId ? "owner" : null,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Failed to fetch system objects:", error);
      res.status(500).json({ message: "Failed to fetch system objects" });
    }
  });

  app.patch("/api/systems/:id/objects/:objectId", async (req, res) => {
    try {
      const systemId = parseInt(req.params.id);
      const objectId = parseInt(req.params.objectId);
      if (!Number.isFinite(systemId) || !Number.isFinite(objectId)) {
        return res.status(400).json({ message: "Invalid identifiers" });
      }

      const [system, object] = await Promise.all([
        storage.getSystem(systemId),
        storage.getDataObject(objectId),
      ]);

      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }

      if (!object) {
        return res.status(404).json({ message: "Object not found" });
      }

      const association = object.systemId === systemId ? "owner" : null;

      if (!association) {
        return res.status(400).json({ message: "Object is not associated with this system" });
      }

      const parsed = systemObjectUpdateSchema.parse(req.body ?? {});

      let domainId = parsed.domainId ?? null;
      let dataAreaId = parsed.dataAreaId ?? null;

      if (domainId !== null) {
        const domain = await storage.getDataDomain(domainId);
        if (!domain) {
          return res.status(400).json({ message: "Provided domain does not exist" });
        }
      }

      if (dataAreaId !== null) {
        const area = await storage.getDataArea(dataAreaId);
        if (!area) {
          return res.status(400).json({ message: "Provided data area does not exist" });
        }
        if (domainId !== null && area.domainId !== domainId) {
          return res.status(400).json({ message: "Data area does not belong to the specified domain" });
        }
        if (domainId === null) {
          domainId = area.domainId;
        }
      }

      const updated = await storage.updateDataObject(objectId, {
        domainId,
        dataAreaId,
        description: parsed.description ?? object.description,
      });

      res.json({
        ...updated,
        systemAssociation: association,
      });
    } catch (error) {
      console.error("Failed to update system object:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", details: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update system object" });
      }
    }
  });

  app.delete("/api/systems/:id/objects/:objectId", async (req, res) => {
    try {
      const systemId = parseInt(req.params.id);
      const objectId = parseInt(req.params.objectId);
      if (!Number.isFinite(systemId) || !Number.isFinite(objectId)) {
        return res.status(400).json({ message: "Invalid identifiers" });
      }

      const [system, object] = await Promise.all([
        storage.getSystem(systemId),
        storage.getDataObject(objectId),
      ]);

      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }

      if (!object) {
        return res.status(404).json({ message: "Object not found" });
      }

      if (object.systemId !== systemId) {
        return res.status(400).json({ message: "Object is not associated with this system" });
      }

      await storage.deleteDataModelObjectsByObject(objectId);
      await storage.deleteDataObjectRelationshipsByObject(objectId);
      await storage.deleteAttributesByObject(objectId);
      await storage.deleteDataObject(objectId);

      res.status(204).send();
    } catch (error) {
      console.error("Failed to remove system object:", error);
      res.status(500).json({ message: "Failed to remove system object" });
    }
  });

  app.post("/api/systems/:id/sync-objects", async (req, res) => {
    try {
      const systemId = parseInt(req.params.id);
      if (!Number.isFinite(systemId)) {
        return res.status(400).json({ message: "Invalid system id" });
      }

      const parsed = systemSyncRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid sync request",
          details: parsed.error.flatten(),
        });
      }

      const input: SyncSystemObjectsInput = {
        systemId,
        ...parsed.data,
        connection: req.body?.connection,
      };

      const result = await syncSystemObjects(input, storage);
      res.json(result);
    } catch (error) {
      console.error("Failed to sync system objects:", error);
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.post("/api/sources/test-connection", async (req, res) => {
    try {
      const { type, configuration } = req.body;
      
      let isConnected = false;
      if (type === "sql") {
        isConnected = await dataConnectors.testDatabaseConnection(configuration);
      } else if (type === "adls") {
        isConnected = await dataConnectors.testADLSConnection(configuration);
      }
      
      res.json({ connected: isConnected });
    } catch (error) {
      res.status(500).json({ message: "Connection test failed" });
    }
  });

  app.post("/api/systems/:id/test-connection", async (req, res) => {
    try {
      const systemId = parseInt(req.params.id);
      if (!Number.isFinite(systemId)) {
        return res.status(400).json({ message: "Invalid system id" });
      }

      const system = await storage.getSystem(systemId);
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }

      const overrideConfiguration =
        req.body?.configuration && typeof req.body.configuration === "object"
          ? (req.body.configuration as Record<string, unknown>)
          : undefined;

      const result = await testSystemConnectivity(system, {
        type: req.body?.type,
        configuration: overrideConfiguration,
        connectionString: req.body?.connectionString,
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to test system connection:", error);
      res.status(500).json({ message: "Connection test failed" });
    }
  });

  app.get("/api/sources/:id/metadata", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const source = await storage.getSystem(id);
      
      if (!source) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      let metadata: any[] = [];
      if (source.type === "sql") {
        metadata = await dataConnectors.extractDatabaseMetadata(source.configuration as any);
      } else if (source.type === "adls") {
        metadata = await dataConnectors.listADLSDatasets(source.configuration as any);
      }
      
      res.json(metadata);
    } catch (error) {
      res.status(500).json({ message: "Failed to extract metadata" });
    }
  });

  // File Upload endpoints
  app.post("/api/upload/csv", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const fileContent = req.file.buffer.toString('utf-8');
      const metadata = await dataConnectors.parseCSVFile(fileContent);
      res.json(metadata);
    } catch (error) {
      res.status(400).json({ message: "Failed to parse CSV file" });
    }
  });

  app.post("/api/upload/excel", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const metadata = await dataConnectors.parseExcelFile(req.file.buffer);
      res.json(metadata);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Failed to parse Excel file" });
    }
  });

  app.post("/api/upload/parquet", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const metadata = await dataConnectors.parseParquetFile(req.file.buffer);
      res.json(metadata);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Failed to parse Parquet file" });
    }
  });

  app.post("/api/upload/sqlite", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const metadata = await dataConnectors.parseSQLiteFile(req.file.buffer);
      res.json(metadata);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Failed to parse SQLite file" });
    }
  });

  app.post("/api/upload/ddl", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const ddlContent = req.file.buffer.toString('utf-8');
      const metadata = await dataConnectors.parseDDLScript(ddlContent);
      res.json(metadata);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Failed to parse DDL script" });
    }
  });

  // Canvas endpoints for ReactFlow integration
  app.get("/api/models/:id/canvas", async (req, res) => {
    const modelId = parseInt(req.params.id);
    const layer = req.query.layer as string || "conceptual";
    
    try {
  // Get only the objects that belong to this model and are visible in this layer
  const modelObjects = await storage.getDataModelObjectsByModel(modelId);
  const visibleModelObjects = modelObjects.filter(mo => mo.isVisible !== false);
  
  // Get model attributes for all model objects in this model
  const allModelAttributes = await storage.getDataModelObjectAttributes();
  const modelAttributes = allModelAttributes.filter(attr => attr.modelId === modelId);
  const modelAttributesByModelObjectId = new Map<number, typeof modelAttributes>();
  modelAttributes.forEach((attr: typeof modelAttributes[0]) => {
    const list = modelAttributesByModelObjectId.get(attr.modelObjectId) ?? [];
    list.push(attr);
    modelAttributesByModelObjectId.set(attr.modelObjectId, list);
  });
      
  const relationships = await storage.getDataModelObjectRelationshipsByModel(modelId);
  console.log(`[CANVAS] Found ${relationships.length} relationships for model ${modelId}`);
  const modelObjectsById = new Map(modelObjects.map(mo => [mo.id, mo]));
  const relevantObjectIds = new Set(modelObjects.map(mo => mo.objectId).filter((id): id is number => id !== null));
  const dataObjectRelationships = await storage.getDataObjectRelationships();
  const globalRelationshipMap = new Map<string, DataObjectRelationship>();

  for (const relationship of dataObjectRelationships) {
    if (
      !relevantObjectIds.has(relationship.sourceDataObjectId) ||
      !relevantObjectIds.has(relationship.targetDataObjectId)
    ) {
      continue;
    }

    const key = buildRelationshipKey(
      relationship.sourceDataObjectId,
      relationship.targetDataObjectId,
      relationship.relationshipLevel === "attribute" ? "attribute" : "object",
      relationship.sourceAttributeId ?? null,
      relationship.targetAttributeId ?? null,
    );

    if (!globalRelationshipMap.has(key)) {
      globalRelationshipMap.set(key, relationship);
    }
  }
      
      // Get attributes for each object and include domain/area information
      // ALL objects on canvas are rendered from data_model_objects table only
      const nodes = await Promise.all(visibleModelObjects.map(async modelObj => {
        // All objects - data is in data_model_objects
        const modelAttrs = modelAttributesByModelObjectId.get(modelObj.id) ?? [];
        
        // If name is missing, try to get it from linked data_object
        let objectName = modelObj.name;
        let objectDescription = modelObj.description;
        let objectType = modelObj.objectType;
        
        if (modelObj.objectId && !objectName) {
          const dataObject = await storage.getDataObject(modelObj.objectId);
          if (dataObject) {
            objectName = dataObject.name;
            objectDescription = objectDescription || dataObject.description;
            objectType = objectType || dataObject.objectType;
          }
        }
        
        // Get domain and area information
        let domainName, domainColor, dataAreaName;
        if (modelObj.domainId) {
          const domain = await storage.getDataDomain(modelObj.domainId);
          domainName = domain?.name;
          domainColor = domain?.colorCode;
        }
        if (modelObj.dataAreaId) {
          const dataArea = await storage.getDataArea(modelObj.dataAreaId);
          dataAreaName = dataArea?.name;
        }
        
        // Get source and target system names
        let sourceSystemName, targetSystemName;
        if (modelObj.sourceSystemId) {
          const sourceSystem = await storage.getSystem(modelObj.sourceSystemId);
          sourceSystemName = sourceSystem?.name;
        }
        if (modelObj.targetSystemId) {
          const targetSystem = await storage.getSystem(modelObj.targetSystemId);
          targetSystemName = targetSystem?.name;
        }
        
        // Get position from model object
        let position = modelObj.position || { x: 100, y: 100 };
        if (typeof position === 'string') {
          try {
            position = JSON.parse(position);
          } catch (e) {
            console.warn("Failed to parse position:", position);
            position = { x: 100, y: 100 };
          }
        }
        
        return {
          id: modelObj.id.toString(),
          type: "dataObject",
          position,
          data: {
            id: modelObj.id,
            objectId: modelObj.objectId, // The actual data_objects.id (null for user-created)
            modelObjectId: modelObj.id,  // The data_model_objects.id (always present)
            name: objectName || "Unnamed Object",
            objectType: objectType || "entity",
            description: objectDescription,
            domainId: modelObj.domainId,
            dataAreaId: modelObj.dataAreaId,
            domain: domainName, // For node display (was domainName)
            domainName, // Keep for compatibility
            domainColor,
            dataArea: dataAreaName, // For node display (was dataAreaName)
            dataAreaName, // Keep for compatibility
            sourceSystem: sourceSystemName, // For node display (was sourceSystemId)
            targetSystem: targetSystemName, // For node display (was targetSystemId)
            sourceSystemId: modelObj.sourceSystemId, // Keep ID for reference
            targetSystemId: modelObj.targetSystemId, // Keep ID for reference
            attributes: modelAttrs.map((ma: any) => ({
              id: ma.id,
              name: ma.name || "Unnamed Attribute",
              conceptualType: ma.conceptualType,
              logicalType: ma.logicalType,
              physicalType: ma.physicalType,
              dataType: ma.dataType,
              nullable: ma.nullable,
              isPrimaryKey: ma.isPrimaryKey,
              isForeignKey: ma.isForeignKey,
              orderIndex: ma.orderIndex,
            })),
            metadata: modelObj.metadata,
            layerSpecificConfig: modelObj.layerSpecificConfig,
            isUserCreated: modelObj.objectId === null, // Flag to identify user-created vs synced
            isNew: modelObj.objectId === null, // User-created objects show as "new" with green styling
            commonProperties: null, // Legacy field for compatibility
          },
        };
      }));
      
      // All nodes are valid (from data_model_objects only)
      const validNodes = nodes;
      
      // Filter relationships based on layer
      let filteredRelationships = relationships;
      if (layer === "conceptual") {
        // In conceptual layer, show only object-to-object relationships (no attribute-specific relationships)
        filteredRelationships = relationships.filter(rel => !rel.sourceAttributeId && !rel.targetAttributeId);
      } else if (layer === "logical" || layer === "physical") {
        // In logical and physical layers, show only attribute-level relationships
        filteredRelationships = relationships.filter(rel => rel.sourceAttributeId && rel.targetAttributeId);
      }
      
      const edges = await Promise.all(filteredRelationships.map(async rel => {
        // Get the actual object IDs from the model objects
        const sourceModelObject = modelObjectsById.get(rel.sourceModelObjectId) ?? (await storage.getDataModelObject(rel.sourceModelObjectId));
        const targetModelObject = modelObjectsById.get(rel.targetModelObjectId) ?? (await storage.getDataModelObject(rel.targetModelObjectId));
        
        if (!sourceModelObject || !targetModelObject) {
          console.warn(`Missing model objects for relationship ${rel.id}`);
          return null;
        }

        // Resolve model attribute IDs to global attribute IDs for the UI
        let globalSourceAttributeId = null;
        let globalTargetAttributeId = null;
        
        if (rel.sourceAttributeId) {
          const sourceModelAttr = await storage.getDataModelAttribute(rel.sourceAttributeId);
          globalSourceAttributeId = sourceModelAttr?.attributeId ?? null;
        }
        
        if (rel.targetAttributeId) {
          const targetModelAttr = await storage.getDataModelAttribute(rel.targetAttributeId);
          globalTargetAttributeId = targetModelAttr?.attributeId ?? null;
        }

        const relationshipLevel = rel.relationshipLevel === "attribute" ? "attribute" : "object";
        
        // Use model object IDs for edge source/target to match node IDs
        const sourceId = sourceModelObject.id;
        const targetId = targetModelObject.id;
        
        // For global relationship lookup, use data object IDs
        const sourceDataObjectId = sourceModelObject.objectId ?? sourceModelObject.id;
        const targetDataObjectId = targetModelObject.objectId ?? targetModelObject.id;
        
        const key = buildRelationshipKey(
          sourceDataObjectId,
          targetDataObjectId,
          relationshipLevel,
          globalSourceAttributeId,
          globalTargetAttributeId,
        );

        const dataObjectRelationshipId = globalRelationshipMap.get(key)?.id ?? null;

        return {
          id: rel.id.toString(),
          source: sourceId.toString(),
          target: targetId.toString(),
          sourceHandle: rel.sourceHandle ?? undefined,
          targetHandle: rel.targetHandle ?? undefined,
          type: 'smoothstep',
          label: rel.type,
          data: {
            relationshipId: rel.id,
            relationshipType: rel.type,
            sourceAttributeId: globalSourceAttributeId,
            targetAttributeId: globalTargetAttributeId,
            dataObjectRelationshipId,
          }
        };
      }));

      // Filter out null edges
      const validEdges = edges.filter(edge => edge !== null);
      console.log(`[CANVAS] Returning ${validEdges.length} valid edges out of ${edges.length} total edges`);
      if (validEdges.length > 0) {
        console.log(`[CANVAS] Sample edge:`, JSON.stringify(validEdges[0], null, 2));
      }
      
      res.json({ nodes: validNodes, edges: validEdges });
    } catch (error) {
      console.error("Error getting canvas data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Canvas position saving endpoint
  app.post("/api/models/:id/canvas/positions", async (req, res) => {
    try {
  const modelId = parseInt(req.params.id);
  const { positions, layer } = req.body; // Array of { modelObjectId?: number, objectId?: number, position: { x: number, y: number } }
      
      if (!Array.isArray(positions)) {
        return res.status(400).json({ message: "Positions must be an array" });
      }
      
      // Get all model objects for this model to validate they exist
  const modelObjects = await storage.getDataModelObjectsByModel(modelId);
  const modelObjectsByObjectId = new Map(modelObjects.map(mo => [mo.objectId, mo]));
  const modelObjectsById = new Map(modelObjects.map(mo => [mo.id, mo]));
      
      // Filter positions to only include objects that exist in this model
      const validPositions = positions.filter(({ objectId, modelObjectId }) => {
        if (typeof modelObjectId === 'number') {
          const exists = modelObjectsById.has(modelObjectId);
          if (!exists) {
            console.warn(`Model object ${modelObjectId} not found in model ${modelId}, skipping position update`);
          }
          return exists;
        }

        if (typeof objectId === 'number') {
          const exists = modelObjectsByObjectId.has(objectId);
          if (!exists) {
            console.warn(`Object ${objectId} not found in model ${modelId}, skipping position update`);
          }
          return exists;
        }

        console.warn(`Invalid position payload without identifiers, skipping entry`);
        return false;
      });
      
      if (validPositions.length === 0) {
        return res.json({ success: true, message: "No valid positions to save", skipped: positions.length });
      }
      
      // Update each model object's layer-specific position in the layer_specific_config
      const updates = validPositions.map(async ({ objectId, modelObjectId, position }) => {
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
          throw new Error(`Invalid position data for payload ${JSON.stringify({ objectId, modelObjectId })}`);
        }

        let modelObject = typeof modelObjectId === 'number'
          ? modelObjectsById.get(modelObjectId)
          : undefined;

        if (!modelObject && typeof objectId === 'number') {
          modelObject = modelObjectsByObjectId.get(objectId);
        }

        if (!modelObject) {
          throw new Error(`Model object not found for payload ${JSON.stringify({ objectId, modelObjectId })}`);
        }
        
        // Get the current model object to preserve existing config
        const currentModelObject = await storage.getDataModelObject(modelObject.id);
        if (!currentModelObject) {
          throw new Error(`Model object ${modelObject.id} not found`);
        }
        
        // Update the layer-specific configuration with the new position
        let layerConfig = {};
        if (currentModelObject.layerSpecificConfig && typeof currentModelObject.layerSpecificConfig === 'object') {
          layerConfig = { ...currentModelObject.layerSpecificConfig };
        }

        const layerKey = typeof layer === 'string' && layer.length > 0
          ? layer
          : (typeof (layerConfig as any).layer === 'string' ? (layerConfig as any).layer : 'conceptual');

        const existingLayers = (layerConfig as any).layers && typeof (layerConfig as any).layers === 'object'
          ? { ...(layerConfig as any).layers }
          : {};

        const nextLayerConfig = {
          ...existingLayers[layerKey],
          position
        };

        const updatedConfig = {
          ...layerConfig,
          position, // maintain backwards compatibility
          layers: {
            ...existingLayers,
            [layerKey]: nextLayerConfig
          },
          lastUpdatedLayer: layerKey
        } as Record<string, any>;

        const result = await storage.updateDataModelObject(modelObject.id, { 
          layerSpecificConfig: updatedConfig,
          position
        });

        // Only update data_objects if this is a system-synced object (has objectId)
        if (modelObject.objectId !== null && layerKey === "conceptual") {
          await storage.updateDataObject(modelObject.objectId, {
            position,
          });
        }

        return result;
      });
      
      await Promise.all(updates);
      res.json({ 
        success: true, 
        message: "Positions saved successfully",
        saved: validPositions.length,
        skipped: positions.length - validPositions.length
      });
    } catch (error) {
      console.error("Error saving canvas positions:", error);
      res.status(500).json({ message: "Failed to save positions" });
    }
  });

  // Business Capabilities
  app.get("/api/capabilities", async (req, res) => {
    try {
      const capabilities = await storage.getBusinessCapabilities();
      res.json(capabilities);
    } catch (error) {
      console.error("Failed to fetch capabilities:", error);
      res.status(500).json({ message: "Failed to fetch capabilities" });
    }
  });

  app.get("/api/capabilities/tree", async (req, res) => {
    try {
      const capabilityTree = await storage.getBusinessCapabilityTree();
      res.json(capabilityTree);
    } catch (error) {
      console.error("Failed to fetch capability tree:", error);
      res.status(500).json({ message: "Failed to fetch capability tree" });
    }
  });

  app.get("/api/capabilities/:id(\\d+)", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const capability = await storage.getBusinessCapability(id);
      if (!capability) {
        return res.status(404).json({ message: "Capability not found" });
      }
      res.json(capability);
    } catch (error) {
      console.error("Failed to fetch capability:", error);
      res.status(500).json({ message: "Failed to fetch capability" });
    }
  });

  app.get("/api/capabilities/:id(\\d+)/mappings", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const mappings = await storage.getCapabilityMappings(id);
      res.json(mappings);
    } catch (error) {
      console.error("Failed to fetch capability mappings:", error);
      res.status(500).json({ message: "Failed to fetch capability mappings" });
    }
  });

  app.get("/api/capabilities/system-mappings", async (_req, res) => {
    try {
      const mappings = await storage.getAllCapabilitySystemMappings();
      res.json(mappings);
    } catch (error) {
      console.error("Failed to fetch capability system mappings:", error);
      res.status(500).json({ message: "Failed to fetch capability system mappings" });
    }
  });

  app.post("/api/capabilities", async (req, res) => {
    try {
      const capability = await storage.createBusinessCapability(req.body);
      res.status(201).json(capability);
    } catch (error) {
      console.error("Failed to create capability:", error);
      res.status(500).json({ message: "Failed to create capability" });
    }
  });

  app.patch("/api/capabilities/:id(\\d+)", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const capability = await storage.updateBusinessCapability(id, req.body);
      res.json(capability);
    } catch (error) {
      console.error("Failed to update capability:", error);
      res.status(500).json({ message: "Failed to update capability" });
    }
  });

  app.delete("/api/capabilities/:id(\\d+)", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBusinessCapability(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete capability:", error);
      res.status(500).json({ message: "Failed to delete capability" });
    }
  });

  // Capability-Domain Mappings
  app.post("/api/capabilities/:capabilityId/domains/:domainId", async (req, res) => {
    try {
      const capabilityId = parseInt(req.params.capabilityId);
      const domainId = parseInt(req.params.domainId);
      const mapping = await storage.createCapabilityDomainMapping({
        capabilityId,
        domainId,
        ...req.body
      });
      res.status(201).json(mapping);
    } catch (error) {
      console.error("Failed to create capability-domain mapping:", error);
      res.status(500).json({ message: "Failed to create mapping" });
    }
  });

  app.delete("/api/capability-domain-mappings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCapabilityDomainMapping(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete capability-domain mapping:", error);
      res.status(500).json({ message: "Failed to delete mapping" });
    }
  });

  // Capability-DataArea Mappings
  app.post("/api/capabilities/:capabilityId/data-areas/:dataAreaId", async (req, res) => {
    try {
      const capabilityId = parseInt(req.params.capabilityId);
      const dataAreaId = parseInt(req.params.dataAreaId);
      const mapping = await storage.createCapabilityDataAreaMapping({
        capabilityId,
        dataAreaId,
        ...req.body
      });
      res.status(201).json(mapping);
    } catch (error) {
      console.error("Failed to create capability-data area mapping:", error);
      res.status(500).json({ message: "Failed to create mapping" });
    }
  });

  app.delete("/api/capability-data-area-mappings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCapabilityDataAreaMapping(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete capability-data area mapping:", error);
      res.status(500).json({ message: "Failed to delete mapping" });
    }
  });

  // Capability-System Mappings
  app.post("/api/capabilities/:capabilityId/systems/:systemId", async (req, res) => {
    try {
      const capabilityId = parseInt(req.params.capabilityId);
      const systemId = parseInt(req.params.systemId);
      const mapping = await storage.createCapabilitySystemMapping({
        capabilityId,
        systemId,
        ...req.body
      });
      res.status(201).json(mapping);
    } catch (error) {
      console.error("Failed to create capability-system mapping:", error);
      res.status(500).json({ message: "Failed to create mapping" });
    }
  });

  app.delete("/api/capability-system-mappings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCapabilitySystemMapping(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete capability-system mapping:", error);
      res.status(500).json({ message: "Failed to delete mapping" });
    }
  });

  // AI Suggestions
  app.post("/api/ai/modeling-agent", async (req, res) => {
    try {
      const result = await executeModelingAgent(req.body);
      res.json(result);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.post("/api/ai/suggest-domain", async (req, res) => {
    try {
      const { objectName, attributes } = req.body;
      const suggestions = await suggestDomainClassification(objectName, attributes);
      res.json(suggestions);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.post("/api/ai/suggest-relationships", async (req, res) => {
    try {
      const { modelId, layer } = req.body;
      const suggestions = await suggestRelationshipsForModel(modelId, layer, storage);
      res.json(suggestions);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.post("/api/ai/suggest-types", async (req, res) => {
    try {
      const { conceptualType, attributeName, context } = req.body;
      const suggestions = await suggestTypeMappings(conceptualType, attributeName, context);
      res.json(suggestions);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.post("/api/ai/suggest-normalization", async (req, res) => {
    try {
      const { modelId } = req.body;
      const suggestions = await suggestNormalizationImprovements(modelId, storage);
      res.json(suggestions);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.get("/api/system-metrics", async (_req, res) => {
    try {
      const [configs, models, systemsList, objects, attrs, rels] = await Promise.all([
        storage.getConfigurations(),
        storage.getDataModelLayers(),
        storage.getSystems(),
        storage.getDataObjects(),
        storage.getAttributes(),
  storage.getDataModelObjectRelationships(),
      ]);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const modifiedToday = configs.filter((config) => {
        if (!config.updatedAt) return false;
        const updatedAt = new Date(config.updatedAt);
        return updatedAt >= startOfDay;
      }).length;

      const lastUpdatedConfig = configs.reduce<Date | null>((latest, config) => {
        if (!config.updatedAt) return latest;
        const updatedAt = new Date(config.updatedAt);
        if (!latest || updatedAt > latest) {
          return updatedAt;
        }
        return latest;
      }, null);

      const requiredConfigKeys: Record<string, string[]> = {
        ai: [
          "openai_model",
          "temperature",
          "max_tokens",
          "confidence_threshold",
          "enable_suggestions",
          "enable_domain_suggestions",
          "enable_relationship_suggestions",
          "enable_normalization_suggestions",
          "max_suggestions",
          "analysis_timeout",
        ],
        ui: [
          "auto_save_interval",
          "enable_mini_map",
          "enable_auto_save",
          "theme",
          "canvas_zoom_sensitivity",
          "show_grid",
          "snap_to_grid",
          "grid_size",
        ],
        export: [
          "default_format",
          "include_comments",
          "include_constraints",
          "include_indexes",
          "compression_enabled",
          "max_file_size_mb",
        ],
        connection: [
          "max_connections",
          "connection_timeout",
          "retry_attempts",
          "rate_limit_per_minute",
          "enable_connection_pooling",
        ],
      };

      const categoryStats = Array.from(
        configs.reduce((map, config) => {
          const list = map.get(config.category) ?? [];
          list.push(config);
          map.set(config.category, list);
          return map;
        }, new Map<string, typeof configs>())
      ).map(([category, entries]) => {
        const missingKeys = (requiredConfigKeys[category] ?? []).filter(
          (key) => !entries.some((entry) => entry.key === key)
        );

        return {
          name: category,
          count: entries.length,
          missingKeys,
        };
      });

      const missingKeys = categoryStats.flatMap((category) =>
        category.missingKeys.map((key) => `${category.name}.${key}`)
      );

      const conceptualModels = models.filter((model) => model.layer === "conceptual").length;
      const logicalModels = models.filter((model) => model.layer === "logical").length;
      const physicalModels = models.filter((model) => model.layer === "physical").length;

      const connectedSystems = systemsList.filter((system) => system.status === "connected").length;
      const errorSystems = systemsList.filter((system) => system.status === "error").length;
      const disconnectedSystems =
        systemsList.length - connectedSystems - errorSystems;

      res.json({
        generatedAt: new Date().toISOString(),
        configuration: {
          totalConfigs: configs.length,
          modifiedToday,
          lastUpdated: lastUpdatedConfig ? lastUpdatedConfig.toISOString() : null,
          categories: categoryStats,
          missingKeys,
        },
        models: {
          total: models.length,
          conceptual: conceptualModels,
          logical: logicalModels,
          physical: physicalModels,
        },
        objects: {
          total: objects.length,
          attributes: attrs.length,
          relationships: rels.length,
        },
        systems: {
          total: systemsList.length,
          connected: connectedSystems,
          disconnected: Math.max(disconnectedSystems, 0),
          error: errorSystems,
        },
      });
    } catch (error) {
      console.error("Failed to load system metrics", error);
      res.status(500).json({ message: "Failed to load system metrics" });
    }
  });

  // Configuration endpoints
  app.get("/api/config", async (req, res) => {
    try {
      const configurations = await storage.getConfigurations();
      res.json(configurations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch configurations" });
    }
  });

  app.get("/api/config/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const configurations = await storage.getConfigurationsByCategory(category);
      res.json(configurations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category configurations" });
    }
  });

  app.get("/api/config/:category/:key", async (req, res) => {
    try {
      const { category, key } = req.params;
      const configuration = await storage.getConfiguration(category, key);
      if (!configuration) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      res.json(configuration);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const { configuration, created } = await upsertConfigurationEntry(req.body);
      res.status(created ? 201 : 200).json(configuration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration data", details: error.issues });
      } else {
        res.status(500).json({ message: "Failed to save configuration" });
      }
    }
  });

  app.put("/api/config/:category/:key", async (req, res) => {
    try {
      const { category, key } = req.params;
      const update = configurationUpdateSchema.parse(req.body);
      const existing = await storage.getConfiguration(category, key);

      if (!existing) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      const fallbackDescription = `${category}.${key} configuration`;
      const updated = await storage.updateConfiguration(existing.id, {
        value: update.value ?? existing.value,
        description: update.description ?? existing.description ?? fallbackDescription,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration update", details: error.issues });
      } else {
        res.status(500).json({ message: "Failed to update configuration" });
      }
    }
  });

  app.delete("/api/config/:category/:key", async (req, res) => {
    try {
      const { category, key } = req.params;
      const existing = await storage.getConfiguration(category, key);

      if (!existing) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      await storage.deleteConfiguration(existing.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete configuration" });
    }
  });

  // Enhanced Configuration endpoints
  app.post("/api/config/batch", async (req, res) => {
    try {
      const { configurations } = req.body;
      if (!Array.isArray(configurations)) {
        return res.status(400).json({ message: "Configurations must be an array" });
      }

      const total = configurations.length;
      let created = 0;

      for (const config of configurations) {
        const result = await upsertConfigurationEntry(config);
        if (result.created) {
          created += 1;
        }
      }

      res.json({ success: true, created, updated: total - created });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration data", details: error.issues });
      } else {
        res.status(500).json({ message: "Failed to update configurations" });
      }
    }
  });

  app.post("/api/config/validate", async (req, res) => {
    try {
      const { category, key, value } = req.body;
      
      // Basic validation schemas for different categories
      const validationRules: Record<string, Record<string, any>> = {
        ai: {
          temperature: { type: 'number', min: 0, max: 2 },
          max_tokens: { type: 'number', min: 1, max: 8000 },
          confidence_threshold: { type: 'number', min: 0, max: 1 },
          openai_model: { type: 'string', enum: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'] }
        },
        ui: {
          auto_save_interval: { type: 'number', min: 100, max: 5000 },
          canvas_zoom_sensitivity: { type: 'number', min: 0.1, max: 2 },
          grid_size: { type: 'number', min: 5, max: 50 }
        },
        connection: {
          max_connections: { type: 'number', min: 1, max: 100 },
          connection_timeout: { type: 'number', min: 1000, max: 60000 },
          retry_attempts: { type: 'number', min: 1, max: 10 }
        }
      };

      const categoryRules = validationRules[category];
      if (!categoryRules) {
        return res.json({ valid: true, message: "No validation rules for this category" });
      }

      const rule = categoryRules[key];
      if (!rule) {
        return res.json({ valid: true, message: "No validation rules for this key" });
      }

      let isValid = true;
      let message = "";

      if (rule.type === 'number') {
        if (typeof value !== 'number') {
          isValid = false;
          message = "Value must be a number";
        } else if (rule.min !== undefined && value < rule.min) {
          isValid = false;
          message = `Value must be at least ${rule.min}`;
        } else if (rule.max !== undefined && value > rule.max) {
          isValid = false;
          message = `Value must be at most ${rule.max}`;
        }
      } else if (rule.type === 'string') {
        if (typeof value !== 'string') {
          isValid = false;
          message = "Value must be a string";
        } else if (rule.enum && !rule.enum.includes(value)) {
          isValid = false;
          message = `Value must be one of: ${rule.enum.join(', ')}`;
        }
      }

      res.json({ valid: isValid, message: message || "Value is valid" });
    } catch (error) {
      res.status(500).json({ message: "Validation failed" });
    }
  });

  // Configurations API
  app.get("/api/configurations", async (req, res) => {
    try {
      const configurations = await storage.getConfigurations();
      res.json(configurations);
    } catch (error) {
      console.error("Error fetching configurations:", error);
      res.status(500).json({ message: "Failed to fetch configurations" });
    }
  });

  app.post("/api/configurations", async (req, res) => {
    try {
      const { configuration, created } = await upsertConfigurationEntry(req.body);
      res.status(created ? 201 : 200).json(configuration);
    } catch (error) {
      console.error("Error saving configuration:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration data", details: error.issues });
      } else {
        res.status(500).json({ message: "Failed to save configuration" });
      }
    }
  });

  app.put("/api/configurations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const update = configurationUpdateSchema.parse(req.body);

      const updateData: { value?: any; description?: string } = {};
      if (update.value !== undefined) {
        updateData.value = update.value;
      }
      if (update.description !== undefined) {
        updateData.description = update.description;
      }

      const configuration = await storage.updateConfiguration(id, updateData);
      
      if (!configuration) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      
      res.json(configuration);
    } catch (error) {
      console.error("Error updating configuration:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid configuration update", details: error.issues });
      } else {
        res.status(500).json({ message: "Failed to update configuration" });
      }
    }
  });

  app.delete("/api/configurations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteConfiguration(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting configuration:", error);
      res.status(500).json({ message: "Failed to delete configuration" });
    }
  });

  // Export
  app.post("/api/export", async (req, res) => {
    try {
      const { modelId, options } = req.body;
      
      if (!modelId) {
        return res.status(400).json({ message: "Model ID is required" });
      }
      
      const exportedData = await exportModelData(modelId, options, storage);
      res.json({ data: exportedData });
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });


  // SVG Export
  // SVG Export
  app.post("/api/export/svg", async (req, res) => {
    try {
      const { modelId, options } = req.body;
      
      const model = await storage.getDataModel(modelId);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
      }
      
      const svg = await generateSVGDiagram(modelId, options, storage);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="${model.name}_${new Date().toISOString().split('T')[0]}.svg"`);
      res.send(svg);
    } catch (error) {
      const errorResponse = handleError(error);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
