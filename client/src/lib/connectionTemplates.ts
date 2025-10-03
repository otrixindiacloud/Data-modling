export type ConnectionFieldType = "text" | "number" | "password" | "textarea";

export interface ConnectionFieldDefinition {
	key: string;
	label: string;
	type?: ConnectionFieldType;
	placeholder?: string;
	description?: string;
	required?: boolean;
}

export interface ConnectionTemplate {
	key: string;
	label: string;
	defaults: Record<string, unknown>;
	fields: ConnectionFieldDefinition[];
}

export const CONNECTION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "sql", label: "Microsoft SQL Server" },
	{ value: "postgres", label: "PostgreSQL" },
	{ value: "mysql", label: "MySQL" },
	{ value: "oracle", label: "Oracle Database" },
	{ value: "sap_hana", label: "SAP HANA" },
	{ value: "nosql", label: "NoSQL Database" },
	{ value: "file", label: "File System" },
	{ value: "api", label: "REST API" },
	{ value: "adls", label: "Azure Data Lake Storage" },
	{ value: "s3", label: "Amazon S3" },
	{ value: "kafka", label: "Apache Kafka" },
	{ value: "sftp", label: "SFTP Server" },
];

type TemplateMap = Record<string, ConnectionTemplate>;

const DATABASE_FIELD_BASE: ConnectionFieldDefinition[] = [
	{
		key: "host",
		label: "Host",
		placeholder: "db.company.local",
		required: true,
	},
	{
		key: "port",
		label: "Port",
		type: "number",
		placeholder: "5432",
		required: true,
	},
	{
		key: "database",
		label: "Database",
		placeholder: "analytics",
		required: true,
	},
	{
		key: "username",
		label: "Username",
		placeholder: "service_account",
		required: true,
	},
	{
		key: "password",
		label: "Password",
		type: "password",
		placeholder: "••••••••",
		required: true,
	},
];

const CONNECTION_TEMPLATE_MAP: TemplateMap = {
	sql: {
		key: "sql",
		label: "Microsoft SQL Server",
		defaults: {
			type: "sql",
			host: "",
			port: 1433,
			database: "",
			username: "",
			password: "",
			encrypt: true,
		},
		fields: [
			...DATABASE_FIELD_BASE.map((field, index) =>
				index === 1 ? { ...field, placeholder: "1433" } : field
			),
			{
				key: "encrypt",
				label: "Encrypt Connection",
				placeholder: "true",
			},
		],
	},
	postgres: {
		key: "postgres",
		label: "PostgreSQL",
		defaults: {
			type: "postgres",
			host: "",
			port: 5432,
			database: "",
			username: "",
			password: "",
			sslMode: "prefer",
		},
		fields: [
			...DATABASE_FIELD_BASE.map((field, index) =>
				index === 1 ? { ...field, placeholder: "5432" } : field
			),
			{
				key: "sslMode",
				label: "SSL Mode",
				placeholder: "disable | allow | prefer | require",
			},
		],
	},
	mysql: {
		key: "mysql",
		label: "MySQL",
		defaults: {
			type: "mysql",
			host: "",
			port: 3306,
			database: "",
			username: "",
			password: "",
		},
		fields: DATABASE_FIELD_BASE.map((field, index) =>
			index === 1 ? { ...field, placeholder: "3306" } : field
		),
	},
	oracle: {
		key: "oracle",
		label: "Oracle Database",
		defaults: {
			type: "oracle",
			host: "",
			port: 1521,
			serviceName: "",
			username: "",
			password: "",
		},
		fields: [
			{
				key: "host",
				label: "Host",
				placeholder: "oracle.company.local",
				required: true,
			},
			{
				key: "port",
				label: "Port",
				type: "number",
				placeholder: "1521",
				required: true,
			},
			{
				key: "serviceName",
				label: "Service Name / SID",
				placeholder: "ORCLCDB",
				required: true,
			},
			{
				key: "username",
				label: "Username",
				placeholder: "integration_user",
				required: true,
			},
			{
				key: "password",
				label: "Password",
				type: "password",
				placeholder: "••••••••",
				required: true,
			},
		],
	},
	sap_hana: {
		key: "sap_hana",
		label: "SAP HANA",
		defaults: {
			type: "sap_hana",
			host: "",
			port: 30015,
			database: "",
			username: "",
			password: "",
		},
		fields: DATABASE_FIELD_BASE.map((field, index) =>
			index === 1 ? { ...field, placeholder: "30015" } : field
		),
	},
	nosql: {
		key: "nosql",
		label: "NoSQL Database",
		defaults: {
			type: "nosql",
			connectionUri: "",
			username: "",
			password: "",
			database: "",
		},
		fields: [
			{
				key: "connectionUri",
				label: "Connection URI",
				placeholder: "mongodb+srv://cluster.company.com",
				required: true,
			},
			{
				key: "database",
				label: "Database / Keyspace",
				placeholder: "analytics",
			},
			{
				key: "username",
				label: "Username",
				placeholder: "service_account",
			},
			{
				key: "password",
				label: "Password",
				type: "password",
				placeholder: "••••••••",
			},
		],
	},
	file: {
		key: "file",
		label: "File System",
		defaults: {
			type: "file",
			rootPath: "",
			filePattern: "*.csv",
			delimiter: ",",
		},
		fields: [
			{
				key: "rootPath",
				label: "Root Path",
				placeholder: "/mnt/shared/data",
				required: true,
			},
			{
				key: "filePattern",
				label: "File Pattern",
				placeholder: "*.csv",
			},
			{
				key: "delimiter",
				label: "Delimiter",
				placeholder: ",",
			},
		],
	},
	api: {
		key: "api",
		label: "REST API",
		defaults: {
			type: "api",
			baseUrl: "",
			authType: "apiKey",
			apiKey: "",
		},
		fields: [
			{
				key: "baseUrl",
				label: "Base URL",
				placeholder: "https://api.company.com/v1",
				required: true,
			},
			{
				key: "authType",
				label: "Auth Type",
				placeholder: "apiKey | oauth | none",
			},
			{
				key: "apiKey",
				label: "API Key / Token",
				placeholder: "sk-...",
			},
		],
	},
	adls: {
		key: "adls",
		label: "Azure Data Lake Storage",
		defaults: {
			type: "adls",
			storageAccount: "",
			containerName: "",
			path: "",
			sasToken: "",
		},
		fields: [
			{
				key: "storageAccount",
				label: "Storage Account",
				placeholder: "datalakeaccount",
				required: true,
			},
			{
				key: "containerName",
				label: "Container Name",
				placeholder: "datasets",
				required: true,
			},
			{
				key: "path",
				label: "Path / Directory",
				placeholder: "/",
			},
			{
				key: "sasToken",
				label: "SAS Token",
				placeholder: "?sv=...",
			},
		],
	},
	s3: {
		key: "s3",
		label: "Amazon S3",
		defaults: {
			type: "s3",
			bucketName: "",
			region: "",
			accessKeyId: "",
			secretAccessKey: "",
			prefix: "",
		},
		fields: [
			{
				key: "bucketName",
				label: "Bucket Name",
				placeholder: "company-data",
				required: true,
			},
			{
				key: "region",
				label: "Region",
				placeholder: "us-east-1",
			},
			{
				key: "accessKeyId",
				label: "Access Key ID",
				placeholder: "AKIAXXXXX",
			},
			{
				key: "secretAccessKey",
				label: "Secret Access Key",
				type: "password",
				placeholder: "••••••••",
			},
			{
				key: "prefix",
				label: "Object Prefix",
				placeholder: "exports/",
			},
		],
	},
	kafka: {
		key: "kafka",
		label: "Apache Kafka",
		defaults: {
			type: "kafka",
			brokers: "",
			topic: "",
			consumerGroup: "",
			saslMechanism: "",
		},
		fields: [
			{
				key: "brokers",
				label: "Bootstrap Servers",
				placeholder: "broker1:9092,broker2:9092",
				required: true,
			},
			{
				key: "topic",
				label: "Topic",
				placeholder: "events",
				required: true,
			},
			{
				key: "consumerGroup",
				label: "Consumer Group",
				placeholder: "modeler-sync",
			},
			{
				key: "saslMechanism",
				label: "SASL Mechanism",
				placeholder: "PLAIN | SCRAM-SHA-256",
			},
		],
	},
	sftp: {
		key: "sftp",
		label: "SFTP Server",
		defaults: {
			type: "sftp",
			host: "",
			port: 22,
			username: "",
			password: "",
			rootPath: "",
		},
		fields: [
			{
				key: "host",
				label: "Host",
				placeholder: "sftp.company.com",
				required: true,
			},
			{
				key: "port",
				label: "Port",
				type: "number",
				placeholder: "22",
			},
			{
				key: "username",
				label: "Username",
				placeholder: "integration_user",
			},
			{
				key: "password",
				label: "Password",
				type: "password",
				placeholder: "••••••••",
			},
			{
				key: "rootPath",
				label: "Root Path",
				placeholder: "/uploads",
			},
		],
	},
};

const TYPE_SYNONYMS: Record<string, keyof typeof CONNECTION_TEMPLATE_MAP> = {
	mssql: "sql",
	sqlserver: "sql",
	"sql_server": "sql",
	"ms-sql": "sql",
	hana: "sap_hana",
	sap: "sap_hana",
};

function normalizeType(type?: string): keyof typeof CONNECTION_TEMPLATE_MAP {
	if (!type) {
		return "sql";
	}

	const normalized = type.toLowerCase();
	if (normalized in CONNECTION_TEMPLATE_MAP) {
		return normalized as keyof typeof CONNECTION_TEMPLATE_MAP;
	}

	if (normalized in TYPE_SYNONYMS) {
		return TYPE_SYNONYMS[normalized];
	}

	if (normalized.includes("postgres")) {
		return "postgres";
	}
	if (normalized.includes("oracle")) {
		return "oracle";
	}
	if (normalized.includes("hana")) {
		return "sap_hana";
	}
	if (normalized.includes("mysql") || normalized.includes("maria")) {
		return "mysql";
	}

	return "sql";
}

export function getConnectionTemplate(type: string): ConnectionTemplate {
	const key = normalizeType(type);
	return CONNECTION_TEMPLATE_MAP[key] ?? CONNECTION_TEMPLATE_MAP.sql;
}

export function getConnectionFields(type: string): ConnectionFieldDefinition[] {
	return getConnectionTemplate(type).fields;
}

export function mergeConnectionDefaults(
	type: string,
	existing?: Record<string, any>,
): Record<string, any> {
	const template = getConnectionTemplate(type);
	const merged = {
		...template.defaults,
		...(existing ?? {}),
	} as Record<string, any>;

		merged.type = type || (template.defaults.type as string | undefined) || template.key;
	return merged;
}

