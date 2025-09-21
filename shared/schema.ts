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

// Attributes (Columns/Fields) - Attributes with object associations (current DB structure)
export const attributes = pgTable("attributes", {
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

// Relationships - Enhanced to support both object-level and attribute-level relationships
export const relationships = pgTable("relationships", {
  id: serial("id").primaryKey(),
  sourceModelObjectId: integer("source_model_object_id").references(() => dataModelObjects.id).notNull(),
  targetModelObjectId: integer("target_model_object_id").references(() => dataModelObjects.id).notNull(),
  type: text("type").notNull(), // "1:1", "1:N", "N:M"
  relationshipLevel: text("relationship_level").notNull(), // "object", "attribute"
  sourceAttributeId: integer("source_attribute_id").references(() => dataModelAttributes.id),
  targetAttributeId: integer("target_attribute_id").references(() => dataModelAttributes.id),
  modelId: integer("model_id").references(() => dataModels.id).notNull(),
  layer: text("layer").notNull(), // "conceptual", "logical", "physical"
  name: text("name"), // Optional relationship name
  description: text("description"),
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
}));

export const dataModelsRelations = relations(dataModels, ({ many, one }) => ({
  modelObjects: many(dataModelObjects),
  modelAttributes: many(dataModelAttributes),
  relationships: many(relationships),
  properties: many(dataModelProperties),
  targetSystem: one(systems, {
    fields: [dataModels.targetSystemId],
    references: [systems.id],
    relationName: "targetSystem"
  }),
  parentModel: one(dataModels, {
    fields: [dataModels.parentModelId],
    references: [dataModels.id],
    relationName: "parentModel"
  }),
  childModels: many(dataModels, {
    relationName: "parentModel"
  }),
}));

export const dataDomainsRelations = relations(dataDomains, ({ many }) => ({
  dataAreas: many(dataAreas),
  dataObjects: many(dataObjects),
}));

export const dataAreasRelations = relations(dataAreas, ({ one, many }) => ({
  domain: one(dataDomains, {
    fields: [dataAreas.domainId],
    references: [dataDomains.id],
  }),
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
  sourceRelationships: many(relationships, {
    relationName: "sourceModelObject",
  }),
  targetRelationships: many(relationships, {
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

export const relationshipsRelations = relations(relationships, ({ one }) => ({
  sourceModelObject: one(dataModelObjects, {
    fields: [relationships.sourceModelObjectId],
    references: [dataModelObjects.id],
    relationName: "sourceModelObject",
  }),
  targetModelObject: one(dataModelObjects, {
    fields: [relationships.targetModelObjectId],
    references: [dataModelObjects.id],
    relationName: "targetModelObject",
  }),
  sourceAttribute: one(dataModelAttributes, {
    fields: [relationships.sourceAttributeId],
    references: [dataModelAttributes.id],
  }),
  targetAttribute: one(dataModelAttributes, {
    fields: [relationships.targetAttributeId],
    references: [dataModelAttributes.id],
  }),
  model: one(dataModels, {
    fields: [relationships.modelId],
    references: [dataModels.id],
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

export const insertRelationshipSchema = createInsertSchema(relationships).omit({
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

export type Relationship = typeof relationships.$inferSelect;
export type InsertRelationship = z.infer<typeof insertRelationshipSchema>;

export type System = typeof systems.$inferSelect;
export type InsertSystem = z.infer<typeof insertSystemSchema>;

export type ColorTheme = typeof colorThemes.$inferSelect;
export type InsertColorTheme = z.infer<typeof insertColorThemeSchema>;

export type EntityColorAssignment = typeof entityColorAssignments.$inferSelect;
export type InsertEntityColorAssignment = z.infer<typeof insertEntityColorAssignmentSchema>;

export type Configuration = typeof configurations.$inferSelect;
export type InsertConfiguration = z.infer<typeof insertConfigurationSchema>;
