import { DataModel, DataObject, Attribute, DataModelObjectRelationship } from "@shared/schema";

export interface ExportOptions {
  format: "json" | "sql_ddl" | "quicksql" | "png" | "pdf" | "svg" | "excel" | "csv" | "md" | "yaml";
  layer: "all" | "conceptual" | "logical" | "physical";
  includePrimaryKeys: boolean;
  includeForeignKeys: boolean;
  includeConstraints: boolean;
  includeMetadata: boolean;
  includeDescriptions: boolean;
  includeLegend: boolean;
  includeTitle: boolean;
  includeTimestamp: boolean;
  pageSize?: "A4" | "A3" | "Letter" | "Legal";
  orientation?: "portrait" | "landscape";
  quality?: "draft" | "standard" | "high";
  theme?: "light" | "dark" | "auto";
  style?: "minimal" | "detailed" | "professional";
}

export class ExportService {
  async exportModel(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
  relationships: DataModelObjectRelationship[],
    options: ExportOptions
  ): Promise<string> {
    switch (options.format) {
      case "json":
        return this.exportToJSON(model, objects, attributes, relationships, options);
      case "sql_ddl":
        return this.exportToSQLDDL(model, objects, attributes, relationships, options);
      case "quicksql":
        return this.exportToQuickSQL(model, objects, attributes, relationships, options);
      case "csv":
        return this.exportToCSV(model, objects, attributes, relationships, options);
      case "md":
        return this.exportToMarkdown(model, objects, attributes, relationships, options);
      case "yaml":
        return this.exportToYAML(model, objects, attributes, relationships, options);
      case "excel":
        return this.exportToExcel(model, objects, attributes, relationships, options);
      case "png":
      case "pdf":
      case "svg":
        // These formats are handled client-side, return a placeholder
        return "Image export handled client-side";
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private async exportToJSON(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
  relationships: DataModelObjectRelationship[],
    options: ExportOptions
  ): Promise<string> {
    const modelData = {
      id: model.id,
      name: model.name,
      layer: options.layer === "all" ? model.layer : options.layer,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      nodes: objects.map(obj => ({
        id: obj.id.toString(),
        name: obj.name,
        domain: obj.domainId,
        dataArea: obj.dataAreaId,
        position: obj.position,
        attributes: attributes
          .filter(attr => attr.objectId === obj.id)
          .map(attr => this.formatAttributeForExport(attr, options))
      })),
      edges: relationships.map(rel => ({
        id: rel.id.toString(),
        source: rel.sourceModelObjectId.toString(),
        target: rel.targetModelObjectId.toString(),
        type: rel.type,
        sourceAttribute: rel.sourceAttributeId,
        targetAttribute: rel.targetAttributeId
      }))
    };

    return JSON.stringify(modelData, null, 2);
  }

  private async exportToSQLDDL(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
  relationships: DataModelObjectRelationship[],
    options: ExportOptions
  ): Promise<string> {
    let ddl = `-- Generated DDL for ${model.name}\n`;
    ddl += `-- Layer: ${options.layer}\n`;
    ddl += `-- Generated on: ${new Date().toISOString()}\n\n`;

    // Create tables
    for (const obj of objects) {
      ddl += this.generateCreateTable(obj, attributes, options);
      ddl += "\n\n";
    }

    // Add foreign key constraints
    if (options.includeForeignKeys) {
      for (const rel of relationships) {
        if (rel.type === "1:N" && rel.sourceAttributeId && rel.targetAttributeId) {
          const sourceObj = objects.find(o => o.id === rel.sourceModelObjectId);
          const targetObj = objects.find(o => o.id === rel.targetModelObjectId);
          const sourceAttr = attributes.find(a => a.id === rel.sourceAttributeId);
          const targetAttr = attributes.find(a => a.id === rel.targetAttributeId);
          
          if (sourceObj && targetObj && sourceAttr && targetAttr) {
            ddl += `ALTER TABLE ${sourceObj.name}\n`;
            ddl += `ADD CONSTRAINT FK_${sourceObj.name}_${targetObj.name}\n`;
            ddl += `FOREIGN KEY (${sourceAttr.name}) REFERENCES ${targetObj.name}(${targetAttr.name});\n\n`;
          }
        }
      }
    }

    return ddl;
  }

  private async exportToQuickSQL(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
  relationships: DataModelObjectRelationship[],
    options: ExportOptions
  ): Promise<string> {
    let quicksql = `# ${model.name}\n`;
    quicksql += `# Layer: ${options.layer}\n\n`;

    for (const obj of objects) {
      quicksql += `${obj.name}\n`;
      
      const objAttributes = attributes.filter(attr => attr.objectId === obj.id);
      for (const attr of objAttributes) {
        const typeInfo = this.getQuickSQLType(attr, options);
        const constraints = [];
        
        if (attr.isPrimaryKey) constraints.push("/pk");
        if (!attr.nullable) constraints.push("/nn");
        
        quicksql += `  ${attr.name} ${typeInfo}${constraints.join("")}\n`;
      }
      
      quicksql += "\n";
    }

    return quicksql;
  }

  private generateCreateTable(
    obj: DataObject,
    allAttributes: Attribute[],
    options: ExportOptions
  ): string {
    const attributes = allAttributes.filter(attr => attr.objectId === obj.id);
    let sql = `CREATE TABLE ${obj.name} (\n`;
    
    const columnDefinitions = attributes.map(attr => {
      const type = this.getSQLType(attr, options);
      const constraints = [];
      
      if (options.includePrimaryKeys && attr.isPrimaryKey) {
        constraints.push("PRIMARY KEY");
      }
      
      if (!attr.nullable) {
        constraints.push("NOT NULL");
      }
      
      return `  ${attr.name} ${type}${constraints.length > 0 ? ' ' + constraints.join(' ') : ''}`;
    });
    
    sql += columnDefinitions.join(",\n");
    sql += "\n);";
    
    return sql;
  }

  private formatAttributeForExport(attr: Attribute, options: ExportOptions) {
    const result: any = {
      name: attr.name,
      nullable: attr.nullable,
      isPrimaryKey: attr.isPrimaryKey,
      isForeignKey: attr.isForeignKey,
      orderIndex: attr.orderIndex
    };

    if (options.layer === "all" || options.layer === "conceptual") {
      result.conceptualType = attr.conceptualType;
    }
    
    if (options.layer === "all" || options.layer === "logical") {
      result.logicalType = attr.logicalType;
    }
    
    if (options.layer === "all" || options.layer === "physical") {
      result.physicalType = attr.physicalType;
      result.length = attr.length;
    }

    return result;
  }

  private getSQLType(attr: Attribute, options: ExportOptions): string {
    if (options.layer === "physical" && attr.physicalType) {
      return attr.physicalType;
    }
    
    if (options.layer === "logical" && attr.logicalType) {
      return attr.logicalType;
    }
    
    // Fallback to conceptual type mapping
    const typeMap: Record<string, string> = {
      "Text": "VARCHAR(255)",
      "Number": "INTEGER",
      "Decimal": "DECIMAL(10,2)",
      "Date": "DATE",
      "DateTime": "TIMESTAMP",
      "Boolean": "BOOLEAN",
      "Currency": "DECIMAL(15,2)"
    };
    
    return typeMap[attr.conceptualType || "Text"] || "VARCHAR(255)";
  }

  private getQuickSQLType(attr: Attribute, options: ExportOptions): string {
    if (options.layer === "physical" && attr.physicalType) {
      return attr.physicalType.toLowerCase();
    }
    
    const typeMap: Record<string, string> = {
      "Text": "varchar2(255)",
      "Number": "number",
      "Decimal": "number(10,2)",
      "Date": "date",
      "DateTime": "timestamp",
      "Boolean": "char(1)",
      "Currency": "number(15,2)"
    };
    
    return typeMap[attr.conceptualType || "Text"] || "varchar2(255)";
  }

  private async exportToCSV(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
  relationships: DataModelObjectRelationship[],
    options: ExportOptions
  ): Promise<string> {
    let csv = "";
    
    if (options.includeTitle) {
      csv += `"${model.name} - ${options.layer} Layer"\n\n`;
    }
    
    // Objects table
    csv += "Objects\n";
    csv += "Name,Domain,Data Area,Description\n";
    
    for (const obj of objects) {
      const description = (obj as any).description || "";
      csv += `"${obj.name}","${obj.domainId || ''}","${obj.dataAreaId || ''}","${description}"\n`;
    }
    
    csv += "\n";
    
    // Attributes table
    csv += "Attributes\n";
    csv += "Object,Name,Conceptual Type,Logical Type,Physical Type,Primary Key,Foreign Key,Nullable,Description\n";
    
    for (const obj of objects) {
      const objAttributes = attributes.filter(attr => attr.objectId === obj.id);
      for (const attr of objAttributes) {
        csv += `"${obj.name}","${attr.name}","${attr.conceptualType || ''}","${attr.logicalType || ''}","${attr.physicalType || ''}","${attr.isPrimaryKey ? 'Yes' : 'No'}","${attr.isForeignKey ? 'Yes' : 'No'}","${attr.nullable ? 'Yes' : 'No'}","${attr.description || ''}"\n`;
      }
    }
    
    csv += "\n";
    
    // Relationships table
    csv += "Relationships\n";
    csv += "Source Object,Target Object,Type,Source Attribute,Target Attribute\n";
    
    for (const rel of relationships) {
      const sourceObj = objects.find(o => o.id === rel.sourceModelObjectId);
      const targetObj = objects.find(o => o.id === rel.targetModelObjectId);
      const sourceAttr = rel.sourceAttributeId ? attributes.find(a => a.id === rel.sourceAttributeId) : null;
      const targetAttr = rel.targetAttributeId ? attributes.find(a => a.id === rel.targetAttributeId) : null;
      
      csv += `"${sourceObj?.name || ''}","${targetObj?.name || ''}","${rel.type}","${sourceAttr?.name || ''}","${targetAttr?.name || ''}"\n`;
    }
    
    return csv;
  }

  private async exportToMarkdown(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
    relationships: Relationship[],
    options: ExportOptions
  ): Promise<string> {
    let md = "";
    
    if (options.includeTitle) {
      md += `# ${model.name}\n\n`;
      md += `**Layer:** ${options.layer}\n\n`;
    }
    
    if (options.includeTimestamp) {
      md += `**Generated:** ${new Date().toISOString()}\n\n`;
    }
    
    // Objects section
    md += `## Objects (${objects.length})\n\n`;
    
    for (const obj of objects) {
      md += `### ${obj.name}\n\n`;
      
      const objAttributes = attributes.filter(attr => attr.objectId === obj.id);
      
      if (objAttributes.length > 0) {
        md += "| Attribute | Type | Constraints | Description |\n";
        md += "|-----------|------|-------------|-------------|\n";
        
        for (const attr of objAttributes) {
          const constraints = [];
          if (attr.isPrimaryKey) constraints.push("PK");
          if (attr.isForeignKey) constraints.push("FK");
          if (!attr.nullable) constraints.push("NOT NULL");
          
          const type = options.layer === "physical" ? attr.physicalType : 
                      options.layer === "logical" ? attr.logicalType : 
                      attr.conceptualType;
          
          md += `| ${attr.name} | ${type || ''} | ${constraints.join(', ')} | ${attr.description || ''} |\n`;
        }
        
        md += "\n";
      }
    }
    
    // Relationships section
    if (relationships.length > 0) {
      md += `## Relationships (${relationships.length})\n\n`;
      md += "| Source | Target | Type | Description |\n";
      md += "|--------|--------|------|-----------|\n";
      
      for (const rel of relationships) {
        const sourceObj = objects.find(o => o.id === rel.sourceModelObjectId);
        const targetObj = objects.find(o => o.id === rel.targetModelObjectId);
        
        md += `| ${sourceObj?.name || ''} | ${targetObj?.name || ''} | ${rel.type} | |\n`;
      }
    }
    
    return md;
  }

  private async exportToYAML(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
    relationships: Relationship[],
    options: ExportOptions
  ): Promise<string> {
    const data = {
      model: {
        id: model.id,
        name: model.name,
        layer: options.layer === "all" ? model.layer : options.layer,
        createdAt: model.createdAt,
        updatedAt: model.updatedAt
      },
      objects: objects.map(obj => ({
        id: obj.id,
        name: obj.name,
        domainId: obj.domainId,
        dataAreaId: obj.dataAreaId,
        attributes: attributes
          .filter(attr => attr.objectId === obj.id)
          .map(attr => this.formatAttributeForExport(attr, options))
      })),
      relationships: relationships.map(rel => ({
        id: rel.id,
        sourceObjectId: rel.sourceModelObjectId,
        targetObjectId: rel.targetModelObjectId,
        type: rel.type,
        sourceAttributeId: rel.sourceAttributeId,
        targetAttributeId: rel.targetAttributeId
      }))
    };
    
    // Simple YAML serialization (for production, use a proper YAML library)
    return this.objectToYAML(data);
  }

  private objectToYAML(obj: any, indent = 0): string {
    const spaces = "  ".repeat(indent);
    let yaml = "";
    
    if (Array.isArray(obj)) {
      for (const item of obj) {
        yaml += `${spaces}- `;
        if (typeof item === "object" && item !== null) {
          yaml += "\n" + this.objectToYAML(item, indent + 1);
        } else {
          yaml += `${item}\n`;
        }
      }
    } else if (typeof obj === "object" && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        yaml += `${spaces}${key}:`;
        if (Array.isArray(value)) {
          yaml += "\n" + this.objectToYAML(value, indent + 1);
        } else if (typeof value === "object" && value !== null) {
          yaml += "\n" + this.objectToYAML(value, indent + 1);
        } else {
          yaml += ` ${value}\n`;
        }
      }
    }
    
    return yaml;
  }

  private async exportToExcel(
    model: DataModel,
    objects: DataObject[],
    attributes: Attribute[],
    relationships: Relationship[],
    options: ExportOptions
  ): Promise<string> {
    // For now, return CSV format as Excel placeholder
    // In production, use a library like xlsx or exceljs
    const csvData = await this.exportToCSV(model, objects, attributes, relationships, options);
    return `Excel export not fully implemented. CSV data:\n\n${csvData}`;
  }
}

export const exportService = new ExportService();
