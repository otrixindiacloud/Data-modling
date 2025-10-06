import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Data Models
export const dataModels = pgTable("data_models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  layer: text("layer").notNull(), // "conceptual" | "logical" | "physical"
  parentModelId: integer("parent_model_id"), // Links layers together
  targetSystemId: integer("target_system_id").references(() => systems.id), // Reference to target system
  domainId: integer("domain_id").references(() => dataDomains.id),
  dataAreaId: integer("data_area_id").references(() => dataAreas.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Domains
export const dataDomains = pgTable("data_domains", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  colorCode: text("color_code").default("#3b82f6"), // Default blue color
});

// Data Areas
export const dataAreas = pgTable("data_areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domainId: integer("domain_id").references(() => dataDomains.id).notNull(),
  description: text("description"),
  colorCode: text("color_code").default("#10b981"), // Default green color
});

// Data Objects (Tables/Entities) - Objects with model associations (current DB structure)
export const dataObjects = pgTable("data_objects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  modelId: integer("model_id").references(() => dataModels.id).notNull(), // Current DB has this
  domainId: integer("domain_id").references(() => dataDomains.id),
  dataAreaId: integer("data_area_id").references(() => dataAreas.id),
  sourceSystemId: integer("source_system_id").references(() => systems.id), // Reference to source system
  targetSystemId: integer("target_system_id").references(() => systems.id), // Reference to target system
  position: jsonb("position").$type<{ x: number; y: number }>(), // Current DB has this
  metadata: jsonb("metadata").$type<Record<string, any>>(), // Current DB has this
  isNew: boolean("is_new").default(false), // Track newly added objects
  commonProperties: jsonb("common_properties").$type<Record<string, any>>(), // Current DB has this
  description: text("description"),
  objectType: text("object_type"), // Current DB has this but nullable
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Model Objects - Objects within specific models with layer-specific configurations
export const dataModelObjects = pgTable("data_model_objects", {
  id: serial("id").primaryKey(),
  objectId: integer("object_id").references(() => dataObjects.id).notNull(),
  modelId: integer("model_id").references(() => dataModels.id).notNull(),
  targetSystemId: integer("target_system_id").references(() => systems.id), // Target system for this object in this model
  position: jsonb("position").$type<{ x: number; y: number }>(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  isVisible: boolean("is_visible").default(true), // Can hide objects in specific models
  layerSpecificConfig: jsonb("layer_specific_config").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Object Attributes (Columns/Fields) - Attributes with object associations
export const attributes = pgTable("data_object_attributes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  objectId: integer("object_id").references(() => dataObjects.id).notNull(), // Current DB has this
  conceptualType: text("conceptual_type"), // Current DB has this
  logicalType: text("logical_type"), // Current DB has this  
  physicalType: text("physical_type"), // Current DB has this
  length: integer("length"),
  precision: integer("precision"),
  scale: integer("scale"),
  nullable: boolean("nullable").default(true), // Current DB has this
  isPrimaryKey: boolean("is_primary_key").default(false), // Current DB has this
  isForeignKey: boolean("is_foreign_key").default(false), // Current DB has this
  orderIndex: integer("order_index").default(0), // Current DB has this
  isNew: boolean("is_new").default(false), // Track newly added attributes
  commonProperties: jsonb("common_properties").$type<Record<string, any>>(), // Current DB has this
  description: text("description"),
  dataType: text("data_type"), // Base data type
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Model Attributes - Attributes within specific models and objects with layer-specific properties
export const dataModelAttributes = pgTable("data_model_attributes", {
  id: serial("id").primaryKey(),
  attributeId: integer("attribute_id").references(() => attributes.id).notNull(),
  modelObjectId: integer("model_object_id").references(() => dataModelObjects.id).notNull(),
  modelId: integer("model_id").references(() => dataModels.id).notNull(),
  conceptualType: text("conceptual_type"), // "Text", "Number", "Date", etc.
  logicalType: text("logical_type"), // "VARCHAR", "INTEGER", "DATE", etc.
  physicalType: text("physical_type"), // "VARCHAR(255)", "INT", "DATETIME", etc.
  nullable: boolean("nullable").default(true),
  isPrimaryKey: boolean("is_primary_key").default(false),
  isForeignKey: boolean("is_foreign_key").default(false),
  orderIndex: integer("order_index").default(0),
  layerSpecificConfig: jsonb("layer_specific_config").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Model Properties - Granular properties for models, objects, and attributes
export const dataModelProperties = pgTable("data_model_properties", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // "model", "object", "attribute"
  entityId: integer("entity_id").notNull(), // References the specific entity
  modelId: integer("model_id").references(() => dataModels.id).notNull(),
  propertyName: text("property_name").notNull(),
  propertyValue: jsonb("property_value").$type<any>(),
  propertyType: text("property_type").notNull(), // "string", "number", "boolean", "json", "array"
  layer: text("layer"), // "conceptual", "logical", "physical" - null means applies to all layers
  description: text("description"),
  isSystemProperty: boolean("is_system_property").default(false), // System vs user-defined properties
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Object Relationships - Global relationships between core data objects
export const dataObjectRelationships = pgTable("data_object_relationships", {
  id: serial("id").primaryKey(),
  sourceDataObjectId: integer("source_data_object_id").references(() => dataObjects.id).notNull(),
  targetDataObjectId: integer("target_data_object_id").references(() => dataObjects.id).notNull(),
  type: text("type").notNull(), // "1:1", "1:N", "N:M"
  relationshipLevel: text("relationship_level").default("object").notNull(), // "object", "attribute"
  sourceAttributeId: integer("source_attribute_id").references(() => attributes.id),
  targetAttributeId: integer("target_attribute_id").references(() => attributes.id),
  name: text("name"),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Model Object Relationships - Layer-specific relationships tied to model objects
export const dataModelObjectRelationships = pgTable("data_model_object_relationships", {
  id: serial("id").primaryKey(),
  sourceModelObjectId: integer("source_model_object_id").references(() => dataModelObjects.id).notNull(),
  targetModelObjectId: integer("target_model_object_id").references(() => dataModelObjects.id).notNull(),
  type: text("type").notNull(), // "1:1", "1:N", "N:M"
  relationshipLevel: text("relationship_level").notNull(), // "object", "attribute"
  sourceAttributeId: integer("source_attribute_id").references(() => dataModelAttributes.id),
  targetAttributeId: integer("target_attribute_id").references(() => dataModelAttributes.id),
  modelId: integer("model_id").references(() => dataModels.id).notNull(),
  layer: text("layer").notNull(), // "conceptual", "logical", "physical"
  name: text("name"),
  description: text("description"),
  sourceHandle: text("source_handle"), // React Flow source handle ID for edge layout
  targetHandle: text("target_handle"), // React Flow target handle ID for edge layout
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Systems - Unified source and target systems
export const systems = pgTable("systems", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category").notNull(), // System category like "ERP", "CRM", "Data Lake", etc.
  type: text("type").notNull(), // Connection type: "sql", "file", "adls", "api", etc.
  description: text("description"),
  connectionString: text("connection_string"),
  configuration: jsonb("configuration").$type<Record<string, any>>(),
  status: text("status").default("disconnected"), // "connected", "disconnected", "error"
  colorCode: text("color_code").default("#6366f1"), // Default indigo color
  canBeSource: boolean("can_be_source").default(true), // Can this system be a data source?
  canBeTarget: boolean("can_be_target").default(true), // Can this system be a data target?
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Color Themes - Smart color palette themes for data models
export const colorThemes = pgTable("color_themes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  baseColor: text("base_color").notNull(), // Primary color for the theme
  palette: jsonb("palette").$type<{
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  }>().notNull(),
  isSystemTheme: boolean("is_system_theme").default(false), // Built-in vs custom themes
  isActive: boolean("is_active").default(false), // Currently applied theme
  modelId: integer("model_id").references(() => dataModels.id), // Theme specific to a model
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Entity Color Assignments - Specific color assignments for domains, objects, etc.
export const entityColorAssignments = pgTable("entity_color_assignments", {
  id: serial("id").primaryKey(),
  themeId: integer("theme_id").references(() => colorThemes.id).notNull(),
  entityType: text("entity_type").notNull(), // "domain", "dataArea", "sourceSystem", "targetSystem", "objectType"
  entityId: text("entity_id").notNull(), // ID or name of the entity
  colorValue: text("color_value").notNull(), // Hex color code
  colorRole: text("color_role").notNull(), // "primary", "background", "border", "text"
  autoGenerated: boolean("auto_generated").default(true), // Whether color was auto-generated
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Business Capabilities - Core business functions
export const businessCapabilities = pgTable("business_capabilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // Unique identifier like "PROD", "QUA", "SCM"
  description: text("description"),
  level: integer("level").notNull(), // 1=Category, 2=Capability Group, 3=Capability, 4=Sub-capability
  parentId: integer("parent_id").references(() => businessCapabilities.id),
  sortOrder: integer("sort_order").default(0),
  colorCode: text("color_code").default("#6366f1"),
  icon: text("icon"), // Icon name for UI representation
  isStandard: boolean("is_standard").default(true), // Industry standard vs custom
  maturityLevel: text("maturity_level"), // "basic", "developing", "defined", "managed", "optimizing"
  criticality: text("criticality").default("medium"), // "low", "medium", "high", "critical"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Business Capability Data Domain Mappings - Links capabilities to data domains
export const capabilityDataDomainMappings = pgTable("capability_data_domain_mappings", {
  id: serial("id").primaryKey(),
  capabilityId: integer("capability_id").references(() => businessCapabilities.id).notNull(),
  domainId: integer("domain_id").references(() => dataDomains.id).notNull(),
  mappingType: text("mapping_type").notNull(), // "primary", "secondary", "supporting"
  importance: text("importance").default("medium"), // "low", "medium", "high"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Business Capability Data Area Mappings - Links capabilities to data areas
export const capabilityDataAreaMappings = pgTable("capability_data_area_mappings", {
  id: serial("id").primaryKey(),
  capabilityId: integer("capability_id").references(() => businessCapabilities.id).notNull(),
  dataAreaId: integer("data_area_id").references(() => dataAreas.id).notNull(),
  mappingType: text("mapping_type").notNull(), // "primary", "secondary", "supporting"
  importance: text("importance").default("medium"), // "low", "medium", "high"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Business Capability System Mappings - Links capabilities to systems
export const capabilitySystemMappings = pgTable("capability_system_mappings", {
  id: serial("id").primaryKey(),
  capabilityId: integer("capability_id").references(() => businessCapabilities.id).notNull(),
  systemId: integer("system_id").references(() => systems.id).notNull(),
  mappingType: text("mapping_type").notNull(), // "enables", "supports", "automates"
  systemRole: text("system_role").notNull(), // "primary", "secondary", "supporting", "legacy"
  coverage: text("coverage").default("partial"), // "full", "partial", "minimal"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Model Lifecycle Phases - Defines canonical lifecycle governance checkpoints
export const modelLifecyclePhases = pgTable("model_lifecycle_phases", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sequence: integer("sequence").default(0),
  defaultDurationDays: integer("default_duration_days"),
  requiresApproval: boolean("requires_approval").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Business Capability Data Model Mappings - Links capabilities to data models with governance context
export const capabilityDataModelMappings = pgTable("capability_data_model_mappings", {
  id: serial("id").primaryKey(),
  capabilityId: integer("capability_id").references(() => businessCapabilities.id).notNull(),
  modelId: integer("model_id").references(() => dataModels.id).notNull(),
  domainId: integer("domain_id").references(() => dataDomains.id),
  lifecyclePhaseId: integer("lifecycle_phase_id").references(() => modelLifecyclePhases.id),
  lifecycleStatus: text("lifecycle_status").default("planned"), // planned, in_progress, active, sunset
  alignmentRating: text("alignment_rating").default("medium"), // low, medium, high
  businessValueScore: integer("business_value_score"),
  readinessScore: integer("readiness_score"),
  riskLevel: text("risk_level").default("medium"),
  governanceOwner: text("governance_owner"),
  dataSteward: text("data_steward"),
  solutionArchitect: text("solution_architect"),
  dataCustodian: text("data_custodian"),
  qaOwner: text("qa_owner"),
  reviewCadence: text("review_cadence"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  nextReviewAt: timestamp("next_review_at"),
  authoritativeSource: boolean("authoritative_source").default(false),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Capability → Model → System Traceability - Detailed system alignment metadata
export const capabilityModelSystemMappings = pgTable("capability_model_system_mappings", {
  id: serial("id").primaryKey(),
  capabilityId: integer("capability_id").references(() => businessCapabilities.id).notNull(),
  modelId: integer("model_id").references(() => dataModels.id).notNull(),
  systemId: integer("system_id").references(() => systems.id).notNull(),
  relationshipType: text("relationship_type").default("supports"),
  systemRole: text("system_role").default("secondary"),
  integrationPattern: text("integration_pattern"),
  lifecycleStatus: text("lifecycle_status").default("planned"),
  deploymentStatus: text("deployment_status").default("not_started"),
  heatmapScore: integer("heatmap_score"),
  riskScore: integer("risk_score"),
  slaHours: integer("sla_hours"),
  isPrimary: boolean("is_primary").default(false),
  lastValidatedAt: timestamp("last_validated_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Data Model ↔ System mappings - captures integration footprint across systems
export const dataModelSystemMappings = pgTable("data_model_system_mappings", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").references(() => dataModels.id).notNull(),
  systemId: integer("system_id").references(() => systems.id).notNull(),
  relationshipType: text("relationship_type").default("integration"),
  systemRole: text("system_role").default("consumer"),
  lifecycleState: text("lifecycle_state").default("planned"),
  connectionPattern: text("connection_pattern"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Model Lifecycle Assignments - Tracks lifecycle progress by model
export const modelLifecycleAssignments = pgTable("model_lifecycle_assignments", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").references(() => dataModels.id).notNull(),
  phaseId: integer("phase_id").references(() => modelLifecyclePhases.id).notNull(),
  status: text("status").default("not_started"),
  approvalStatus: text("approval_status").default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  approvedBy: text("approved_by"),
  nextReviewAt: timestamp("next_review_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Application Configuration
export const configurations = pgTable("configurations", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // "ai", "database", "ui", "export"
  key: text("key").notNull(),
  value: jsonb("value").$type<any>(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const systemsRelations = relations(systems, ({ many }) => ({
  sourceDataModels: many(dataModels, { relationName: "targetSystem" }),
  sourceDataObjects: many(dataObjects, { relationName: "sourceSystem" }),
  targetDataObjects: many(dataObjects, { relationName: "targetSystem" }),
  targetModelObjects: many(dataModelObjects, { relationName: "targetSystem" }),
  capabilitySystemMappings: many(capabilitySystemMappings),
  capabilityModelSystemMappings: many(capabilityModelSystemMappings),
  dataModelSystemMappings: many(dataModelSystemMappings),
}));

export const dataModelsRelations = relations(dataModels, ({ many, one }) => ({
  modelObjects: many(dataModelObjects),
  modelAttributes: many(dataModelAttributes),
  relationships: many(dataModelObjectRelationships),
  properties: many(dataModelProperties),
  targetSystem: one(systems, {
    fields: [dataModels.targetSystemId],
    references: [systems.id],
    relationName: "targetSystem"
  }),
  domain: one(dataDomains, {
    fields: [dataModels.domainId],
    references: [dataDomains.id],
  }),
  dataArea: one(dataAreas, {
    fields: [dataModels.dataAreaId],
    references: [dataAreas.id],
  }),
  parentModel: one(dataModels, {
    fields: [dataModels.parentModelId],
    references: [dataModels.id],
    relationName: "parentModel"
  }),
  childModels: many(dataModels, {
    relationName: "parentModel"
  }),
  capabilityMappings: many(capabilityDataModelMappings),
  capabilityModelSystemMappings: many(capabilityModelSystemMappings),
  systemMappings: many(dataModelSystemMappings),
  lifecycleAssignments: many(modelLifecycleAssignments),
}));

export const dataDomainsRelations = relations(dataDomains, ({ many }) => ({
  dataAreas: many(dataAreas),
  dataModels: many(dataModels),
  dataObjects: many(dataObjects),
}));

export const dataAreasRelations = relations(dataAreas, ({ one, many }) => ({
  domain: one(dataDomains, {
    fields: [dataAreas.domainId],
    references: [dataDomains.id],
  }),
  dataModels: many(dataModels),
  dataObjects: many(dataObjects),
}));

export const dataObjectsRelations = relations(dataObjects, ({ one, many }) => ({
  domain: one(dataDomains, {
    fields: [dataObjects.domainId],
    references: [dataDomains.id],
  }),
  dataArea: one(dataAreas, {
    fields: [dataObjects.dataAreaId],
    references: [dataAreas.id],
  }),
  sourceSystem: one(systems, {
    fields: [dataObjects.sourceSystemId],
    references: [systems.id],
    relationName: "sourceSystem"
  }),
  targetSystem: one(systems, {
    fields: [dataObjects.targetSystemId],
    references: [systems.id],
    relationName: "targetSystem"
  }),
  sourceRelationships: many(dataObjectRelationships, {
    relationName: "sourceDataObject",
  }),
  targetRelationships: many(dataObjectRelationships, {
    relationName: "targetDataObject",
  }),
  modelObjects: many(dataModelObjects),
}));

export const dataModelObjectsRelations = relations(dataModelObjects, ({ one, many }) => ({
  object: one(dataObjects, {
    fields: [dataModelObjects.objectId],
    references: [dataObjects.id],
  }),
  model: one(dataModels, {
    fields: [dataModelObjects.modelId],
    references: [dataModels.id],
  }),
  targetSystem: one(systems, {
    fields: [dataModelObjects.targetSystemId],
    references: [systems.id],
    relationName: "targetSystem"
  }),
  modelAttributes: many(dataModelAttributes),
  sourceRelationships: many(dataModelObjectRelationships, {
    relationName: "sourceModelObject",
  }),
  targetRelationships: many(dataModelObjectRelationships, {
    relationName: "targetModelObject",
  }),
}));

export const attributesRelations = relations(attributes, ({ many }) => ({
  modelAttributes: many(dataModelAttributes),
}));

export const dataModelAttributesRelations = relations(dataModelAttributes, ({ one }) => ({
  attribute: one(attributes, {
    fields: [dataModelAttributes.attributeId],
    references: [attributes.id],
  }),
  modelObject: one(dataModelObjects, {
    fields: [dataModelAttributes.modelObjectId],
    references: [dataModelObjects.id],
  }),
  model: one(dataModels, {
    fields: [dataModelAttributes.modelId],
    references: [dataModels.id],
  }),
}));

export const dataModelPropertiesRelations = relations(dataModelProperties, ({ one }) => ({
  model: one(dataModels, {
    fields: [dataModelProperties.modelId],
    references: [dataModels.id],
  }),
}));

export const dataObjectRelationshipsRelations = relations(dataObjectRelationships, ({ one }) => ({
  sourceDataObject: one(dataObjects, {
    fields: [dataObjectRelationships.sourceDataObjectId],
    references: [dataObjects.id],
    relationName: "sourceDataObject",
  }),
  targetDataObject: one(dataObjects, {
    fields: [dataObjectRelationships.targetDataObjectId],
    references: [dataObjects.id],
    relationName: "targetDataObject",
  }),
  sourceAttribute: one(attributes, {
    fields: [dataObjectRelationships.sourceAttributeId],
    references: [attributes.id],
  }),
  targetAttribute: one(attributes, {
    fields: [dataObjectRelationships.targetAttributeId],
    references: [attributes.id],
  }),
}));

export const dataModelObjectRelationshipsRelations = relations(dataModelObjectRelationships, ({ one }) => ({
  sourceModelObject: one(dataModelObjects, {
    fields: [dataModelObjectRelationships.sourceModelObjectId],
    references: [dataModelObjects.id],
    relationName: "sourceModelObject",
  }),
  targetModelObject: one(dataModelObjects, {
    fields: [dataModelObjectRelationships.targetModelObjectId],
    references: [dataModelObjects.id],
    relationName: "targetModelObject",
  }),
  sourceAttribute: one(dataModelAttributes, {
    fields: [dataModelObjectRelationships.sourceAttributeId],
    references: [dataModelAttributes.id],
  }),
  targetAttribute: one(dataModelAttributes, {
    fields: [dataModelObjectRelationships.targetAttributeId],
    references: [dataModelAttributes.id],
  }),
  model: one(dataModels, {
    fields: [dataModelObjectRelationships.modelId],
    references: [dataModels.id],
  }),
}));

// Business Capability Relations
export const businessCapabilitiesRelations = relations(businessCapabilities, ({ one, many }) => ({
  parent: one(businessCapabilities, {
    fields: [businessCapabilities.parentId],
    references: [businessCapabilities.id],
    relationName: "parent",
  }),
  children: many(businessCapabilities, {
    relationName: "parent",
  }),
  domainMappings: many(capabilityDataDomainMappings),
  datAreaMappings: many(capabilityDataAreaMappings),
  systemMappings: many(capabilitySystemMappings),
  dataModelMappings: many(capabilityDataModelMappings),
  capabilityModelSystemMappings: many(capabilityModelSystemMappings),
}));

export const capabilityDataDomainMappingsRelations = relations(capabilityDataDomainMappings, ({ one }) => ({
  capability: one(businessCapabilities, {
    fields: [capabilityDataDomainMappings.capabilityId],
    references: [businessCapabilities.id],
  }),
  domain: one(dataDomains, {
    fields: [capabilityDataDomainMappings.domainId],
    references: [dataDomains.id],
  }),
}));

export const capabilityDataAreaMappingsRelations = relations(capabilityDataAreaMappings, ({ one }) => ({
  capability: one(businessCapabilities, {
    fields: [capabilityDataAreaMappings.capabilityId],
    references: [businessCapabilities.id],
  }),
  dataArea: one(dataAreas, {
    fields: [capabilityDataAreaMappings.dataAreaId],
    references: [dataAreas.id],
  }),
}));

export const capabilitySystemMappingsRelations = relations(capabilitySystemMappings, ({ one }) => ({
  capability: one(businessCapabilities, {
    fields: [capabilitySystemMappings.capabilityId],
    references: [businessCapabilities.id],
  }),
  system: one(systems, {
    fields: [capabilitySystemMappings.systemId],
    references: [systems.id],
  }),
}));

export const capabilityDataModelMappingsRelations = relations(capabilityDataModelMappings, ({ one }) => ({
  capability: one(businessCapabilities, {
    fields: [capabilityDataModelMappings.capabilityId],
    references: [businessCapabilities.id],
  }),
  model: one(dataModels, {
    fields: [capabilityDataModelMappings.modelId],
    references: [dataModels.id],
  }),
  domain: one(dataDomains, {
    fields: [capabilityDataModelMappings.domainId],
    references: [dataDomains.id],
  }),
  lifecyclePhase: one(modelLifecyclePhases, {
    fields: [capabilityDataModelMappings.lifecyclePhaseId],
    references: [modelLifecyclePhases.id],
  }),
}));

export const capabilityModelSystemMappingsRelations = relations(capabilityModelSystemMappings, ({ one }) => ({
  capability: one(businessCapabilities, {
    fields: [capabilityModelSystemMappings.capabilityId],
    references: [businessCapabilities.id],
  }),
  model: one(dataModels, {
    fields: [capabilityModelSystemMappings.modelId],
    references: [dataModels.id],
  }),
  system: one(systems, {
    fields: [capabilityModelSystemMappings.systemId],
    references: [systems.id],
  }),
}));

export const dataModelSystemMappingsRelations = relations(dataModelSystemMappings, ({ one }) => ({
  model: one(dataModels, {
    fields: [dataModelSystemMappings.modelId],
    references: [dataModels.id],
  }),
  system: one(systems, {
    fields: [dataModelSystemMappings.systemId],
    references: [systems.id],
  }),
}));

export const modelLifecyclePhasesRelations = relations(modelLifecyclePhases, ({ many }) => ({
  assignments: many(modelLifecycleAssignments),
  capabilityMappings: many(capabilityDataModelMappings),
}));

export const modelLifecycleAssignmentsRelations = relations(modelLifecycleAssignments, ({ one }) => ({
  model: one(dataModels, {
    fields: [modelLifecycleAssignments.modelId],
    references: [dataModels.id],
  }),
  phase: one(modelLifecyclePhases, {
    fields: [modelLifecycleAssignments.phaseId],
    references: [modelLifecyclePhases.id],
  }),
}));

// Insert Schemas
export const insertDataModelSchema = createInsertSchema(dataModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataDomainSchema = createInsertSchema(dataDomains).omit({
  id: true,
});

export const insertDataAreaSchema = createInsertSchema(dataAreas).omit({
  id: true,
});

export const insertDataObjectSchema = createInsertSchema(dataObjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataModelObjectSchema = createInsertSchema(dataModelObjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAttributeSchema = createInsertSchema(attributes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataModelAttributeSchema = createInsertSchema(dataModelAttributes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataModelPropertySchema = createInsertSchema(dataModelProperties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataObjectRelationshipSchema = createInsertSchema(dataObjectRelationships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataModelObjectRelationshipSchema = createInsertSchema(dataModelObjectRelationships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemSchema = createInsertSchema(systems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertColorThemeSchema = createInsertSchema(colorThemes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEntityColorAssignmentSchema = createInsertSchema(entityColorAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConfigurationSchema = createInsertSchema(configurations).omit({
  id: true,
  updatedAt: true,
});

export const insertBusinessCapabilitySchema = createInsertSchema(businessCapabilities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCapabilityDataDomainMappingSchema = createInsertSchema(capabilityDataDomainMappings).omit({
  id: true,
  createdAt: true,
});

export const insertCapabilityDataAreaMappingSchema = createInsertSchema(capabilityDataAreaMappings).omit({
  id: true,
  createdAt: true,
});

export const insertCapabilitySystemMappingSchema = createInsertSchema(capabilitySystemMappings).omit({
  id: true,
  createdAt: true,
});

export const insertCapabilityDataModelMappingSchema = createInsertSchema(capabilityDataModelMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCapabilityModelSystemMappingSchema = createInsertSchema(capabilityModelSystemMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataModelSystemMappingSchema = createInsertSchema(dataModelSystemMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModelLifecyclePhaseSchema = createInsertSchema(modelLifecyclePhases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModelLifecycleAssignmentSchema = createInsertSchema(modelLifecycleAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type DataModel = typeof dataModels.$inferSelect;
export type InsertDataModel = z.infer<typeof insertDataModelSchema>;

export type DataDomain = typeof dataDomains.$inferSelect;
export type InsertDataDomain = z.infer<typeof insertDataDomainSchema>;

export type DataArea = typeof dataAreas.$inferSelect;
export type InsertDataArea = z.infer<typeof insertDataAreaSchema>;

export type DataObject = typeof dataObjects.$inferSelect;
export type InsertDataObject = z.infer<typeof insertDataObjectSchema>;

export type DataModelObject = typeof dataModelObjects.$inferSelect;
export type InsertDataModelObject = z.infer<typeof insertDataModelObjectSchema>;

export type Attribute = typeof attributes.$inferSelect;
export type InsertAttribute = z.infer<typeof insertAttributeSchema>;

export type DataModelAttribute = typeof dataModelAttributes.$inferSelect;
export type InsertDataModelAttribute = z.infer<typeof insertDataModelAttributeSchema>;

export type DataModelProperty = typeof dataModelProperties.$inferSelect;
export type InsertDataModelProperty = z.infer<typeof insertDataModelPropertySchema>;

export type DataObjectRelationship = typeof dataObjectRelationships.$inferSelect;
export type InsertDataObjectRelationship = z.infer<typeof insertDataObjectRelationshipSchema>;

export type DataModelObjectRelationship = typeof dataModelObjectRelationships.$inferSelect;
export type InsertDataModelObjectRelationship = z.infer<typeof insertDataModelObjectRelationshipSchema>;

export type System = typeof systems.$inferSelect;
export type InsertSystem = z.infer<typeof insertSystemSchema>;

export type ColorTheme = typeof colorThemes.$inferSelect;
export type InsertColorTheme = z.infer<typeof insertColorThemeSchema>;

export type EntityColorAssignment = typeof entityColorAssignments.$inferSelect;
export type InsertEntityColorAssignment = z.infer<typeof insertEntityColorAssignmentSchema>;

export type Configuration = typeof configurations.$inferSelect;
export type InsertConfiguration = z.infer<typeof insertConfigurationSchema>;

export type BusinessCapability = typeof businessCapabilities.$inferSelect;
export type InsertBusinessCapability = z.infer<typeof insertBusinessCapabilitySchema>;

export type CapabilityDataDomainMapping = typeof capabilityDataDomainMappings.$inferSelect;
export type InsertCapabilityDataDomainMapping = z.infer<typeof insertCapabilityDataDomainMappingSchema>;

export type CapabilityDataAreaMapping = typeof capabilityDataAreaMappings.$inferSelect;
export type InsertCapabilityDataAreaMapping = z.infer<typeof insertCapabilityDataAreaMappingSchema>;

export type CapabilitySystemMapping = typeof capabilitySystemMappings.$inferSelect;
export type InsertCapabilitySystemMapping = z.infer<typeof insertCapabilitySystemMappingSchema>;

export type CapabilityDataModelMapping = typeof capabilityDataModelMappings.$inferSelect;
export type InsertCapabilityDataModelMapping = z.infer<typeof insertCapabilityDataModelMappingSchema>;

export type CapabilityModelSystemMapping = typeof capabilityModelSystemMappings.$inferSelect;
export type InsertCapabilityModelSystemMapping = z.infer<typeof insertCapabilityModelSystemMappingSchema>;

export type DataModelSystemMapping = typeof dataModelSystemMappings.$inferSelect;
export type InsertDataModelSystemMapping = z.infer<typeof insertDataModelSystemMappingSchema>;

export type ModelLifecyclePhase = typeof modelLifecyclePhases.$inferSelect;
export type InsertModelLifecyclePhase = z.infer<typeof insertModelLifecyclePhaseSchema>;

export type ModelLifecycleAssignment = typeof modelLifecycleAssignments.$inferSelect;
export type InsertModelLifecycleAssignment = z.infer<typeof insertModelLifecycleAssignmentSchema>;
