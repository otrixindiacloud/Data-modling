export interface DatabaseConnectionConfig {
  type: "sap_hana" | "oracle" | "sql_server" | "postgres" | "mysql" | "generic_sql";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  schema?: string;
  sslMode?: string;
}

export interface ADLSConnectionConfig {
  type: "adls_gen2";
  storageAccount: string;
  containerName: string;
  path: string;
  sasToken?: string;
  accessKey?: string;
}

export interface ForeignKeyMetadata {
  constraintName: string;
  columns: string[];
  referencedTable: string;
  referencedSchema?: string;
  referencedColumns: string[];
  updateRule?: string;
  deleteRule?: string;
  relationshipType?: "1:1" | "1:N" | "N:1" | "N:M" | "M:N";
}

export interface TableMetadata {
  name: string;
  schema?: string;
  originalName?: string;
  columns: ColumnMetadata[];
  rowCount?: number;
  foreignKeys?: ForeignKeyMetadata[];
}

export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  length?: number;
}

export class DataConnectors {
  // Test database connection
  async testDatabaseConnection(config: DatabaseConnectionConfig): Promise<boolean> {
    try {
      // In a real implementation, this would use appropriate database drivers
      // For now, we'll simulate connection testing
      if (!config.host || !config.username) {
        return false;
      }
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  // Extract metadata from database
  async extractDatabaseMetadata(config: DatabaseConnectionConfig): Promise<TableMetadata[]> {
    // This implementation uses node-postgres for Postgres, mysql2 for MySQL, and mssql for SQL Server.
    // For Oracle and SAP HANA, you would need to install oracledb and @sap/hana-client respectively.
    // Only Postgres and MySQL are implemented here for demonstration.

    if (config.type === "postgres") {
      // PostgreSQL
      const { Client } = await import("pg");
      const sslMode = config.sslMode?.toLowerCase();
      const shouldUseSsl = sslMode && sslMode !== "disable";
      const client = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
      });

      const quoteIdentifier = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

      try {
        await client.connect();

        const tablesQuery = config.schema
        ? {
            text: `SELECT table_schema, table_name
                   FROM information_schema.tables
                   WHERE table_type = 'BASE TABLE' AND table_schema = $1
                   ORDER BY table_name`,
            values: [config.schema],
          }
        : {
            text: `SELECT table_schema, table_name
                   FROM information_schema.tables
                   WHERE table_type = 'BASE TABLE'
                     AND table_schema NOT IN ('pg_catalog', 'information_schema')
                   ORDER BY table_schema, table_name`,
            values: [] as unknown[],
          };

        const tablesRes = await client.query(tablesQuery.text, tablesQuery.values);

        const tables: TableMetadata[] = [];
        for (const row of tablesRes.rows) {
        const schemaName = row.table_schema as string;
        const tableName = row.table_name as string;

        const columnsRes = await client.query(
          `SELECT column_name, data_type, is_nullable, character_maximum_length
           FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2
           ORDER BY ordinal_position`,
          [schemaName, tableName]
        );

        const pkRes = await client.query(
          `SELECT a.attname as column_name
           FROM pg_index i
           JOIN pg_class c ON c.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
           WHERE i.indisprimary AND n.nspname = $1 AND c.relname = $2`,
          [schemaName, tableName]
        );

        const pkCols = pkRes.rows.map((r: any) => r.column_name);

        let rowCount: number | undefined;
        const qualifiedName = `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
        try {
          const countRes = await client.query(`SELECT COUNT(*) FROM ${qualifiedName}`);
          const rawCount = countRes.rows?.[0]?.count as string | undefined;
          rowCount = rawCount ? Number.parseInt(rawCount, 10) : undefined;
        } catch (error) {
          console.warn(`Failed to count rows for ${schemaName}.${tableName}:`, error);
        }

        const columns: ColumnMetadata[] = columnsRes.rows.map((col: any) => ({
          name: col.column_name,
          type: (col.data_type as string).toUpperCase(),
          nullable: col.is_nullable === "YES",
          isPrimaryKey: pkCols.includes(col.column_name),
          length: col.character_maximum_length ? Number(col.character_maximum_length) : undefined,
        }));

        const foreignKeysRes = await client.query(
          `SELECT
             tc.constraint_name,
             kcu.column_name,
             ccu.table_schema AS foreign_table_schema,
             ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name,
             rc.update_rule,
             rc.delete_rule,
             kcu.ordinal_position
           FROM information_schema.table_constraints AS tc
           JOIN information_schema.key_column_usage AS kcu
             ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
           JOIN information_schema.constraint_column_usage AS ccu
             ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
           JOIN information_schema.referential_constraints AS rc
             ON rc.constraint_name = tc.constraint_name
             AND rc.constraint_schema = tc.table_schema
           WHERE tc.constraint_type = 'FOREIGN KEY'
             AND tc.table_schema = $1
             AND tc.table_name = $2
           ORDER BY tc.constraint_name, kcu.ordinal_position`,
          [schemaName, tableName]
        );

        type ForeignKeyAccumulator = {
          constraintName: string;
          columns: string[];
          referencedSchema?: string;
          referencedTable: string;
          referencedColumns: string[];
          updateRule?: string;
          deleteRule?: string;
        };

        const foreignKeyMap = new Map<string, ForeignKeyAccumulator>();

        for (const row of foreignKeysRes.rows) {
          const constraintName = row.constraint_name as string;
          let accumulator = foreignKeyMap.get(constraintName);
          if (!accumulator) {
            accumulator = {
              constraintName,
              columns: [],
              referencedSchema: row.foreign_table_schema as string | undefined,
              referencedTable: row.foreign_table_name as string,
              referencedColumns: [],
              updateRule: row.update_rule as string | undefined,
              deleteRule: row.delete_rule as string | undefined,
            };
            foreignKeyMap.set(constraintName, accumulator);
          }

          accumulator.columns.push(row.column_name as string);
          accumulator.referencedColumns.push(row.foreign_column_name as string);
        }

        const foreignKeys = Array.from(foreignKeyMap.values()).map((fk) => {
          const referencedSchema = fk.referencedSchema ?? undefined;
          const referencedDisplayName = referencedSchema && referencedSchema !== schemaName && referencedSchema !== "public"
            ? `${referencedSchema}.${fk.referencedTable}`
            : fk.referencedTable;
          return {
            constraintName: fk.constraintName,
            columns: fk.columns,
            referencedSchema,
            referencedTable: referencedDisplayName,
            referencedColumns: fk.referencedColumns,
            updateRule: fk.updateRule,
            deleteRule: fk.deleteRule,
            relationshipType: fk.columns.length === 1 ? "N:1" : undefined,
          } satisfies ForeignKeyMetadata;
        });

        const displayName = schemaName && schemaName !== "public"
          ? `${schemaName}.${tableName}`
          : tableName;

        tables.push({
          name: displayName,
          schema: schemaName,
          originalName: tableName,
          columns,
          rowCount,
          foreignKeys,
        });
        }

        return tables;
      } finally {
        try {
          await client.end();
        } catch (error) {
          console.warn("Failed to close PostgreSQL client", error);
        }
      }
    }

    if (config.type === "mysql") {
      // MySQL
      const mysql = await import('mysql2/promise');
      const connection = await mysql.createConnection({
        host: config.host,
        database: config.database,
        user: config.username,
        password: config.password,
      });

      // Get tables
      const [tablesRows] = await connection.query(
        `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
        [config.database]
      );

      const tables: TableMetadata[] = [];
      for (const row of tablesRows as any[]) {
        const tableName = row.TABLE_NAME;
        const schemaName = row.TABLE_SCHEMA as string | undefined;

        // Get columns
        const [columnsRows] = await connection.query(
          `SELECT column_name, data_type, is_nullable, character_maximum_length, column_key
           FROM information_schema.columns
           WHERE table_schema = ? AND table_name = ?`,
          [config.database, tableName]
        );

        // Get row count
        let rowCount: number | undefined = undefined;
        try {
          const [countRows] = await connection.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
          rowCount = (countRows as any[])[0].cnt;
        } catch {}

        const columns: ColumnMetadata[] = (columnsRows as any[]).map(col => ({
          name: col.COLUMN_NAME,
          type: col.DATA_TYPE.toUpperCase(),
          nullable: col.IS_NULLABLE === 'YES',
          isPrimaryKey: col.COLUMN_KEY === 'PRI',
          length: col.CHARACTER_MAXIMUM_LENGTH ? Number(col.CHARACTER_MAXIMUM_LENGTH) : undefined,
        }));

        const [foreignKeysRows] = await connection.query(
          `SELECT
             rc.CONSTRAINT_NAME AS constraint_name,
             kcu.COLUMN_NAME AS column_name,
             rc.REFERENCED_TABLE_SCHEMA AS referenced_table_schema,
             rc.REFERENCED_TABLE_NAME AS referenced_table_name,
             kcu.REFERENCED_COLUMN_NAME AS referenced_column_name,
             rc.UPDATE_RULE,
             rc.DELETE_RULE,
             kcu.ORDINAL_POSITION AS ordinal_position
           FROM information_schema.referential_constraints rc
           JOIN information_schema.key_column_usage kcu
             ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
            AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
           WHERE kcu.TABLE_SCHEMA = ?
             AND kcu.TABLE_NAME = ?
           ORDER BY rc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`,
          [config.database, tableName]
        );

        type ForeignKeyAccumulator = {
          constraintName: string;
          columns: string[];
          referencedSchema?: string;
          referencedTable: string;
          referencedColumns: string[];
          updateRule?: string;
          deleteRule?: string;
        };

        const foreignKeyMap = new Map<string, ForeignKeyAccumulator>();
        for (const fkRow of foreignKeysRows as any[]) {
          const constraintName = fkRow.constraint_name as string;
          let accumulator = foreignKeyMap.get(constraintName);
          if (!accumulator) {
            accumulator = {
              constraintName,
              columns: [],
              referencedSchema: fkRow.referenced_table_schema as string | undefined,
              referencedTable: fkRow.referenced_table_name as string,
              referencedColumns: [],
              updateRule: fkRow.UPDATE_RULE as string | undefined,
              deleteRule: fkRow.DELETE_RULE as string | undefined,
            };
            foreignKeyMap.set(constraintName, accumulator);
          }

          accumulator.columns.push(fkRow.column_name as string);
          accumulator.referencedColumns.push(fkRow.referenced_column_name as string);
        }

        const foreignKeys = Array.from(foreignKeyMap.values()).map((fk) => {
          const referencedSchema = fk.referencedSchema ?? undefined;
          const referencedDisplay = referencedSchema && referencedSchema !== schemaName
            ? `${referencedSchema}.${fk.referencedTable}`
            : fk.referencedTable;
          return {
            constraintName: fk.constraintName,
            columns: fk.columns,
            referencedSchema,
            referencedTable: referencedDisplay,
            referencedColumns: fk.referencedColumns,
            updateRule: fk.updateRule,
            deleteRule: fk.deleteRule,
            relationshipType: fk.columns.length === 1 ? "N:1" : undefined,
          } satisfies ForeignKeyMetadata;
        });

        const displayName = schemaName && schemaName !== config.database
          ? `${schemaName}.${tableName}`
          : tableName;

        tables.push({
          name: displayName,
          schema: schemaName,
          originalName: tableName,
          columns,
          rowCount,
          foreignKeys,
        });
      }

      await connection.end();
      return tables;
    }

    if (config.type === "sql_server") {
      // SQL Server
      const mssql = await import('mssql');
      const pool = await mssql.connect({
        server: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        options: { encrypt: false }
      });

      const tablesRes = await pool.request().query(`
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
      `);

      const tables: TableMetadata[] = [];
      for (const row of tablesRes.recordset) {
        const tableName = row.TABLE_NAME;
        const schemaName = row.TABLE_SCHEMA as string | undefined;

        // Get columns
        const columnsRes = await pool.request().query(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = @tableName AND (@tableSchema IS NULL OR TABLE_SCHEMA = @tableSchema)
        `).input('tableName', mssql.VarChar, tableName).input('tableSchema', mssql.VarChar, schemaName ?? null);

        // Get primary keys
        const pkRes = await pool.request().query(`
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
            AND TABLE_NAME = @tableName
            AND (@tableSchema IS NULL OR TABLE_SCHEMA = @tableSchema)
        `).input('tableName', mssql.VarChar, tableName).input('tableSchema', mssql.VarChar, schemaName ?? null);

        const pkCols = pkRes.recordset.map((r: any) => r.COLUMN_NAME);

        // Get row count
        let rowCount: number | undefined = undefined;
        try {
          const countRes = await pool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`);
          rowCount = countRes.recordset[0].cnt;
        } catch {}

        const columns: ColumnMetadata[] = columnsRes.recordset.map((col: any) => ({
          name: col.COLUMN_NAME,
          type: col.DATA_TYPE.toUpperCase(),
          nullable: col.IS_NULLABLE === 'YES',
          isPrimaryKey: pkCols.includes(col.COLUMN_NAME),
          length: col.CHARACTER_MAXIMUM_LENGTH ? Number(col.CHARACTER_MAXIMUM_LENGTH) : undefined,
        }));

        const fkQuery = pool.request()
          .input('tableName', mssql.VarChar, tableName)
          .input('tableSchema', mssql.VarChar, schemaName ?? null)
          .query(`
            SELECT
              fk.name AS constraint_name,
              parent_col.name AS column_name,
              referenced_schema.name AS referenced_schema,
              referenced_tab.name AS referenced_table,
              referenced_col.name AS referenced_column_name,
              fk.delete_referential_action_desc AS delete_rule,
              fk.update_referential_action_desc AS update_rule,
              fk_cols.constraint_column_id AS ordinal_position
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fk_cols ON fk.object_id = fk_cols.constraint_object_id
            JOIN sys.tables parent_tab ON fk.parent_object_id = parent_tab.object_id
            JOIN sys.schemas parent_schema ON parent_tab.schema_id = parent_schema.schema_id
            JOIN sys.columns parent_col ON fk_cols.parent_column_id = parent_col.column_id AND fk_cols.parent_object_id = parent_col.object_id
            JOIN sys.tables referenced_tab ON fk.referenced_object_id = referenced_tab.object_id
            JOIN sys.schemas referenced_schema ON referenced_tab.schema_id = referenced_schema.schema_id
            JOIN sys.columns referenced_col ON fk_cols.referenced_column_id = referenced_col.column_id AND fk_cols.referenced_object_id = referenced_col.object_id
            WHERE parent_tab.name = @tableName
              AND (@tableSchema IS NULL OR parent_schema.name = @tableSchema)
            ORDER BY fk.name, fk_cols.constraint_column_id
          `);

        const fkRes = await fkQuery;

        type ForeignKeyAccumulator = {
          constraintName: string;
          columns: string[];
          referencedSchema?: string;
          referencedTable: string;
          referencedColumns: string[];
          updateRule?: string;
          deleteRule?: string;
        };

        const foreignKeyMap = new Map<string, ForeignKeyAccumulator>();
        for (const fkRow of fkRes.recordset) {
          const constraintName = fkRow.constraint_name as string;
          let accumulator = foreignKeyMap.get(constraintName);
          if (!accumulator) {
            accumulator = {
              constraintName,
              columns: [],
              referencedSchema: fkRow.referenced_schema as string | undefined,
              referencedTable: fkRow.referenced_table as string,
              referencedColumns: [],
              updateRule: fkRow.update_rule as string | undefined,
              deleteRule: fkRow.delete_rule as string | undefined,
            };
            foreignKeyMap.set(constraintName, accumulator);
          }

          accumulator.columns.push(fkRow.column_name as string);
          accumulator.referencedColumns.push(fkRow.referenced_column_name as string);
        }

        const foreignKeys = Array.from(foreignKeyMap.values()).map((fk) => {
          const referencedSchema = fk.referencedSchema ?? undefined;
          const referencedDisplay = referencedSchema && referencedSchema !== schemaName
            ? `${referencedSchema}.${fk.referencedTable}`
            : fk.referencedTable;
          return {
            constraintName: fk.constraintName,
            columns: fk.columns,
            referencedSchema,
            referencedTable: referencedDisplay,
            referencedColumns: fk.referencedColumns,
            updateRule: fk.updateRule,
            deleteRule: fk.deleteRule,
            relationshipType: fk.columns.length === 1 ? "N:1" : undefined,
          } satisfies ForeignKeyMetadata;
        });

        const displayName = schemaName && schemaName !== "dbo"
          ? `${schemaName}.${tableName}`
          : tableName;

        tables.push({
          name: displayName,
          schema: schemaName,
          originalName: tableName,
          columns,
          rowCount,
          foreignKeys,
        });
      }

      await pool.close();
      return tables;
    }

    // For Oracle, SAP HANA, and generic_sql, you would need to implement similar logic using their respective drivers.
    // For now, throw an error for unsupported types.
    throw new Error(`Database type "${config.type}" is not supported in this implementation.`);
  }

  // Parse CSV file
  async parseCSVFile(fileContent: string): Promise<TableMetadata> {
    const lines = fileContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataLines = lines.slice(1);

    const columns: ColumnMetadata[] = headers.map(header => {
      // Infer type from first few data rows
      const sampleValues = dataLines.slice(0, 5).map(line => {
        const values = line.split(',');
        const index = headers.indexOf(header);
        return values[index]?.trim().replace(/"/g, '') || '';
      });

      const type = this.inferColumnType(sampleValues);
      
      return {
        name: header,
        type,
        nullable: sampleValues.some(val => !val),
        isPrimaryKey: false,
      };
    });

    // Try to identify primary key (usually ID fields)
    const idColumn = columns.find(col => 
      col.name.toLowerCase().includes('id') && 
      col.name.toLowerCase() !== 'id'
    );
    if (idColumn) {
      idColumn.isPrimaryKey = true;
    }

    return {
      name: "CSV_DATA",
      columns,
      rowCount: dataLines.length
    };
  }

  // Test ADLS connection
  async testADLSConnection(config: ADLSConnectionConfig): Promise<boolean> {
    try {
      // In a real implementation, this would use Azure Storage SDK
      if (!config.storageAccount || !config.containerName) {
        return false;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    } catch (error) {
      console.error('ADLS connection failed:', error);
      return false;
    }
  }

  // List datasets in ADLS
  async listADLSDatasets(config: ADLSConnectionConfig): Promise<TableMetadata[]> {
    // Sample ADLS datasets
    return [
      {
        name: "employee_delta",
        columns: [
          { name: "employee_id", type: "string", nullable: false, isPrimaryKey: true },
          { name: "name", type: "string", nullable: false, isPrimaryKey: false },
          { name: "department", type: "string", nullable: true, isPrimaryKey: false },
          { name: "salary", type: "decimal", nullable: true, isPrimaryKey: false },
        ]
      },
      {
        name: "sales_data",
        columns: [
          { name: "transaction_id", type: "string", nullable: false, isPrimaryKey: true },
          { name: "amount", type: "decimal", nullable: false, isPrimaryKey: false },
          { name: "date", type: "date", nullable: false, isPrimaryKey: false },
        ]
      }
    ];
  }

  private inferColumnType(values: string[]): string {
    if (values.every(val => !val || !isNaN(Number(val)))) {
      return values.some(val => val.includes('.')) ? 'DECIMAL' : 'INTEGER';
    }
    
    if (values.every(val => !val || this.isDate(val))) {
      return 'DATE';
    }
    
    if (values.every(val => !val || ['true', 'false', '1', '0'].includes(val.toLowerCase()))) {
      return 'BOOLEAN';
    }
    
    return 'VARCHAR';
  }

  private isDate(value: string): boolean {
    return !isNaN(Date.parse(value));
  }

  // Enhanced file upload methods
  async parseExcelFile(fileBuffer: Buffer): Promise<TableMetadata[]> {
    try {
      // Note: For a complete implementation, you would need to install xlsx package
      // For now, we'll throw an error with instructions
      throw new Error('Excel file parsing requires xlsx package installation. Please convert to CSV format for now.');
    } catch (error) {
      throw new Error('Failed to parse Excel file: ' + (error as any).message);
    }
  }

  async parseParquetFile(fileBuffer: Buffer): Promise<TableMetadata> {
    try {
      // Note: For a complete implementation, you would need to install parquet-js package
      // For now, we'll throw an error with instructions
      throw new Error('Parquet file parsing requires parquet-js package installation. Please convert to CSV format for now.');
    } catch (error) {
      throw new Error('Failed to parse Parquet file: ' + (error as any).message);
    }
  }

  async parseSQLiteFile(fileBuffer: Buffer): Promise<TableMetadata[]> {
    try {
      // Note: For a complete implementation, you would need to install sqlite3 package
      // For now, we'll throw an error with instructions
      throw new Error('SQLite file parsing requires sqlite3 package installation. Please provide DDL scripts for now.');
    } catch (error) {
      throw new Error('Failed to parse SQLite file: ' + (error as any).message);
    }
  }

  async parseDDLScript(ddlContent: string): Promise<TableMetadata[]> {
    try {
      // Simple DDL parsing for basic CREATE TABLE statements
      const tables: TableMetadata[] = [];
      const createTableRegex = /CREATE\s+TABLE\s+(\w+)\s*\(\s*([^)]+)\s*\)/gi;
      
      let match;
      while ((match = createTableRegex.exec(ddlContent)) !== null) {
        const tableName = match[1];
        const columnDefinitions = match[2];
        
        const columns = this.parseColumnDefinitions(columnDefinitions);
        
        tables.push({
          name: tableName,
          columns,
          rowCount: 0
        });
      }
      
      return tables;
    } catch (error) {
      throw new Error('Failed to parse DDL script: ' + (error as any).message);
    }
  }

  private parseColumnDefinitions(columnDefs: string): ColumnMetadata[] {
    const columns: ColumnMetadata[] = [];
    const columnLines = columnDefs.split(',');
    
    for (const line of columnLines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      const parts = trimmedLine.split(/\s+/);
      if (parts.length < 2) continue;
      
      const name = parts[0];
      const type = parts[1];
      const isPrimaryKey = trimmedLine.toUpperCase().includes('PRIMARY KEY');
      const nullable = !trimmedLine.toUpperCase().includes('NOT NULL');
      
      columns.push({
        name,
        type,
        nullable,
        isPrimaryKey
      });
    }
    
    return columns;
  }
}

export const dataConnectors = new DataConnectors();
