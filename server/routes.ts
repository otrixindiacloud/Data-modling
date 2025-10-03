import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { aiEngine } from "./services/aiEngine";
import { dataConnectors, type ADLSConnectionConfig, type DatabaseConnectionConfig, type TableMetadata } from "./services/dataConnectors";
import { exportService } from "./services/exportService";
import { modelingAgentService } from "./services/modelingAgent";

// Helper functions for data type conversion
function mapLogicalToPhysicalType(logicalType: string | null): string {
  if (!logicalType) return "VARCHAR(255)";
  
  const typeMap: { [key: string]: string } = {
    // Logical to Physical type mapping
    "VARCHAR": "VARCHAR(255)",
    "INTEGER": "INT",
    "DECIMAL": "DECIMAL(10,2)",
    "DATE": "DATE",
    "DATETIME": "DATETIME",
    "BOOLEAN": "TINYINT(1)",
    "TEXT": "TEXT",
    "BLOB": "BLOB",
    "JSON": "JSON",
    "UUID": "CHAR(36)",
    "ENUM": "ENUM",
    // Conceptual to Physical (for backward compatibility)
    "Text": "VARCHAR(255)",
    "Number": "INTEGER",
    "Date": "DATE",
    "DateTime": "TIMESTAMP",
    "Time": "TIME",
    "Boolean": "BOOLEAN",
    "Binary": "BLOB",
    "Email": "VARCHAR(255)",
    "Phone": "VARCHAR(20)",
    "URL": "VARCHAR(500)",
    "Currency": "DECIMAL(12,2)",
    "Percentage": "DECIMAL(5,2)",
    "Integer": "INTEGER",
    "BigInteger": "BIGINT",
    "Float": "FLOAT",
    "Double": "DOUBLE",
    "String": "VARCHAR(255)",
    "LongText": "TEXT",
    "MediumText": "MEDIUMTEXT"
  };
  
  return typeMap[logicalType] || "VARCHAR(255)";
}

function mapConceptualToLogicalType(conceptualType: string | null): string {
  if (!conceptualType) return "VARCHAR";
  
  const typeMap: { [key: string]: string } = {
    "Text": "VARCHAR",
    "Number": "INTEGER",
    "Date": "DATE",
    "Boolean": "BOOLEAN",
    "Currency": "DECIMAL",
    "Percentage": "DECIMAL",
    "Email": "VARCHAR",
    "Phone": "VARCHAR",
    "URL": "VARCHAR",
    "Image": "VARCHAR",
    "Document": "VARCHAR",
    "Location": "VARCHAR"
  };
  
  return typeMap[conceptualType] || "VARCHAR";
}

function getDefaultLength(dataType: string | null): number | null {
  if (!dataType) return null;
  
  const lengthMap: { [key: string]: number } = {
    "Text": 255,
    "String": 255,
    "Email": 255,
    "Phone": 20,
    "URL": 500,
    "UUID": 36,
    "Currency": 12,
    "Percentage": 5,
    "Decimal": 10
  };
  
  return lengthMap[dataType] || null;
}
import { 
  insertDataModelSchema,
  insertDataDomainSchema,
  insertDataAreaSchema,
  insertDataObjectSchema,
  insertAttributeSchema,
  insertRelationshipSchema,
  insertSystemSchema,
  insertConfigurationSchema,
  type DataModel,
  type DataObject,
  type System
} from "@shared/schema";
import { getTargetSystemTemplate } from "./services/targetSystemTemplates";
import multer from "multer";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });

const configurationUpdateSchema = z
  .object({
    value: z.any().optional(),
    description: z.string().optional(),
  })
  .refine((data) => data.value !== undefined || data.description !== undefined, {
    message: "At least one of value or description is required",
  });

const systemObjectUpdateSchema = z.object({
  domainId: z.number().int().positive().nullable().optional(),
  dataAreaId: z.number().int().positive().nullable().optional(),
  description: z.string().nullable().optional(),
});

const systemSyncRequestSchema = z.object({
  modelId: z.number().int().positive(),
  direction: z.enum(["source", "target"] as const).default("source").optional(),
  includeAttributes: z.boolean().default(true).optional(),
  domainId: z.number().int().positive().nullable().optional(),
  dataAreaId: z.number().int().positive().nullable().optional(),
  metadataOnly: z.boolean().default(false).optional(),
});

const modelingAgentRequestSchema = z
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

type SystemObjectDirection = "source" | "target";

function coerceNumericId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function extractPreferredDomainId(system: System, override?: number | null): number | null {
  if (typeof override === "number") {
    return override;
  }

  const configuration = (system.configuration ?? {}) as Record<string, unknown>;
  const direct = coerceNumericId(configuration.domainId);
  if (direct !== null) {
    return direct;
  }

  const domainIds = Array.isArray(configuration.domainIds)
    ? (configuration.domainIds as unknown[])
        .map((value) => coerceNumericId(value))
        .filter((value): value is number => value !== null)
    : [];

  if (domainIds.length > 0) {
    return domainIds[0];
  }

  return null;
}

function extractPreferredDataAreaIds(system: System, override?: number[] | null): number[] {
  if (override && override.length) {
    return override.filter((value) => Number.isFinite(value));
  }

  const configuration = (system.configuration ?? {}) as Record<string, unknown>;
  const areaIds = Array.isArray(configuration.dataAreaIds)
    ? (configuration.dataAreaIds as unknown[])
        .map((value) => coerceNumericId(value))
        .filter((value): value is number => value !== null)
    : [];

  return areaIds;
}

function mapToDatabaseConnectorType(type?: string): DatabaseConnectionConfig["type"] {
  const normalized = (type ?? "").toLowerCase();
  if (normalized.includes("postgres")) {
    return "postgres";
  }
  if (normalized.includes("mysql") || normalized.includes("maria")) {
    return "mysql";
  }
  if (normalized.includes("hana")) {
    return "sap_hana";
  }
  if (normalized.includes("oracle")) {
    return "oracle";
  }
  if ((normalized.includes("sql") || normalized.includes("mssql")) && !normalized.includes("nosql")) {
    return "sql_server";
  }
  return "generic_sql";
}

function parseConnectionString(connectionString?: string | null): DatabaseConnectionConfig | null {
  if (!connectionString) {
    return null;
  }

  const trimmed = connectionString.trim();

  if (trimmed.includes("://")) {
    try {
      const uri = new URL(trimmed);
      const protocol = uri.protocol.replace(":", "");
      const mappedType = mapToDatabaseConnectorType(protocol);
      const defaultPorts: Record<DatabaseConnectionConfig["type"], number> = {
        sql_server: 1433,
        postgres: 5432,
        mysql: 3306,
        oracle: 1521,
        sap_hana: 30015,
        generic_sql: 1433,
      };

      const database = decodeURIComponent(uri.pathname.replace(/^\//, "")) || "default";
      const username = decodeURIComponent(uri.username || "");
      const password = decodeURIComponent(uri.password || "");
      const host = uri.hostname;
      const port = uri.port ? Number(uri.port) : defaultPorts[mappedType] ?? 1433;
      const sslMode = uri.searchParams.get("sslmode") ?? undefined;
      const schema = uri.searchParams.get("schema") ?? undefined;

      if (!host || !username) {
        return null;
      }

      return {
        type: mappedType,
        host,
        port,
        database,
        username,
        password,
        sslMode,
        schema,
      } satisfies DatabaseConnectionConfig;
    } catch (error) {
      console.warn("Failed to parse connection URI, falling back to key-value parser:", error);
    }
  }

  const segments = trimmed
    .split(";")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const values = new Map<string, string>();
  for (const segment of segments) {
    const [key, ...rest] = segment.split("=");
    if (!key || rest.length === 0) continue;
    values.set(key.trim().toLowerCase(), rest.join("=").trim());
  }

  const host = values.get("server") ?? values.get("data source") ?? values.get("host");
  const database = values.get("database") ?? values.get("initial catalog") ?? "default";
  const username = values.get("user id") ?? values.get("uid") ?? values.get("username");
  const password = values.get("password") ?? values.get("pwd") ?? "";
  const portValue = values.get("port");
  const port = portValue ? Number(portValue) : NaN;

  if (!host || !username) {
    return null;
  }

  return {
    type: "sql_server",
    host,
    port: Number.isFinite(port) ? Number(port) : 1433,
    database,
    username,
    password,
  } satisfies DatabaseConnectionConfig;
}

function buildDatabaseConfig(
  configuration: Record<string, unknown> | null | undefined,
  connectionString?: string | null,
  systemType?: string
): DatabaseConnectionConfig | null {
  if (configuration) {
    const host = (configuration.host as string) ?? (configuration.hostname as string);
    const username = (configuration.username as string) ?? (configuration.user as string) ?? (configuration.userName as string);

    if (host && username) {
      const database = (configuration.database as string) ?? (configuration.db as string) ?? "default";
      const portRaw = configuration.port ?? configuration.portNumber ?? configuration.portnum;
      const numericPort =
        portRaw === "" || portRaw === null || typeof portRaw === "undefined"
          ? NaN
          : Number(portRaw);
      const password = (configuration.password as string) ?? (configuration.pass as string) ?? (configuration.secret as string) ?? "";
      const mappedType = mapToDatabaseConnectorType((configuration.type as string) ?? systemType);
      const schema = (configuration.schema as string) ?? undefined;
      const sslMode = (configuration.sslMode as string) ?? (configuration.sslmode as string) ?? undefined;
      const defaultPorts: Record<DatabaseConnectionConfig["type"], number> = {
        sql_server: 1433,
        postgres: 5432,
        mysql: 3306,
        oracle: 1521,
        sap_hana: 30015,
        generic_sql: 1433,
      };
      const resolvedPort = Number.isFinite(numericPort)
        ? Number(numericPort)
        : defaultPorts[mappedType] ?? 1433;

      return {
        type: mappedType,
        host,
        port: resolvedPort,
        database,
        username,
        password,
        schema,
        sslMode,
      } satisfies DatabaseConnectionConfig;
    }
  }

  return parseConnectionString(connectionString);
}

function buildAdlsConfig(
  configuration: Record<string, unknown> | null | undefined,
): ADLSConnectionConfig | null {
  if (!configuration) {
    return null;
  }

  const storageAccount = (configuration.storageAccount as string) ?? (configuration.accountName as string) ?? (configuration.account as string);
  const containerName = (configuration.containerName as string) ?? (configuration.container as string);

  if (!storageAccount || !containerName) {
    return null;
  }

  return {
    type: "adls_gen2",
    storageAccount,
    containerName,
    path: ((configuration.path as string) ?? (configuration.directory as string) ?? "") || "",
    sasToken: (configuration.sasToken as string) ?? (configuration.sas_token as string) ?? undefined,
    accessKey: (configuration.accessKey as string) ?? (configuration.access_key as string) ?? undefined,
  } satisfies ADLSConnectionConfig;
}

async function testSystemConnectivity(
  system: System,
  override?: {
    type?: string;
    configuration?: Record<string, unknown>;
    connectionString?: string | null;
  }
): Promise<{ connected: boolean; message?: string }> {
  const effectiveType = (override?.type ?? system.type ?? "").toLowerCase();
  const configuration = (override?.configuration ?? system.configuration ?? {}) as Record<string, unknown>;
  const connectionString = override?.connectionString ?? system.connectionString ?? null;

  if (effectiveType === "adls") {
    const adlsConfig = buildAdlsConfig(configuration);
    if (!adlsConfig) {
      return { connected: false, message: "Missing ADLS configuration" };
    }

    const connected = await dataConnectors.testADLSConnection(adlsConfig);
    return { connected, message: connected ? undefined : "Connection test failed" };
  }

  const dbConfig = buildDatabaseConfig(configuration, connectionString, effectiveType);
  if (!dbConfig) {
    return { connected: false, message: "Missing connection details" };
  }

  const connected = await dataConnectors.testDatabaseConnection(dbConfig);
  return { connected, message: connected ? undefined : "Connection test failed" };
}

async function retrieveSystemMetadata(
  system: System,
  options?: {
    configurationOverride?: Record<string, unknown>;
    connectionStringOverride?: string | null;
  }
): Promise<TableMetadata[]> {
  const effectiveType = (system.type ?? "").toLowerCase();
  const configuration = (options?.configurationOverride ?? system.configuration ?? {}) as Record<string, unknown>;
  const connectionString = options?.connectionStringOverride ?? system.connectionString ?? null;

  if (effectiveType === "adls") {
    const adlsConfig = buildAdlsConfig(configuration);
    if (!adlsConfig) {
      return [];
    }
    return await dataConnectors.listADLSDatasets(adlsConfig);
  }

  const dbConfig =
    buildDatabaseConfig(configuration, connectionString, system.type) ?? ({
      type: "sql_server",
      host: "localhost",
      port: 1433,
      database: "default",
      username: system.name ?? "system",
      password: "",
    } satisfies DatabaseConnectionConfig);

  return await dataConnectors.extractDatabaseMetadata(dbConfig);
}

async function upsertConfigurationEntry(input: unknown) {
  const validatedData = insertConfigurationSchema.parse(input);
  const existing = await storage.getConfigurationByCategoryAndKey(
    validatedData.category,
    validatedData.key
  );

  const fallbackDescription = `${validatedData.category}.${validatedData.key} configuration`;

  if (existing) {
    const updated = await storage.updateConfiguration(existing.id, {
      value: validatedData.value,
      description:
        validatedData.description ?? existing.description ?? fallbackDescription,
    });

    return { configuration: updated, created: false as const };
  }

  const created = await storage.createConfiguration({
    category: validatedData.category,
    key: validatedData.key,
    value: validatedData.value,
    description: validatedData.description ?? fallbackDescription,
  });

  return { configuration: created, created: true as const };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Data Models
  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getDataModels();
      res.json(models);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch models" });
    }
  });

  app.get("/api/models/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const model = await storage.getDataModel(id);
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
      const validatedData = insertDataModelSchema.parse(req.body);
      const model = await storage.createDataModel(validatedData);
      res.status(201).json(model);
    } catch (error) {
      res.status(400).json({ message: "Invalid model data" });
    }
  });

  // Create model with all 3 layers (Conceptual, Logical, Physical)
  app.post("/api/models/create-with-layers", async (req, res) => {
    try {
      const { name, targetSystem, targetSystemId, domainId, dataAreaId } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Model name is required" });
      }

      const parseOptionalNumber = (value: unknown): number | null => {
        if (value === undefined || value === null || value === "") {
          return null;
        }
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
      };

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

      const parsedDomainId = parseOptionalNumber(domainId);
      let domainRecord = parsedDomainId ? await storage.getDataDomain(parsedDomainId) : null;
      if (parsedDomainId && !domainRecord) {
        return res.status(400).json({ message: "Selected domain does not exist" });
      }

      const parsedDataAreaId = parseOptionalNumber(dataAreaId);
      let dataAreaRecord = parsedDataAreaId ? await storage.getDataArea(parsedDataAreaId) : null;
      if (parsedDataAreaId && !dataAreaRecord) {
        return res.status(400).json({ message: "Selected data area does not exist" });
      }

      if (dataAreaRecord) {
        if (domainRecord && dataAreaRecord.domainId !== domainRecord.id) {
          return res.status(400).json({ message: "Selected data area does not belong to the provided domain" });
        }
        if (!domainRecord) {
          domainRecord = await storage.getDataDomain(dataAreaRecord.domainId) ?? null;
        }
      }

      const resolvedDomainId = domainRecord?.id ?? null;
      const resolvedDataAreaId = dataAreaRecord?.id ?? null;

      // Create conceptual model first (parent model)
      const conceptualModel = await storage.createDataModel({
        name: name,
        layer: "conceptual",
        targetSystemId: resolvedTargetSystemId,
        domainId: resolvedDomainId,
        dataAreaId: resolvedDataAreaId,
      });

      // Create logical model linked to conceptual
      const logicalModel = await storage.createDataModel({
        name: name,
        layer: "logical", 
        parentModelId: conceptualModel.id,
        targetSystemId: resolvedTargetSystemId,
        domainId: resolvedDomainId,
        dataAreaId: resolvedDataAreaId,
      });

      // Create physical model linked to conceptual
      const physicalModel = await storage.createDataModel({
        name: name,
        layer: "physical",
        parentModelId: conceptualModel.id,
        targetSystemId: resolvedTargetSystemId,
        domainId: resolvedDomainId,
        dataAreaId: resolvedDataAreaId,
      });

      // Get template objects and attributes for the selected target system
      const template = getTargetSystemTemplate(selectedTargetSystem);
      if (template) {
        console.log(`Adding template objects for ${selectedTargetSystem}...`);
        
        // Create domains and data areas from template
        const createdDomains = new Map<string, number>();
        const createdAreas = new Map<string, number>();
        
        for (const domainName of template.defaultDomains) {
          // Check if domain already exists
          let domain = await storage.getDataDomainByName(domainName);
          if (!domain) {
            domain = await storage.createDataDomain({
              name: domainName,
              description: `${domainName} domain for ${selectedTargetSystem}`
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
                  description: `${areaName} area in ${domainName} domain`
                });
              }
              createdAreas.set(`${domainName}:${areaName}`, area.id);
            } catch (error) {
              console.log(`Error creating area ${areaName}:`, error);
            }
          }
        }

        // Helper function to get system ID from name
        const getSystemId = async (systemName: string) => {
          const systems = await storage.getSystems();
          const system = systems.find(s => s.name === systemName);
          return system?.id || null;
        };

        // Create template objects and attributes in all three layers
        for (const templateObj of template.objects) {
          const domainId = createdDomains.get(templateObj.domainName);
          const areaId = createdAreas.get(`${templateObj.domainName}:${templateObj.dataAreaName}`);
          
          if (!domainId) {
            console.log(`Domain ${templateObj.domainName} not found, skipping object ${templateObj.name}`);
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
            sourceSystemId: await getSystemId(templateObj.sourceSystem),
            targetSystemId: resolvedTargetSystemId,
            isNew: false,
            position: basePosition
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
              layer: "conceptual"
            } as Record<string, any>
          });

          // Create object in logical layer
          const logicalObject = await storage.createDataObject({
            name: templateObj.name,
            modelId: logicalModel.id,
            domainId: domainId,
            dataAreaId: areaId,
            sourceSystemId: await getSystemId(templateObj.sourceSystem),
            targetSystemId: resolvedTargetSystemId,
            isNew: false,
            position: basePosition
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
              layer: "logical"
            } as Record<string, any>
          });

          // Create object in physical layer
          const physicalObject = await storage.createDataObject({
            name: templateObj.name,
            modelId: physicalModel.id,
            domainId: domainId,
            dataAreaId: areaId,
            sourceSystemId: await getSystemId(templateObj.sourceSystem),
            targetSystemId: resolvedTargetSystemId,
            isNew: false,
            position: basePosition
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
              layer: "physical"
            } as Record<string, any>
          });

          // Create attributes for logical and physical layers (conceptual layer doesn't show attributes)
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
              orderIndex: templateAttr.orderIndex
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
              orderIndex: templateAttr.orderIndex
            });
          }

          // Create relationships in all layers if they exist in template
          // Note: The relationship creation should happen after all objects are created
        }
        
        console.log(`Successfully added ${template.objects.length} template objects to all layers`);
      }

      res.status(201).json({
        conceptual: conceptualModel,
        logical: logicalModel,
        physical: physicalModel,
        templatesAdded: template ? template.objects.length : 0,
        message: `Model created with all 3 layers${template ? ` and ${template.objects.length} template objects from ${selectedTargetSystem}` : ""}`
      });
    } catch (error: any) {
      console.error("Error creating model with layers:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          message: "Invalid model data", 
          details: error.errors,
          errors: error.errors 
        });
      } else {
        res.status(500).json({ 
          message: error.message || "Failed to create model with layers" 
        });
      }
    }
  });

  app.put("/api/models/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDataModelSchema.partial().parse(req.body);
      const model = await storage.updateDataModel(id, validatedData);
      res.json(model);
    } catch (error) {
      res.status(400).json({ message: "Failed to update model" });
    }
  });

  app.delete("/api/models/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDataModel(id);
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
      res.json(objects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch all objects" });
    }
  });

  app.get("/api/objects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const object = await storage.getDataObject(id);
      if (!object) {
        return res.status(404).json({ message: "Object not found" });
      }
      res.json(object);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch object" });
    }
  });

  app.post("/api/objects", async (req, res) => {
    try {
      console.log("Received object creation request:", req.body);
      
      // For now, work with the existing schema that requires modelId
      // Add a default modelId if not provided (using first available model)
      let objectData = { ...req.body };
      if (!objectData.modelId) {
        // Find the current user's first model or create a default
        const models = await storage.getDataModels();
        if (models.length > 0) {
          objectData.modelId = models[0].id;
        } else {
          return res.status(400).json({ 
            message: "No model available. Please create a model first." 
          });
        }
      }
      
      const validatedData = insertDataObjectSchema.parse(objectData);
      console.log("Validated data:", validatedData);
      const object = await storage.createDataObject(validatedData);
      
      // Auto-cascade: When creating object in conceptual layer, create in logical and physical layers
      const currentModel = await storage.getDataModel(validatedData.modelId);
      if (currentModel?.layer === "conceptual") {
        // Find all models in the same family
        const allModels = await storage.getDataModels();
        const logicalModel = allModels.find(m => m.parentModelId === currentModel.id && m.layer === "logical");
        const physicalModel = allModels.find(m => m.parentModelId === currentModel.id && m.layer === "physical");
        
        // Create object in logical layer
        if (logicalModel) {
          await storage.createDataObject({
            ...validatedData,
            modelId: logicalModel.id
          });
        }
        
        // Create object in physical layer
        if (physicalModel) {
          await storage.createDataObject({
            ...validatedData,
            modelId: physicalModel.id
          });
        }
      }
      
      res.status(201).json(object);
    } catch (error) {
      console.error("Error creating object:", error);
      if ((error as any).errors) {
        console.error("Validation errors:", (error as any).errors);
      }
      res.status(400).json({ 
        message: "Invalid object data",
        error: (error as any).message,
        details: (error as any).errors || error
      });
    }
  });

  app.put("/api/objects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDataObjectSchema.partial().parse(req.body);
      const object = await storage.updateDataObject(id, validatedData);
      res.json(object);
    } catch (error) {
      res.status(400).json({ message: "Failed to update object" });
    }
  });

  app.delete("/api/objects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Attempting to delete object ${id}`);
      
      // First, delete all data model objects associated with this object
      console.log(`Deleting data model objects for object ${id}`);
      await storage.deleteDataModelObjectsByObject(id);
      console.log(`Successfully deleted data model objects for object ${id}`);
      
      // Second, delete all attributes associated with this object
      console.log(`Deleting attributes for object ${id}`);
      await storage.deleteAttributesByObject(id);
      console.log(`Successfully deleted attributes for object ${id}`);
      
      // Finally, delete the object itself
      console.log(`Deleting object ${id}`);
      await storage.deleteDataObject(id);
      console.log(`Successfully deleted object ${id}`);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting object:", error);
      res.status(500).json({ message: "Failed to delete object" });
    }
  });

  // Attributes  
  app.get("/api/objects/:objectId/attributes", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      console.log('Fetching attributes for objectId:', objectId);
      
      // Simplified approach: Get all attributes where objectId matches
      // This bypasses the complex model structure temporarily
      const allAttributes = await storage.getAllAttributes();
      const objectAttributes = allAttributes.filter(attr => attr.objectId === objectId);
      
      console.log('Found attributes:', objectAttributes);
      res.json(objectAttributes);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      res.status(500).json({ message: "Failed to fetch attributes" });
    }
  });

  // Get all attributes
  app.get("/api/attributes", async (req, res) => {
    try {
      const attributes = await storage.getAllAttributes();
      res.json(attributes);
    } catch (error) {
      console.error("Error fetching all attributes:", error);
      res.status(500).json({ message: "Failed to fetch attributes" });
    }
  });

  // Create an attribute for a specific object
  app.post("/api/objects/:objectId/attributes", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      const attributeData = { ...req.body, objectId };
      const validatedData = insertAttributeSchema.parse(attributeData);
      console.log('Creating attribute with data:', validatedData);
      
      const attribute = await storage.createAttribute(validatedData);
      console.log('Successfully created attribute:', attribute.id);
      
      res.status(201).json(attribute);
    } catch (error) {
      console.error("Error creating attribute:", error);
      res.status(400).json({ message: "Invalid attribute data" });
    }
  });

  app.post("/api/attributes", async (req, res) => {
    try {
      const validatedData = insertAttributeSchema.parse(req.body);
      console.log('Creating attribute with data:', validatedData);
      
      // Create the attribute (this is working correctly)
      const attribute = await storage.createAttribute(validatedData);
      console.log('Successfully created attribute:', attribute.id);
      
      res.status(201).json(attribute);
    } catch (error) {
      console.error("Error creating attribute:", error);
      res.status(400).json({ message: "Invalid attribute data" });
    }
  });

  // Update an attribute with PATCH
  app.patch("/api/attributes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAttributeSchema.partial().parse(req.body);
      const attribute = await storage.updateAttribute(id, validatedData);
      res.json(attribute);
    } catch (error) {
      console.error("Error updating attribute:", error);
      res.status(400).json({ message: "Failed to update attribute" });
    }
  });

  // Get a specific attribute by ID
  app.get("/api/attributes/:id", async (req, res) => {
    try {
      const attributeId = parseInt(req.params.id);
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
      const validatedData = insertAttributeSchema.partial().parse(req.body);
      const attribute = await storage.updateAttribute(id, validatedData);
      
      // Auto-cascade: When updating attribute in logical layer, update in physical layer
      const parentObject = await storage.getDataObject(attribute.objectId);
      if (parentObject) {
        const currentModel = await storage.getDataModel(parentObject.modelId);
        if (currentModel?.layer === "logical") {
          // Find physical layer model
          const allModels = await storage.getDataModels();
          let physicalModel = null;
          
          // Multiple scenarios for finding physical model
          physicalModel = allModels.find(m => 
            m.parentModelId === currentModel.id && 
            m.layer === "physical"
          );
          
          if (!physicalModel && currentModel.parentModelId) {
            physicalModel = allModels.find(m => 
              m.parentModelId === currentModel.parentModelId && 
              m.layer === "physical"
            );
          }
          
          if (!physicalModel) {
            const baseName = currentModel.name.replace(/\s*(logical|conceptual)\s*/i, '').trim();
            physicalModel = allModels.find(m => 
              m.layer === "physical" && 
              m.name.toLowerCase().includes(baseName.toLowerCase())
            );
          }
          
          if (physicalModel) {
            // Find corresponding object in physical layer
            const physicalObjects = await storage.getDataObjectsByModel(physicalModel.id);
            const physicalObject = physicalObjects.find(obj => obj.name === parentObject.name);
            
            if (physicalObject) {
              // Find corresponding attribute in physical layer
              const physicalAttributes = await storage.getAttributesByObject(physicalObject.id);
              const physicalAttribute = physicalAttributes.find(attr => attr.name === attribute.name);
              
              if (physicalAttribute) {
                // Update physical attribute with converted data types
                const physicalUpdateData = {
                  ...validatedData,
                  // Convert logical type to physical type if logical type was updated
                  ...(validatedData.logicalType && {
                    physicalType: mapLogicalToPhysicalType(validatedData.logicalType)
                  }),
                  // Ensure length is set appropriately
                  ...(validatedData.logicalType && {
                    length: validatedData.length || getDefaultLength(validatedData.logicalType)
                  })
                };
                
                await storage.updateAttribute(physicalAttribute.id, physicalUpdateData);
              }
            }
          }
        }
      }
      
      res.json(attribute);
    } catch (error) {
      console.error("Error updating attribute:", error);
      res.status(400).json({ message: "Failed to update attribute" });
    }
  });

  app.delete("/api/attributes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAttribute(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete attribute" });
    }
  });

  // Auto-enhance attribute with layer-specific type mapping
  app.post("/api/attributes/:id/enhance", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { targetLayer } = req.body;
      
      const attribute = await storage.getAttribute(id);
      if (!attribute) {
        return res.status(404).json({ message: "Attribute not found" });
      }
      
      let updateData: any = {};
      
      if (targetLayer === 'logical' && attribute.conceptualType) {
        // Map conceptual to logical
        updateData.logicalType = mapConceptualToLogicalType(attribute.conceptualType);
        updateData.length = getDefaultLength(updateData.logicalType);
      } else if (targetLayer === 'physical' && attribute.logicalType) {
        // Map logical to physical
        updateData.physicalType = mapLogicalToPhysicalType(attribute.logicalType);
        updateData.length = getDefaultLength(attribute.logicalType);
      }
      
      if (Object.keys(updateData).length > 0) {
        const updatedAttribute = await storage.updateAttribute(id, updateData);
        res.json(updatedAttribute);
      } else {
        res.json(attribute);
      }
      
    } catch (error) {
      console.error("Error enhancing attribute:", error);
      res.status(500).json({ message: "Failed to enhance attribute" });
    }
  });

  // Bulk enhance attributes for an object
  app.post("/api/objects/:objectId/attributes/enhance", async (req, res) => {
    try {
      const objectId = parseInt(req.params.objectId);
      const { targetLayer } = req.body;
      
      const attributes = await storage.getAttributesByObject(objectId);
      const enhancedAttributes = [];
      
      for (const attribute of attributes) {
        let updateData: any = {};
        
        if (targetLayer === 'logical' && attribute.conceptualType) {
          // Map conceptual to logical
          updateData.logicalType = mapConceptualToLogicalType(attribute.conceptualType);
          updateData.length = getDefaultLength(updateData.logicalType);
        } else if (targetLayer === 'physical' && attribute.logicalType) {
          // Map logical to physical
          updateData.physicalType = mapLogicalToPhysicalType(attribute.logicalType);
          updateData.length = getDefaultLength(attribute.logicalType);
        }
        
        if (Object.keys(updateData).length > 0) {
          const updatedAttribute = await storage.updateAttribute(attribute.id, updateData);
          enhancedAttributes.push(updatedAttribute);
        } else {
          enhancedAttributes.push(attribute);
        }
      }
      
      res.json(enhancedAttributes);
      
    } catch (error) {
      console.error("Error bulk enhancing attributes:", error);
      res.status(500).json({ message: "Failed to bulk enhance attributes" });
    }
  });

  // Relationships
  app.get("/api/models/:modelId/relationships", async (req, res) => {
    try {
      const modelId = parseInt(req.params.modelId);
      const relationships = await storage.getRelationshipsByModel(modelId);
      res.json(relationships);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch relationships" });
    }
  });

  app.post("/api/relationships", async (req, res) => {
    try {
      const validatedData = insertRelationshipSchema.parse(req.body);
      const relationship = await storage.createRelationship(validatedData);
      res.status(201).json(relationship);
    } catch (error) {
      res.status(400).json({ message: "Invalid relationship data" });
    }
  });

  app.put("/api/relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertRelationshipSchema.partial().parse(req.body);
      const relationship = await storage.updateRelationship(id, validatedData);
      res.json(relationship);
    } catch (error) {
      res.status(400).json({ message: "Failed to update relationship" });
    }
  });

  app.delete("/api/relationships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRelationship(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete relationship" });
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

      const roleParam = typeof req.query.role === "string" ? req.query.role.toLowerCase() : "all";
      const role: SystemObjectDirection | "all" = roleParam === "source" || roleParam === "target" ? (roleParam as SystemObjectDirection) : "all";

      let objects: DataObject[] = [];
      if (role === "source") {
        objects = await storage.getDataObjectsBySourceSystem(systemId);
      } else if (role === "target") {
        objects = await storage.getDataObjectsByTargetSystem(systemId);
      } else {
        const [sourceObjects, targetObjects] = await Promise.all([
          storage.getDataObjectsBySourceSystem(systemId),
          storage.getDataObjectsByTargetSystem(systemId),
        ]);
        const dedup = new Map<number, DataObject>();
        sourceObjects.forEach((object) => dedup.set(object.id, object));
        targetObjects.forEach((object) => dedup.set(object.id, object));
        objects = Array.from(dedup.values());
      }

      const [models, attributes] = await Promise.all([
        storage.getDataModels(),
        storage.getAllAttributes(),
      ]);

      const attributeCounts = new Map<number, number>();
      attributes.forEach((attribute) => {
        const count = attributeCounts.get(attribute.objectId) ?? 0;
        attributeCounts.set(attribute.objectId, count + 1);
      });

      const modelMap = new Map<number, DataModel>();
      models.forEach((model) => modelMap.set(model.id, model));

      const enriched = objects.map((object) => {
        const modelInfo = modelMap.get(object.modelId);
        return {
          ...object,
          attributeCount: attributeCounts.get(object.id) ?? 0,
          model: modelInfo
            ? {
                id: modelInfo.id,
                name: modelInfo.name,
                layer: modelInfo.layer,
              }
            : null,
          systemAssociation:
            object.sourceSystemId === systemId
              ? "source"
              : object.targetSystemId === systemId
                ? "target"
                : null,
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

      const association: SystemObjectDirection | null = object.sourceSystemId === systemId
        ? "source"
        : object.targetSystemId === systemId
          ? "target"
          : null;

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

      if (object.sourceSystemId !== systemId && object.targetSystemId !== systemId) {
        return res.status(400).json({ message: "Object is not associated with this system" });
      }

      await storage.deleteDataModelObjectsByObject(objectId);
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

      const system = await storage.getSystem(systemId);
      if (!system) {
        return res.status(404).json({ message: "System not found" });
      }

      const parsed = systemSyncRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid sync request", details: parsed.error.flatten() });
      }

  const { modelId, direction = "source", includeAttributes = true, domainId, dataAreaId, metadataOnly } = parsed.data;

      if (direction === "source" && system.canBeSource === false) {
        return res.status(400).json({ message: "System cannot act as a source" });
      }

      if (direction === "target" && system.canBeTarget === false) {
        return res.status(400).json({ message: "System cannot act as a target" });
      }

      const model = await storage.getDataModel(modelId);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
      }

      let effectiveDomainId = extractPreferredDomainId(system, domainId ?? null);
      let effectiveDataAreaId = dataAreaId ?? null;

      if (effectiveDataAreaId === null) {
        const preferredAreas = extractPreferredDataAreaIds(system);
        if (preferredAreas.length > 0) {
          effectiveDataAreaId = preferredAreas[0];
        }
      }

      if (effectiveDataAreaId !== null) {
        const area = await storage.getDataArea(effectiveDataAreaId);
        if (!area) {
          return res.status(400).json({ message: "Provided data area does not exist" });
        }
        if (effectiveDomainId !== null && area.domainId !== effectiveDomainId) {
          return res.status(400).json({ message: "Data area does not belong to the specified domain" });
        }
        if (effectiveDomainId === null) {
          effectiveDomainId = area.domainId;
        }
      }

      if (effectiveDomainId !== null) {
        const domain = await storage.getDataDomain(effectiveDomainId);
        if (!domain) {
          return res.status(400).json({ message: "Provided domain does not exist" });
        }
      }

      const connectionOverrides =
        req.body?.connection && typeof req.body.connection === "object"
          ? (req.body.connection as { configuration?: Record<string, unknown>; connectionString?: string | null })
          : undefined;

      const metadata = await retrieveSystemMetadata(system, {
        configurationOverride: connectionOverrides?.configuration,
        connectionStringOverride: connectionOverrides?.connectionString ?? null,
      });

      if (metadataOnly) {
        return res.json({ metadata });
      }

      const existingObjects = await storage.getDataObjectsByModel(modelId);
      const relevantExisting = new Map<string, DataObject>();
      existingObjects.forEach((object) => {
        const association: SystemObjectDirection | null = object.sourceSystemId === systemId
          ? "source"
          : object.targetSystemId === systemId
            ? "target"
            : null;
        if (association === direction) {
          relevantExisting.set(object.name.toLowerCase(), object);
        }
      });

      const created: DataObject[] = [];
      const updated: DataObject[] = [];
      const attributeSummary: Record<string, number> = {};

      for (const table of metadata) {
        const tableKey = table.name.toLowerCase();
  const existingObject = relevantExisting.get(tableKey);
        const metadataPayload: Record<string, any> = {
          ...(existingObject?.metadata ?? {}),
          syncedFromSystemId: systemId,
          systemDirection: direction,
          rawMetadata: table,
          syncedAt: new Date().toISOString(),
        };

        if (existingObject) {
          const updatedObject = await storage.updateDataObject(existingObject.id, {
            metadata: metadataPayload,
            domainId: effectiveDomainId ?? existingObject.domainId ?? null,
            dataAreaId: effectiveDataAreaId ?? existingObject.dataAreaId ?? null,
            sourceSystemId: direction === "source" ? systemId : existingObject.sourceSystemId,
            targetSystemId: direction === "target" ? systemId : existingObject.targetSystemId,
            isNew: false,
          });
          updated.push(updatedObject);

          if (includeAttributes && Array.isArray(table.columns)) {
            await storage.deleteAttributesByObject(updatedObject.id);
            let attributeCount = 0;
            for (let index = 0; index < table.columns.length; index++) {
              const column = table.columns[index];
              await storage.createAttribute({
                name: column.name,
                objectId: updatedObject.id,
                conceptualType: column.type,
                logicalType: column.type,
                physicalType: column.type,
                nullable: column.nullable ?? true,
                isPrimaryKey: column.isPrimaryKey ?? false,
                dataType: column.type,
                orderIndex: index,
              });
              attributeCount += 1;
            }
            attributeSummary[updatedObject.id.toString()] = attributeCount;
          }
        } else {
          const createdObject = await storage.createDataObject({
            name: table.name,
            modelId,
            domainId: effectiveDomainId ?? null,
            dataAreaId: effectiveDataAreaId ?? null,
            sourceSystemId: direction === "source" ? systemId : null,
            targetSystemId: direction === "target" ? systemId : null,
            metadata: metadataPayload,
            objectType: Array.isArray(table.columns) && table.columns.length ? "table" : "entity",
            isNew: true,
          });
          created.push(createdObject);

          if (includeAttributes && Array.isArray(table.columns)) {
            let attributeCount = 0;
            for (let index = 0; index < table.columns.length; index++) {
              const column = table.columns[index];
              await storage.createAttribute({
                name: column.name,
                objectId: createdObject.id,
                conceptualType: column.type,
                logicalType: column.type,
                physicalType: column.type,
                nullable: column.nullable ?? true,
                isPrimaryKey: column.isPrimaryKey ?? false,
                dataType: column.type,
                orderIndex: index,
              });
              attributeCount += 1;
            }
            attributeSummary[createdObject.id.toString()] = attributeCount;
          }
        }
      }

      res.json({
        metadataCount: metadata.length,
        createdCount: created.length,
        updatedCount: updated.length,
        created,
        updated,
        attributes: attributeSummary,
      });
    } catch (error) {
      console.error("Failed to sync system objects:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid sync payload", details: error.errors });
      } else {
        res.status(500).json({ message: "Failed to sync system objects" });
      }
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
      
      const relationships = await storage.getRelationshipsByModel(modelId);
      
      // Get attributes for each object and include domain/area information
      const nodes = await Promise.all(visibleModelObjects.map(async modelObj => {
        const obj = await storage.getDataObject(modelObj.objectId);
        if (!obj) return null;
        
        const allAttributes = await storage.getAttributesByObject(obj.id);
        console.log(`Fetching attributes for objectId: ${obj.id}`, allAttributes);
        
        // Include ALL attributes for now - the layer filtering should be done in the UI, not the API
        // The attributes exist and should be displayed regardless of layer-specific type fields
        let attributes = allAttributes;
        
        // Get domain and area names
        const domains = await storage.getDataDomains();
        const areas = await storage.getDataAreasByDomain(obj.domainId || 0);
        const domain = domains.find(d => d.id === obj.domainId);
        const area = areas.find(a => a.id === obj.dataAreaId);
        
        // Get layer-specific position from model object config
        let position = { x: 0, y: 0 };
        if (modelObj.layerSpecificConfig && typeof modelObj.layerSpecificConfig === 'object') {
          const config = modelObj.layerSpecificConfig as any;

          if (config.layers && typeof config.layers === 'object') {
            const layerKey = layer || config.layer;
            const layerConfig = (layerKey && config.layers[layerKey]) || (config.layer && config.layers[config.layer]);
            if (layerConfig?.position) {
              position = layerConfig.position;
            }
          }

          if (position.x === 0 && position.y === 0 && config.position) {
            position = config.position;
          }
        }

        // Fallback to model object level position
        if ((position.x === 0 && position.y === 0) && modelObj.position) {
          const modelPosition = modelObj.position as any;
          if (typeof modelPosition === 'string') {
            try {
              position = JSON.parse(modelPosition);
            } catch (e) {
              console.warn("Failed to parse model object position:", modelPosition);
            }
          } else {
            position = modelPosition;
          }
        }
        
        // Fallback to global data object position if still not set
        if ((position.x === 0 && position.y === 0) && obj.position) {
          if (typeof obj.position === 'string') {
            try {
              position = JSON.parse(obj.position);
            } catch (e) {
              console.warn("Failed to parse position:", obj.position);
            }
          } else {
            position = obj.position;
          }
        }

        return {
          id: obj.id.toString(),
          type: 'dataObject',
          position,
          data: {
            modelObjectId: modelObj.id,
            name: obj.name,
            objectId: obj.id,
            domain: domain?.name || 'Uncategorized',
            dataArea: area?.name || 'General',
            attributes: attributes,
            sourceSystem: obj.sourceSystemId,
            targetSystem: obj.targetSystemId,
            isNew: obj.isNew
          }
        };
      }));
      
      // Filter out null nodes
      const validNodes = nodes.filter(node => node !== null);
      
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
        const sourceModelObject = await storage.getDataModelObject(rel.sourceModelObjectId);
        const targetModelObject = await storage.getDataModelObject(rel.targetModelObjectId);
        
        if (!sourceModelObject || !targetModelObject) {
          console.warn(`Missing model objects for relationship ${rel.id}`);
          return null;
        }

        return {
          id: rel.id.toString(),
          source: sourceModelObject.objectId.toString(),
          target: targetModelObject.objectId.toString(),
          type: 'smoothstep',
          label: rel.type,
          data: {
            relationshipId: rel.id,
            relationshipType: rel.type,
            sourceAttributeId: rel.sourceAttributeId,
            targetAttributeId: rel.targetAttributeId
          }
        };
      }));

      // Filter out null edges
      const validEdges = edges.filter(edge => edge !== null);
      
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

        return storage.updateDataModelObject(modelObject.id, { 
          layerSpecificConfig: updatedConfig,
          position
        });
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

  // AI Suggestions
  app.post("/api/ai/modeling-agent", async (req, res) => {
    try {
      const payload = modelingAgentRequestSchema.parse(req.body);
      const result = await modelingAgentService.run(payload);
      res.json(result);
    } catch (error: any) {
      console.error("AI modeling agent error:", error);
      if (error.name === "ZodError") {
        res.status(400).json({
          message: "Invalid modeling agent request",
          details: error.errors,
          errors: error.errors,
        });
      } else {
        res.status(500).json({
          message: error?.message ?? "Failed to execute modeling agent",
        });
      }
    }
  });

  app.post("/api/ai/suggest-domain", async (req, res) => {
    try {
      const { objectName, attributes } = req.body;
      const suggestions = await aiEngine.suggestDomainClassification(objectName, attributes);
      res.json(suggestions);
    } catch (error) {
      console.error("Domain suggestions error:", error);
      res.status(500).json({ message: "Failed to generate domain suggestions" });
    }
  });

  app.post("/api/ai/suggest-relationships", async (req, res) => {
    try {
      const { modelId, layer } = req.body;
      console.log("Generating relationship suggestions for model:", modelId, "layer:", layer);
      
      const objects = await storage.getDataObjectsByModel(modelId);
      console.log("Found objects:", objects.length);
      
      const allAttributes: any[] = [];
      for (const obj of objects) {
        const attrs = await storage.getAttributesByObject(obj.id);
        allAttributes.push(...attrs);
      }
      console.log("Found attributes:", allAttributes.length);
      
      let suggestions: any[] = [];
      
      if (layer === "conceptual") {
        // For conceptual layer, suggest object-to-object relationships
        suggestions = await aiEngine.suggestRelationships(objects, allAttributes);
      } else if (layer === "logical" || layer === "physical") {
        // For logical/physical layers, base suggestions on existing conceptual relationships
        const existingRelationships = await storage.getRelationshipsByModel(modelId);
        const conceptualRelationships = existingRelationships.filter(rel => !rel.sourceAttributeId && !rel.targetAttributeId);
        
        if (conceptualRelationships.length > 0) {
          // Convert conceptual relationships to attribute-level suggestions
          suggestions = await aiEngine.suggestAttributeRelationshipsFromConceptual(conceptualRelationships, objects, allAttributes);
        } else {
          // If no conceptual relationships exist, suggest direct attribute relationships
          suggestions = await aiEngine.suggestRelationships(objects, allAttributes);
        }
      }
      
      console.log("Generated suggestions:", suggestions.length);
      res.json(suggestions);
    } catch (error: any) {
      console.error("AI relationship suggestions error:", error);
      res.status(500).json({ message: "Failed to generate relationship suggestions", error: error?.message });
    }
  });

  app.post("/api/ai/suggest-types", async (req, res) => {
    try {
      const { conceptualType, attributeName, context } = req.body;
      const suggestions = await aiEngine.suggestTypeMappings(conceptualType, attributeName, context);
      res.json(suggestions);
    } catch (error) {
      console.error("Type mapping suggestions error:", error);
      res.status(500).json({ message: "Failed to generate type suggestions" });
    }
  });

  app.post("/api/ai/suggest-normalization", async (req, res) => {
    try {
      const { modelId } = req.body;
      const objects = await storage.getDataObjectsByModel(modelId);
      
      const allAttributes: any[] = [];
      for (const obj of objects) {
        const attrs = await storage.getAttributesByObject(obj.id);
        allAttributes.push(...attrs);
      }
      
      const suggestions = aiEngine.suggestNormalizationImprovements(objects, allAttributes);
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate normalization suggestions" });
    }
  });

  app.get("/api/system-metrics", async (_req, res) => {
    try {
      const [configs, models, systemsList, objects, attrs, rels] = await Promise.all([
        storage.getConfigurations(),
        storage.getDataModels(),
        storage.getSystems(),
        storage.getDataObjects(),
        storage.getAttributes(),
        storage.getRelationships(),
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
      console.log('Export request received:', { modelId: req.body.modelId, options: req.body.options });
      
      const { modelId, options } = req.body;
      
      if (!modelId) {
        return res.status(400).json({ message: "Model ID is required" });
      }
      
      const model = await storage.getDataModel(modelId);
      if (!model) {
        console.log('Model not found:', modelId);
        return res.status(404).json({ message: "Model not found" });
      }
      
      console.log('Model found:', model.name);
      
      const objects = await storage.getDataObjectsByModel(modelId);
      const relationships = await storage.getRelationshipsByModel(modelId);
      
      console.log('Data fetched:', { objects: objects.length, relationships: relationships.length });
      
      const allAttributes: any[] = [];
      for (const obj of objects) {
        const attrs = await storage.getAttributesByObject(obj.id);
        allAttributes.push(...attrs);
      }
      
      console.log('Attributes fetched:', allAttributes.length);
      
      const exportedData = await exportService.exportModel(
        model,
        objects,
        allAttributes,
        relationships,
        options
      );
      
      console.log('Export completed successfully');
      res.json({ data: exportedData });
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ 
        message: "Export failed", 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });


  // SVG Export
  app.post("/api/export/svg", async (req, res) => {
    try {
      const { modelId, options } = req.body;
      
      const model = await storage.getDataModel(modelId);
      if (!model) {
        return res.status(404).json({ message: "Model not found" });
      }
      
      const objects = await storage.getDataObjectsByModel(modelId);
      const relationships = await storage.getRelationshipsByModel(modelId);
      
      const allAttributes: any[] = [];
      for (const obj of objects) {
        const attrs = await storage.getAttributesByObject(obj.id);
        allAttributes.push(...attrs);
      }
      
      // Generate SVG
      const width = options.width || 800;
      const height = options.height || 600;
      const margin = 50;
      const nodeWidth = 200;
      const nodeHeight = 100;
      const nodeSpacing = 250;
      
      // Calculate layout
      const cols = Math.ceil(Math.sqrt(objects.length));
      const rows = Math.ceil(objects.length / cols);
      
      let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
      
      // Add background
      svg += `<rect width="100%" height="100%" fill="${options.theme === 'dark' ? '#1a1a1a' : '#ffffff'}"/>`;
      
      // Add title
      if (options.includeTitle) {
        svg += `<text x="${width / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${model.name}</text>`;
      }
      
      // Add metadata
      if (options.includeMetadata) {
        svg += `<text x="20" y="${height - 20}" font-family="Arial, sans-serif" font-size="12" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">Layer: ${options.layer || 'all'} | Generated: ${new Date().toLocaleString()}</text>`;
      }
      
      // Add objects
      objects.forEach((obj, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = margin + col * nodeSpacing;
        const y = margin + 60 + row * (nodeHeight + 50);
        
        // Create node rectangle
        svg += `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" fill="${options.theme === 'dark' ? '#2d2d2d' : '#f8f9fa'}" stroke="${options.theme === 'dark' ? '#4a5568' : '#2d3748'}" stroke-width="2" rx="5"/>`;
        
        // Add object name
        svg += `<text x="${x + nodeWidth / 2}" y="${y + 25}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${obj.name}</text>`;
        
        // Add attributes
        const objAttributes = allAttributes.filter(attr => attr.objectId === obj.id);
        objAttributes.slice(0, 3).forEach((attr, attrIndex) => {
          let attrName = attr.name;
          if (options.includePrimaryKeys && attr.isPrimaryKey) {
            attrName += ' (PK)';
          }
          if (options.includeForeignKeys && attr.isForeignKey) {
            attrName += ' (FK)';
          }
          
          svg += `<text x="${x + 10}" y="${y + 45 + attrIndex * 15}" font-family="Arial, sans-serif" font-size="10" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${attrName}</text>`;
        });
        
        if (objAttributes.length > 3) {
          svg += `<text x="${x + 10}" y="${y + 45 + 3 * 15}" font-family="Arial, sans-serif" font-size="10" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">... and ${objAttributes.length - 3} more</text>`;
        }
      });
      
      // Add relationships
      relationships.forEach(rel => {
        const sourceObj = objects.find(o => o.id === rel.sourceModelObjectId);
        const targetObj = objects.find(o => o.id === rel.targetModelObjectId);
        
        if (sourceObj && targetObj) {
          const sourceIndex = objects.indexOf(sourceObj);
          const targetIndex = objects.indexOf(targetObj);
          
          const sourceRow = Math.floor(sourceIndex / cols);
          const sourceCol = sourceIndex % cols;
          const targetRow = Math.floor(targetIndex / cols);
          const targetCol = targetIndex % cols;
          
          const sourceX = margin + sourceCol * nodeSpacing + nodeWidth / 2;
          const sourceY = margin + 60 + sourceRow * (nodeHeight + 50) + nodeHeight / 2;
          const targetX = margin + targetCol * nodeSpacing + nodeWidth / 2;
          const targetY = margin + 60 + targetRow * (nodeHeight + 50) + nodeHeight / 2;
          
          // Create line
          svg += `<line x1="${sourceX}" y1="${sourceY}" x2="${targetX}" y2="${targetY}" stroke="${options.theme === 'dark' ? '#4a5568' : '#2d3748'}" stroke-width="2" marker-end="url(#arrowhead)"/>`;
          
          // Add relationship type
          const midX = (sourceX + targetX) / 2;
          const midY = (sourceY + targetY) / 2;
          svg += `<text x="${midX}" y="${midY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="${options.theme === 'dark' ? '#ffffff' : '#2d3748'}">${rel.type}</text>`;
        }
      });
      
      // Add arrow marker
      svg += `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${options.theme === 'dark' ? '#4a5568' : '#2d3748'}"/></marker></defs>`;
      
      svg += '</svg>';
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="${model.name}_${new Date().toISOString().split('T')[0]}.svg"`);
      res.send(svg);
    } catch (error) {
      console.error('SVG export error:', error);
      res.status(500).json({ message: "SVG export failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
