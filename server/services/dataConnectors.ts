export interface DatabaseConnectionConfig {
  type: "sap_hana" | "oracle" | "sql_server";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface ADLSConnectionConfig {
  type: "adls_gen2";
  storageAccount: string;
  containerName: string;
  path: string;
  sasToken?: string;
  accessKey?: string;
}

export interface TableMetadata {
  name: string;
  columns: ColumnMetadata[];
  rowCount?: number;
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
    // In a real implementation, this would connect to the actual database
    // For now, we'll return sample metadata based on the database type
    
    const sampleTables: TableMetadata[] = [
      {
        name: "EMPLOYEES",
        columns: [
          { name: "EMPLOYEE_ID", type: "VARCHAR", nullable: false, isPrimaryKey: true, length: 36 },
          { name: "FIRST_NAME", type: "VARCHAR", nullable: false, isPrimaryKey: false, length: 100 },
          { name: "LAST_NAME", type: "VARCHAR", nullable: false, isPrimaryKey: false, length: 100 },
          { name: "EMAIL", type: "VARCHAR", nullable: true, isPrimaryKey: false, length: 255 },
          { name: "DEPARTMENT_ID", type: "INTEGER", nullable: true, isPrimaryKey: false },
          { name: "HIRE_DATE", type: "DATE", nullable: false, isPrimaryKey: false },
        ],
        rowCount: 1245
      },
      {
        name: "DEPARTMENTS",
        columns: [
          { name: "DEPARTMENT_ID", type: "INTEGER", nullable: false, isPrimaryKey: true },
          { name: "DEPARTMENT_NAME", type: "VARCHAR", nullable: false, isPrimaryKey: false, length: 100 },
          { name: "MANAGER_ID", type: "VARCHAR", nullable: true, isPrimaryKey: false, length: 36 },
          { name: "BUDGET", type: "DECIMAL", nullable: true, isPrimaryKey: false },
        ],
        rowCount: 15
      }
    ];

    return sampleTables;
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
