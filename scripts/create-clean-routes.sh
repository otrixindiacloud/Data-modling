#!/bin/bash

# Script to create a clean routes.ts that imports from utility files

BACKUP_FILE="/workspaces/Data-modling/server/routes.ts.backup"
NEW_ROUTES="/workspaces/Data-modling/server/routes_clean.ts"

echo "Creating clean routes.ts with utility imports..."

cat > "$NEW_ROUTES" << 'EOF'
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
  mapLogicalToPhysicalType,
  mapConceptualToLogicalType,
  getDefaultLength,
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

// Import schema types
import { 
  insertDataModelSchema,
  insertDataDomainSchema,
  insertDataAreaSchema,
  insertDataObjectSchema,
  insertAttributeSchema,
  insertDataObjectRelationshipSchema,
  insertDataModelObjectRelationshipSchema,
  insertSystemSchema,
  insertConfigurationSchema,
  type DataModel,
  type DataModelObject,
  type DataModelAttribute,
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
  type InsertDataModelAttribute,
  type InsertDataObjectRelationship
} from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
EOF

# Add all the route definitions (starting from line 1185)
sed -n '1185,5625p' "$BACKUP_FILE" >> "$NEW_ROUTES"

# Add the closing
echo "  const httpServer = createServer(app);" >> "$NEW_ROUTES"
echo "  return httpServer;" >> "$NEW_ROUTES"
echo "}" >> "$NEW_ROUTES"

echo "Clean routes.ts created successfully!"
echo "File location: $NEW_ROUTES"
echo ""
echo "This file imports all utilities from the utils directory"
echo "and contains only the route definitions."
