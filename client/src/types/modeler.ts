export interface Position {
  x: number;
  y: number;
}

export interface CanvasNode {
  id: string;
  type: string;
  position: Position;
  data: {
    modelObjectId?: number;
    objectId: number;
    name: string;
    domain?: string;
    dataArea?: string;
    attributes: AttributeData[];
    isNew?: boolean;
    sourceSystem?: string;
    targetSystem?: string;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: {
    relationshipType: "1:1" | "1:N" | "N:M";
    label?: string;
  };
}

export interface AttributeData {
  id: number;
  name: string;
  conceptualType?: string;
  logicalType?: string;
  physicalType?: string;
  length?: number;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  orderIndex: number;
  isNew?: boolean;
}

export interface DataSourceConnection {
  id: number;
  name: string;
  type: "sql" | "file" | "adls" | "ddl";
  status: "connected" | "disconnected" | "error";
  configuration?: Record<string, any>;
  metadata?: TableMetadata[];
}

export interface TableMetadata {
  name: string;
  schema?: string;
  originalName?: string;
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

export interface AISuggestion {
  type: "domain" | "relationship" | "normalization";
  title: string;
  description: string;
  confidence: number;
  action: () => void;
}

export type ModelLayer = "conceptual" | "logical" | "physical";

export interface ExportOptions {
  format: "json" | "sql_ddl" | "quicksql";
  layer: "all" | "conceptual" | "logical" | "physical";
  includePrimaryKeys: boolean;
  includeForeignKeys: boolean;
  includeConstraints: boolean;
}
