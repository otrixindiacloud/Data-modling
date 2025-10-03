export type ModelingAgentLayer = "conceptual" | "logical" | "physical";

export type ModelingAgentSeverity = "info" | "warning" | "error";

export interface ModelingAgentRelationship {
  target: string;
  type: string;
  description?: string | null;
}

export interface ModelingAgentConceptualEntity {
  name: string;
  description?: string | null;
  relationships: ModelingAgentRelationship[];
}

export interface ModelingAgentAttribute {
  name: string;
  conceptualType?: string | null;
  logicalType?: string | null;
  physicalType?: string | null;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  description?: string | null;
  unique?: boolean;
}

export interface ModelingAgentLogicalEntity {
  name: string;
  description?: string | null;
  attributes: ModelingAgentAttribute[];
}

export interface ModelingAgentIssue {
  severity: ModelingAgentSeverity;
  message: string;
  entity?: string;
}

export type ModelingAgentDiffAction =
  | "create_model_family"
  | "add_entity"
  | "update_entity"
  | "remove_entity"
  | "add_attribute"
  | "update_attribute"
  | "remove_attribute"
  | "add_relationship"
  | "update_relationship"
  | "remove_relationship";

export interface ModelingAgentDiffEntry {
  action: ModelingAgentDiffAction;
  layer: ModelingAgentLayer | "all";
  target: string;
  status: "applied" | "skipped";
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelingAgentResponse {
  summary: string;
  assumptions: string[];
  conceptualModel: {
    entities: ModelingAgentConceptualEntity[];
  };
  logicalModel: {
    entities: ModelingAgentLogicalEntity[];
  };
  physicalModel: {
    entities: ModelingAgentLogicalEntity[];
  };
  sql: Record<string, string>;
  issues: ModelingAgentIssue[];
  suggestions: string[];
  diff: ModelingAgentDiffEntry[];
}

export interface ModelingAgentRequestPayload {
  rootModelId?: number;
  modelName?: string;
  businessDescription: string;
  instructions: string;
  targetDatabase?: string;
  sqlPlatforms?: string[];
  allowDrop?: boolean;
  generateSql?: boolean;
}
