export interface ObjectLakeResponse {
  objects: ObjectLakeObject[];
  totals: {
    objectCount: number;
    attributeCount: number;
    relationshipCount: number;
    modelInstanceCount: number;
  };
  appliedFilters: {
    search: string | null;
    domainId: number | null;
    dataAreaId: number | null;
    systemId: number | null;
    modelId: number | null;
    layer: string | null;
    objectType: string | null;
    hasAttributes: boolean | null;
    relationshipType: string | null;
    includeHidden: boolean;
    sortBy: string;
    sortOrder: "asc" | "desc";
  };
  meta: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    generatedAt: string;
  };
}

export interface ObjectLakeObject {
  id: number;
  name: string;
  description: string | null;
  objectType: string | null;
  domain: ObjectLakeDomain | null;
  dataArea: ObjectLakeArea | null;
  system: ObjectLakeSystem | null;
  baseModel: ObjectLakeModel | null;
  baseMetadata: {
    position?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    commonProperties?: Record<string, unknown> | null;
  };
  stats: {
    attributeCount: number;
    relationshipCount: number;
    modelInstanceCount: number;
    lastUpdated: string | null;
  };
  modelInstances: ObjectLakeModelInstance[];
  attributes: ObjectLakeAttribute[];
  relationships: {
    global: ObjectLakeRelationship[];
    modelSpecific: ObjectLakeRelationship[];
  };
  properties: ObjectLakeProperty[];
  tags: string[];
  updatedAt: string | null;
}

export interface ObjectLakeDomain {
  id: number;
  name: string;
  description?: string | null;
  colorCode?: string | null;
}

export interface ObjectLakeArea {
  id: number;
  name: string;
  description?: string | null;
  colorCode?: string | null;
  domainId?: number | null;
}

export interface ObjectLakeSystem {
  id: number;
  name: string;
  category: string;
  type: string;
  description?: string | null;
  colorCode?: string | null;
}

export interface ObjectLakeModel {
  id: number;
  name: string;
  layer: string;
  parentModelId: number | null;
  domainId?: number | null;
  dataAreaId?: number | null;
}

export interface ObjectLakeModelInstance {
  id: number;
  model: ObjectLakeModel | null;
  targetSystem: ObjectLakeSystem | null;
  position: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  isVisible: boolean;
  layerSpecificConfig: Record<string, unknown> | null;
  properties: ObjectLakeProperty[];
  attributes: ObjectLakeModelAttribute[];
  relationships: ObjectLakeRelationship[];
}

export interface ObjectLakeAttribute {
  id: number;
  name: string;
  description: string | null;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  dataType: string | null;
  conceptualType: string | null;
  logicalType: string | null;
  physicalType: string | null;
  length: number | null;
  precision: number | null;
  scale: number | null;
  orderIndex: number | null;
  commonProperties: Record<string, unknown> | null;
  metadataByModel: Record<number, ObjectLakeModelAttribute>;
  properties: ObjectLakeProperty[];
}

export interface ObjectLakeModelAttribute {
  id: number;
  modelId: number;
  modelObjectId: number;
  conceptualType: string | null;
  logicalType: string | null;
  physicalType: string | null;
  nullable: boolean | null;
  isPrimaryKey: boolean | null;
  isForeignKey: boolean | null;
  orderIndex: number | null;
  layerSpecificConfig: Record<string, unknown> | null;
}

export interface ObjectLakeRelationship {
  id: number;
  modelId: number | null;
  layer: string | null;
  sourceModelObjectId: number | null;
  targetModelObjectId: number | null;
  type: string;
  relationshipLevel: string;
  name: string | null;
  description: string | null;
}

export interface ObjectLakeProperty {
  id: number;
  entityType: string;
  entityId: number;
  modelId: number;
  propertyName: string;
  propertyValue: unknown;
  propertyType: string;
  layer: string | null;
  description: string | null;
  isSystemProperty: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}
