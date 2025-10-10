import { dataConnectors, type ADLSConnectionConfig, type DatabaseConnectionConfig, type TableMetadata } from "../services/dataConnectors";
import type { System } from "@shared/schema";

export function coerceNumericId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

export function extractPreferredDomainId(system: System, override?: number | null): number | null {
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

export function extractPreferredDataAreaIds(system: System, override?: number[] | null): number[] {
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

export function mapToDatabaseConnectorType(type?: string): DatabaseConnectionConfig["type"] {
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

export function parseConnectionString(connectionString?: string | null): DatabaseConnectionConfig | null {
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

export function buildDatabaseConfig(
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

export function buildAdlsConfig(
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

export async function testSystemConnectivity(
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

export async function retrieveSystemMetadata(
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
