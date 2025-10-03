import { db } from "./db";
import {
  dataModels,
  dataDomains,
  dataAreas,
  dataObjects,
  attributes,
  systems,
  configurations,
  businessCapabilities,
  capabilityDataDomainMappings,
  capabilityDataAreaMappings,
  capabilitySystemMappings,
  capabilityDataModelMappings,
  capabilityModelSystemMappings,
  dataModelSystemMappings,
  modelLifecyclePhases,
  modelLifecycleAssignments,
} from "@shared/schema";
import type {
  InsertSystem,
  InsertDataDomain,
  InsertDataArea,
  InsertDataModel,
  InsertDataObject,
  InsertAttribute,
  InsertBusinessCapability,
  InsertCapabilityDataDomainMapping,
  InsertCapabilityDataAreaMapping,
  InsertCapabilitySystemMapping,
  InsertCapabilityDataModelMapping,
  InsertCapabilityModelSystemMapping,
  InsertDataModelSystemMapping,
  InsertModelLifecyclePhase,
  InsertModelLifecycleAssignment,
  System,
  DataDomain,
  DataArea,
  DataObject,
  DataModel,
  BusinessCapability,
  ModelLifecyclePhase,
} from "@shared/schema";

type Keyed<T> = { key: string } & T;

type RoadmapPriority = "In Flight" | "Q1 FY24" | "Q2 FY24" | "Q3 FY24" | "Q4 FY24" | "Q1 FY25" | "Q2 FY25" | "Q3 FY25";

type CapabilityLifecycleStatus =
  | "planned"
  | "in_progress"
  | "in_validation"
  | "active";

type CapabilityAlignmentRating = "low" | "medium" | "high";

type CapabilityRiskLevel = "low" | "medium" | "high";

type CapabilityMetadata = {
  roadmapPriority: RoadmapPriority;
  metrics?: string[];
  operatingRegions?: string[];
  primaryKPIs?: string[];
};

interface CapabilityDataModelGovernance
  extends Omit<
      InsertCapabilityDataModelMapping,
      "capabilityId" | "modelId" | "domainId" | "lifecyclePhaseId" | "metadata"
    > {
  capabilityKey: string;
  modelKey: string;
  domainKey?: string;
  lifecyclePhaseKey?: string;
  metadata?: CapabilityMetadata;
}

interface CapabilityModelSystemTrace
  extends Omit<InsertCapabilityModelSystemMapping, "capabilityId" | "modelId" | "systemId"> {
  capabilityKey: string;
  modelKey: string;
  systemKey: string;
}

interface LifecycleAssignmentSeed
  extends Omit<InsertModelLifecycleAssignment, "modelId" | "phaseId"> {
  modelKey: string;
  phaseKey: string;
}

const lifecyclePhasesSeed: InsertModelLifecyclePhase[] = [
  {
    key: "ideate",
    name: "Ideation",
    description: "Gather business needs and outline desired outcomes",
    sequence: 1,
    defaultDurationDays: 10,
    requiresApproval: false,
  },
  {
    key: "design",
    name: "Design",
    description: "Author conceptual and logical representations with stakeholders",
    sequence: 2,
    defaultDurationDays: 30,
    requiresApproval: true,
  },
  {
    key: "build",
    name: "Build",
    description: "Implement physical models and integration patterns",
    sequence: 3,
    defaultDurationDays: 25,
    requiresApproval: true,
  },
  {
    key: "validate",
    name: "Validate",
    description: "Complete testing, data quality checks, and sign-offs",
    sequence: 4,
    defaultDurationDays: 15,
    requiresApproval: true,
  },
  {
    key: "deploy",
    name: "Deploy",
    description: "Promote to production and enable consumption pathways",
    sequence: 5,
    defaultDurationDays: 10,
    requiresApproval: false,
  },
  {
    key: "monitor",
    name: "Monitor",
    description: "Track adoption, SLAs, and identify optimization opportunities",
    sequence: 6,
    defaultDurationDays: 30,
    requiresApproval: false,
  },
];

const systemsSeed: Array<Keyed<InsertSystem>> = [
  {
    key: "erpCore",
    name: "ERP Core",
    category: "ERP",
    type: "erp",
    description: "Enterprise resource planning backbone for finance, procurement, and production planning",
    canBeSource: true,
    canBeTarget: true,
    status: "connected",
    colorCode: "#2563eb",
  },
  {
    key: "mesControlTower",
    name: "MES Control Tower",
    category: "MES",
    type: "mes",
    description: "Manufacturing execution system orchestrating shop-floor scheduling and execution",
    canBeSource: true,
    canBeTarget: true,
    status: "connected",
    colorCode: "#7c3aed",
  },
  {
    key: "plmStudio",
    name: "PLM Studio",
    category: "PLM",
    type: "plm",
    description: "Product lifecycle management for engineering change control and BOM governance",
    canBeSource: true,
    canBeTarget: true,
    status: "connected",
    colorCode: "#db2777",
  },
  {
    key: "qualityLabSuite",
    name: "Quality Lab Suite",
    category: "QMS",
    type: "qms",
    description: "Quality management suite for lab testing and compliance tracking",
    canBeSource: true,
    canBeTarget: true,
    status: "connected",
    colorCode: "#ea580c",
  },
  {
    key: "assetReliability",
    name: "Asset Reliability Platform",
    category: "EAM",
    type: "eam",
    description: "Enterprise asset management for maintenance strategy, scheduling, and execution",
    canBeSource: true,
    canBeTarget: true,
    status: "connected",
    colorCode: "#0f172a",
  },
  {
    key: "supplyNetwork",
    name: "Supply Network Portal",
    category: "SCM",
    type: "scm",
    description: "Supplier collaboration and inbound logistics orchestration",
    canBeSource: true,
    canBeTarget: true,
    status: "connected",
    colorCode: "#15803d",
  },
  {
    key: "manufacturingLakehouse",
    name: "Manufacturing Lakehouse",
    category: "Analytics",
    type: "lakehouse",
    description: "Centralized analytics-ready storage for manufacturing and IoT data",
    canBeSource: true,
    canBeTarget: true,
    status: "connected",
    colorCode: "#0ea5e9",
  },
  {
    key: "analyticsWorkbench",
    name: "Analytics Workbench",
    category: "Analytics",
    type: "bi",
    description: "Business intelligence workspace for curated data products",
    canBeSource: true,
    canBeTarget: true,
    status: "connected",
    colorCode: "#f97316",
  },
  {
    key: "industrialIotHub",
    name: "Industrial IoT Hub",
    category: "IoT",
    type: "iot",
    description: "Edge-to-cloud hub capturing high-frequency shop-floor telemetry",
    canBeSource: true,
    canBeTarget: true,
    status: "connected",
    colorCode: "#22c55e",
  },
];

const dataDomainsSeed: Array<Keyed<InsertDataDomain>> = [
  {
    key: "manufacturingOperations",
    name: "Manufacturing Operations",
    description: "Production planning, shop-floor execution, and performance tracking",
    colorCode: "#1d4ed8",
  },
  {
    key: "supplyChain",
    name: "Supply Chain",
    description: "Supplier collaboration, materials management, and logistics",
    colorCode: "#15803d",
  },
  {
    key: "quality",
    name: "Quality",
    description: "Quality planning, inspections, and compliance activities",
    colorCode: "#ea580c",
  },
  {
    key: "productLifecycle",
    name: "Product Lifecycle",
    description: "Product definition, change management, and release governance",
    colorCode: "#9333ea",
  },
  {
    key: "assetManagement",
    name: "Asset Management",
    description: "Asset strategy, maintenance planning, and reliability",
    colorCode: "#0f172a",
  },
  {
    key: "analyticsInsights",
    name: "Analytics & Insights",
    description: "Curated analytics products, KPIs, and scorecards",
    colorCode: "#0ea5e9",
  },
];

const dataAreasSeed: Array<
  Keyed<Omit<InsertDataArea, "domainId">> & {
    domainKey: string;
  }
> = [
  {
    key: "productionPlanning",
    domainKey: "manufacturingOperations",
    name: "Production Planning",
    description: "Sales & operations planning, MPS, and capacity balancing",
    colorCode: "#3b82f6",
  },
  {
    key: "shopFloorControl",
    domainKey: "manufacturingOperations",
    name: "Shop Floor Control",
    description: "Dispatching, work center sequencing, and execution",
    colorCode: "#1e40af",
  },
  {
    key: "materialsManagement",
    domainKey: "supplyChain",
    name: "Materials Management",
    description: "Inventory, replenishment, and lot/batch tracking",
    colorCode: "#166534",
  },
  {
    key: "logisticsExecution",
    domainKey: "supplyChain",
    name: "Logistics Execution",
    description: "Warehouse, shipping, and transportation coordination",
    colorCode: "#14532d",
  },
  {
    key: "qualityControl",
    domainKey: "quality",
    name: "Quality Control",
    description: "In-process and lab inspections, SPC, and test management",
    colorCode: "#c2410c",
  },
  {
    key: "complianceGovernance",
    domainKey: "quality",
    name: "Compliance Governance",
    description: "Regulatory records, certifications, and deviation management",
    colorCode: "#b45309",
  },
  {
    key: "productDefinition",
    domainKey: "productLifecycle",
    name: "Product Definition",
    description: "Product master, BOM, and routing governance",
    colorCode: "#a855f7",
  },
  {
    key: "changeManagement",
    domainKey: "productLifecycle",
    name: "Change Management",
    description: "Engineering change control and release workflow",
    colorCode: "#7c3aed",
  },
  {
    key: "maintenanceExecution",
    domainKey: "assetManagement",
    name: "Maintenance Execution",
    description: "Preventive, predictive, and corrective maintenance",
    colorCode: "#111827",
  },
  {
    key: "operationalAnalytics",
    domainKey: "analyticsInsights",
    name: "Operational Analytics",
    description: "Curated metrics for plant and supply network performance",
    colorCode: "#0891b2",
  },
  {
    key: "performanceManagement",
    domainKey: "analyticsInsights",
    name: "Performance Management",
    description: "Dashboards, KPIs, and continuous improvement scorecards",
    colorCode: "#0284c7",
  },
];

const dataModelsSeed: Array<
  Keyed<
    Omit<InsertDataModel, "domainId" | "dataAreaId" | "targetSystemId" | "parentModelId">
  > & {
    domainKey?: string;
    areaKey?: string;
    targetSystemKey?: string;
    parentKey?: string;
  }
> = [
  {
    key: "manufacturingCanonical",
    name: "Manufacturing Canonical Model",
    layer: "conceptual",
    domainKey: "manufacturingOperations",
    areaKey: "productionPlanning",
    targetSystemKey: "manufacturingLakehouse",
  },
  {
    key: "shopFloorExecution",
    name: "Shop Floor Execution Model",
    layer: "logical",
    domainKey: "manufacturingOperations",
    areaKey: "shopFloorControl",
    targetSystemKey: "mesControlTower",
    parentKey: "manufacturingCanonical",
  },
  {
    key: "materialsLogistics",
    name: "Materials & Logistics Model",
    layer: "logical",
    domainKey: "supplyChain",
    areaKey: "materialsManagement",
    targetSystemKey: "erpCore",
    parentKey: "manufacturingCanonical",
  },
  {
    key: "qualityIntelligence",
    name: "Quality Intelligence Model",
    layer: "conceptual",
    domainKey: "quality",
    areaKey: "qualityControl",
    targetSystemKey: "qualityLabSuite",
  },
  {
    key: "assetReliabilityModel",
    name: "Asset Reliability Model",
    layer: "conceptual",
    domainKey: "assetManagement",
    areaKey: "maintenanceExecution",
    targetSystemKey: "assetReliability",
  },
  {
    key: "manufacturingAnalyticsWarehouse",
    name: "Manufacturing Analytics Warehouse",
    layer: "physical",
    domainKey: "analyticsInsights",
    areaKey: "operationalAnalytics",
    targetSystemKey: "analyticsWorkbench",
    parentKey: "manufacturingCanonical",
  },
  {
    key: "productLifecycleModel",
    name: "Product Lifecycle Collaboration Model",
    layer: "conceptual",
    domainKey: "productLifecycle",
    areaKey: "productDefinition",
    targetSystemKey: "plmStudio",
  },
];

const dataObjectsSeed: Array<
  Keyed<
    Omit<InsertDataObject, "modelId" | "domainId" | "dataAreaId" | "sourceSystemId" | "targetSystemId">
  > & {
    modelKey: string;
    domainKey?: string;
    areaKey?: string;
    sourceSystemKey?: string;
    targetSystemKey?: string;
  }
> = [
  {
    key: "productionPlan",
    name: "Production Plan",
    modelKey: "manufacturingCanonical",
    domainKey: "manufacturingOperations",
    areaKey: "productionPlanning",
    sourceSystemKey: "erpCore",
    targetSystemKey: "manufacturingLakehouse",
    description: "Aggregated production plans by plant, product, and horizon",
    objectType: "entity",
    position: { x: 120, y: 80 },
  },
  {
    key: "materialRequirement",
    name: "Material Requirement",
    modelKey: "manufacturingCanonical",
    domainKey: "manufacturingOperations",
    areaKey: "materialsManagement",
    sourceSystemKey: "erpCore",
    targetSystemKey: "manufacturingLakehouse",
    description: "Material demand and coverage snapshots",
    objectType: "entity",
    position: { x: 360, y: 80 },
  },
  {
    key: "workOrder",
    name: "Work Order",
    modelKey: "shopFloorExecution",
    domainKey: "manufacturingOperations",
    areaKey: "shopFloorControl",
    sourceSystemKey: "mesControlTower",
    targetSystemKey: "manufacturingLakehouse",
    description: "Detailed work order instructions and status",
    objectType: "entity",
    position: { x: 160, y: 240 },
  },
  {
    key: "workCenter",
    name: "Work Center",
    modelKey: "shopFloorExecution",
    domainKey: "manufacturingOperations",
    areaKey: "shopFloorControl",
    sourceSystemKey: "mesControlTower",
    targetSystemKey: "manufacturingLakehouse",
    description: "Work center master with capacity and constraint data",
    objectType: "reference",
    position: { x: 420, y: 240 },
  },
  {
    key: "qualityInspection",
    name: "Quality Inspection",
    modelKey: "qualityIntelligence",
    domainKey: "quality",
    areaKey: "qualityControl",
    sourceSystemKey: "qualityLabSuite",
    targetSystemKey: "manufacturingLakehouse",
    description: "Inspection results with characteristic measurements",
    objectType: "fact",
    position: { x: 140, y: 420 },
  },
  {
    key: "nonConformance",
    name: "Non Conformance",
    modelKey: "qualityIntelligence",
    domainKey: "quality",
    areaKey: "complianceGovernance",
    sourceSystemKey: "qualityLabSuite",
    targetSystemKey: "manufacturingLakehouse",
    description: "Deviation records and corrective actions",
    objectType: "event",
    position: { x: 360, y: 420 },
  },
  {
    key: "supplierCommitment",
    name: "Supplier Commitment",
    modelKey: "materialsLogistics",
    domainKey: "supplyChain",
    areaKey: "materialsManagement",
    sourceSystemKey: "supplyNetwork",
    targetSystemKey: "manufacturingLakehouse",
    description: "Supplier confirmations for material deliveries",
    objectType: "fact",
    position: { x: 600, y: 200 },
  },
  {
    key: "shipment",
    name: "Shipment",
    modelKey: "materialsLogistics",
    domainKey: "supplyChain",
    areaKey: "logisticsExecution",
    sourceSystemKey: "supplyNetwork",
    targetSystemKey: "manufacturingLakehouse",
    description: "Outbound shipment and transportation events",
    objectType: "event",
    position: { x: 820, y: 200 },
  },
  {
    key: "asset",
    name: "Asset",
    modelKey: "assetReliabilityModel",
    domainKey: "assetManagement",
    areaKey: "maintenanceExecution",
    sourceSystemKey: "assetReliability",
    targetSystemKey: "manufacturingLakehouse",
    description: "Equipment registry with reliability classifications",
    objectType: "reference",
    position: { x: 120, y: 600 },
  },
  {
    key: "maintenanceOrder",
    name: "Maintenance Order",
    modelKey: "assetReliabilityModel",
    domainKey: "assetManagement",
    areaKey: "maintenanceExecution",
    sourceSystemKey: "assetReliability",
    targetSystemKey: "manufacturingLakehouse",
    description: "Maintenance work orders with task and labor details",
    objectType: "event",
    position: { x: 340, y: 600 },
  },
  {
    key: "productionFact",
    name: "Production Fact",
    modelKey: "manufacturingAnalyticsWarehouse",
    domainKey: "analyticsInsights",
    areaKey: "operationalAnalytics",
    sourceSystemKey: "manufacturingLakehouse",
    targetSystemKey: "analyticsWorkbench",
    description: "Aggregated production performance metrics",
    objectType: "fact",
    position: { x: 580, y: 420 },
  },
  {
    key: "workCenterDimension",
    name: "Work Center Dimension",
    modelKey: "manufacturingAnalyticsWarehouse",
    domainKey: "analyticsInsights",
    areaKey: "operationalAnalytics",
    sourceSystemKey: "manufacturingLakehouse",
    targetSystemKey: "analyticsWorkbench",
    description: "Dimensional attributes for work center analysis",
    objectType: "dimension",
    position: { x: 760, y: 420 },
  },
];

const attributesSeed: Array<
  Keyed<Omit<InsertAttribute, "objectId">> & {
    objectKey: string;
  }
> = [
  {
    key: "productionPlanId",
    name: "plan_id",
    objectKey: "productionPlan",
    conceptualType: "Identifier",
    logicalType: "UUID",
    physicalType: "UUID",
    nullable: false,
    isPrimaryKey: true,
    description: "Unique identifier for the production plan",
  },
  {
    key: "productionPlanHorizon",
    name: "planning_horizon",
    objectKey: "productionPlan",
    conceptualType: "Period",
    logicalType: "DATE_RANGE",
    physicalType: "tstzrange",
    nullable: false,
    description: "Start and end dates for the planning cycle",
  },
  {
    key: "workOrderId",
    name: "work_order_id",
    objectKey: "workOrder",
    conceptualType: "Identifier",
    logicalType: "VARCHAR",
    physicalType: "VARCHAR(40)",
    nullable: false,
    isPrimaryKey: true,
    description: "Unique identifier for the work order",
  },
  {
    key: "workOrderStatus",
    name: "status",
    objectKey: "workOrder",
    conceptualType: "Status",
    logicalType: "VARCHAR",
    physicalType: "VARCHAR(20)",
    nullable: false,
    description: "Execution status of the work order",
  },
  {
    key: "qualityInspectionId",
    name: "inspection_id",
    objectKey: "qualityInspection",
    conceptualType: "Identifier",
    logicalType: "UUID",
    physicalType: "UUID",
    nullable: false,
    isPrimaryKey: true,
    description: "Unique identifier for the inspection record",
  },
  {
    key: "qualityInspectionResult",
    name: "result",
    objectKey: "qualityInspection",
    conceptualType: "Result",
    logicalType: "VARCHAR",
    physicalType: "VARCHAR(30)",
    nullable: false,
    description: "Pass/fail outcome of the inspection",
  },
  {
    key: "assetId",
    name: "asset_id",
    objectKey: "asset",
    conceptualType: "Identifier",
    logicalType: "UUID",
    physicalType: "UUID",
    nullable: false,
    isPrimaryKey: true,
    description: "Asset identifier",
  },
  {
    key: "assetCriticality",
    name: "criticality",
    objectKey: "asset",
    conceptualType: "Classification",
    logicalType: "VARCHAR",
    physicalType: "VARCHAR(10)",
    nullable: false,
    description: "Criticality tier for the asset",
  },
  {
    key: "productionFactQty",
    name: "produced_qty",
    objectKey: "productionFact",
    conceptualType: "Measure",
    logicalType: "NUMERIC",
    physicalType: "NUMERIC(18,2)",
    nullable: false,
    description: "Produced quantity",
  },
  {
    key: "productionFactScrap",
    name: "scrap_qty",
    objectKey: "productionFact",
    conceptualType: "Measure",
    logicalType: "NUMERIC",
    physicalType: "NUMERIC(18,2)",
    nullable: true,
    description: "Scrap quantity associated with production",
  },
];

const capabilitiesSeed = [
  {
    key: "capManufacturing",
    name: "Manufacturing Value Chain",
    code: "MANF-VC",
    level: 1,
    description: "End-to-end manufacturing business capability map",
    sortOrder: 1,
    colorCode: "#1e3a8a",
    maturityLevel: "defined",
    criticality: "critical",
  },
  {
    key: "capPlanProduction",
    name: "Plan Production",
    code: "MANF-PLAN",
    level: 2,
    parentKey: "capManufacturing",
    description: "Sales & operations planning, master scheduling, and capacity balancing",
    sortOrder: 10,
    colorCode: "#2563eb",
    maturityLevel: "managed",
    criticality: "high",
  },
  {
    key: "capExecuteManufacturing",
    name: "Execute Manufacturing",
    code: "MANF-EXEC",
    level: 2,
    parentKey: "capManufacturing",
    description: "Shop-floor control, production execution, and reporting",
    sortOrder: 20,
    colorCode: "#1d4ed8",
    maturityLevel: "developing",
    criticality: "high",
  },
  {
    key: "capAssureQuality",
    name: "Assure Quality",
    code: "MANF-QUAL",
    level: 2,
    parentKey: "capManufacturing",
    description: "Quality planning, inspections, and compliance management",
    sortOrder: 30,
    colorCode: "#c2410c",
    maturityLevel: "defined",
    criticality: "high",
  },
  {
    key: "capMaintainAssets",
    name: "Maintain Assets",
    code: "MANF-ASSET",
    level: 2,
    parentKey: "capManufacturing",
    description: "Asset strategy, maintenance execution, and reliability engineering",
    sortOrder: 40,
    colorCode: "#0f172a",
    maturityLevel: "developing",
    criticality: "medium",
  },
  {
    key: "capAnalyzePerformance",
    name: "Analyze Performance",
    code: "MANF-ANALYZE",
    level: 2,
    parentKey: "capManufacturing",
    description: "Manufacturing analytics, KPI management, and continuous improvement",
    sortOrder: 50,
    colorCode: "#0ea5e9",
    maturityLevel: "basic",
    criticality: "medium",
  },
  {
    key: "capDemandSupply",
    name: "Demand & Supply Planning",
    code: "MANF-PLAN-01",
    level: 3,
    parentKey: "capPlanProduction",
    description: "Integrated demand, supply, and inventory planning",
    sortOrder: 11,
    colorCode: "#3b82f6",
    maturityLevel: "defined",
    criticality: "high",
  },
  {
    key: "capMasterScheduling",
    name: "Master Production Scheduling",
    code: "MANF-PLAN-02",
    level: 3,
    parentKey: "capPlanProduction",
    description: "Translate plans into feasible production schedules",
    sortOrder: 12,
    colorCode: "#1d4ed8",
    maturityLevel: "managed",
    criticality: "high",
  },
  {
    key: "capShopFloorControl",
    name: "Shop Floor Control",
    code: "MANF-EXEC-01",
    level: 3,
    parentKey: "capExecuteManufacturing",
    description: "Dispatch, monitor, and adjust shop-floor execution",
    sortOrder: 21,
    colorCode: "#1e40af",
    maturityLevel: "developing",
    criticality: "high",
  },
  {
    key: "capProductionReporting",
    name: "Production Reporting",
    code: "MANF-EXEC-02",
    level: 3,
    parentKey: "capExecuteManufacturing",
    description: "Capture production performance, variances, and losses",
    sortOrder: 22,
    colorCode: "#1d4ed8",
    maturityLevel: "developing",
    criticality: "medium",
  },
  {
    key: "capQualityControl",
    name: "Quality Control",
    code: "MANF-QUAL-01",
    level: 3,
    parentKey: "capAssureQuality",
    description: "Inspect materials and finished goods to ensure specifications",
    sortOrder: 31,
    colorCode: "#ea580c",
    maturityLevel: "defined",
    criticality: "high",
  },
  {
    key: "capComplianceManagement",
    name: "Compliance Management",
    code: "MANF-QUAL-02",
    level: 3,
    parentKey: "capAssureQuality",
    description: "Govern deviations, CAPAs, and regulatory documentation",
    sortOrder: 32,
    colorCode: "#b45309",
    maturityLevel: "defined",
    criticality: "high",
  },
  {
    key: "capMaintenanceExecution",
    name: "Maintenance Execution",
    code: "MANF-ASSET-01",
    level: 3,
    parentKey: "capMaintainAssets",
    description: "Plan and execute corrective and preventive maintenance",
    sortOrder: 41,
    colorCode: "#0f172a",
    maturityLevel: "developing",
    criticality: "medium",
  },
  {
    key: "capAssetStrategy",
    name: "Asset Strategy",
    code: "MANF-ASSET-02",
    level: 3,
    parentKey: "capMaintainAssets",
    description: "Optimize maintenance strategies and reliability",
    sortOrder: 42,
    colorCode: "#1f2937",
    maturityLevel: "basic",
    criticality: "medium",
  },
  {
    key: "capOperationalAnalytics",
    name: "Operational Analytics",
    code: "MANF-ANALYZE-01",
    level: 3,
    parentKey: "capAnalyzePerformance",
    description: "Deliver KPIs and insights for manufacturing performance",
    sortOrder: 51,
    colorCode: "#0ea5e9",
    maturityLevel: "basic",
    criticality: "medium",
  },
  {
    key: "capSupplierCollaboration",
    name: "Supplier Collaboration",
    code: "MANF-SUP-01",
    level: 3,
    parentKey: "capPlanProduction",
    description: "Engage suppliers to secure material availability",
    sortOrder: 13,
    colorCode: "#15803d",
    maturityLevel: "developing",
    criticality: "high",
  },
];

const capabilityDomainMappingsSeed: Array<
  Omit<InsertCapabilityDataDomainMapping, "capabilityId" | "domainId"> & {
    capabilityKey: string;
    domainKey: string;
  }
> = [
  { capabilityKey: "capPlanProduction", domainKey: "manufacturingOperations", mappingType: "primary" },
  { capabilityKey: "capDemandSupply", domainKey: "manufacturingOperations", mappingType: "primary" },
  { capabilityKey: "capMasterScheduling", domainKey: "manufacturingOperations", mappingType: "primary" },
  { capabilityKey: "capExecuteManufacturing", domainKey: "manufacturingOperations", mappingType: "primary" },
  { capabilityKey: "capShopFloorControl", domainKey: "manufacturingOperations", mappingType: "primary" },
  { capabilityKey: "capProductionReporting", domainKey: "analyticsInsights", mappingType: "supporting" },
  { capabilityKey: "capAssureQuality", domainKey: "quality", mappingType: "primary" },
  { capabilityKey: "capQualityControl", domainKey: "quality", mappingType: "primary" },
  { capabilityKey: "capComplianceManagement", domainKey: "quality", mappingType: "primary" },
  { capabilityKey: "capMaintainAssets", domainKey: "assetManagement", mappingType: "primary" },
  { capabilityKey: "capMaintenanceExecution", domainKey: "assetManagement", mappingType: "primary" },
  { capabilityKey: "capAnalyzePerformance", domainKey: "analyticsInsights", mappingType: "primary" },
  { capabilityKey: "capOperationalAnalytics", domainKey: "analyticsInsights", mappingType: "primary" },
  { capabilityKey: "capSupplierCollaboration", domainKey: "supplyChain", mappingType: "primary" },
];

const capabilityAreaMappingsSeed: Array<
  Omit<InsertCapabilityDataAreaMapping, "capabilityId" | "dataAreaId"> & {
    capabilityKey: string;
    areaKey: string;
  }
> = [
  { capabilityKey: "capPlanProduction", areaKey: "productionPlanning", mappingType: "primary" },
  { capabilityKey: "capDemandSupply", areaKey: "productionPlanning", mappingType: "primary" },
  { capabilityKey: "capMasterScheduling", areaKey: "productionPlanning", mappingType: "primary" },
  { capabilityKey: "capExecuteManufacturing", areaKey: "shopFloorControl", mappingType: "primary" },
  { capabilityKey: "capShopFloorControl", areaKey: "shopFloorControl", mappingType: "primary" },
  { capabilityKey: "capProductionReporting", areaKey: "operationalAnalytics", mappingType: "primary" },
  { capabilityKey: "capAssureQuality", areaKey: "qualityControl", mappingType: "primary" },
  { capabilityKey: "capQualityControl", areaKey: "qualityControl", mappingType: "primary" },
  { capabilityKey: "capComplianceManagement", areaKey: "complianceGovernance", mappingType: "primary" },
  { capabilityKey: "capMaintainAssets", areaKey: "maintenanceExecution", mappingType: "primary" },
  { capabilityKey: "capMaintenanceExecution", areaKey: "maintenanceExecution", mappingType: "primary" },
  { capabilityKey: "capOperationalAnalytics", areaKey: "operationalAnalytics", mappingType: "primary" },
  { capabilityKey: "capSupplierCollaboration", areaKey: "materialsManagement", mappingType: "primary" },
];

const capabilitySystemMappingsSeed: Array<
  Omit<InsertCapabilitySystemMapping, "capabilityId" | "systemId"> & {
    capabilityKey: string;
    systemKey: string;
  }
> = [
  { capabilityKey: "capPlanProduction", systemKey: "erpCore", mappingType: "enables", systemRole: "primary", coverage: "full" },
  { capabilityKey: "capDemandSupply", systemKey: "erpCore", mappingType: "enables", systemRole: "primary", coverage: "full" },
  { capabilityKey: "capMasterScheduling", systemKey: "erpCore", mappingType: "enables", systemRole: "primary", coverage: "full" },
  { capabilityKey: "capExecuteManufacturing", systemKey: "mesControlTower", mappingType: "automates", systemRole: "primary", coverage: "full" },
  { capabilityKey: "capShopFloorControl", systemKey: "mesControlTower", mappingType: "automates", systemRole: "primary", coverage: "full" },
  { capabilityKey: "capProductionReporting", systemKey: "manufacturingLakehouse", mappingType: "supports", systemRole: "secondary", coverage: "partial" },
  { capabilityKey: "capAssureQuality", systemKey: "qualityLabSuite", mappingType: "enables", systemRole: "primary", coverage: "full" },
  { capabilityKey: "capQualityControl", systemKey: "qualityLabSuite", mappingType: "enables", systemRole: "primary", coverage: "full" },
  { capabilityKey: "capComplianceManagement", systemKey: "qualityLabSuite", mappingType: "supports", systemRole: "primary", coverage: "partial" },
  { capabilityKey: "capMaintainAssets", systemKey: "assetReliability", mappingType: "automates", systemRole: "primary", coverage: "partial" },
  { capabilityKey: "capMaintenanceExecution", systemKey: "assetReliability", mappingType: "automates", systemRole: "primary", coverage: "partial" },
  { capabilityKey: "capOperationalAnalytics", systemKey: "analyticsWorkbench", mappingType: "supports", systemRole: "primary", coverage: "full" },
  { capabilityKey: "capSupplierCollaboration", systemKey: "supplyNetwork", mappingType: "enables", systemRole: "primary", coverage: "partial" },
];

const dataModelSystemMappingsSeed: Array<
  Omit<InsertDataModelSystemMapping, "modelId" | "systemId"> & {
    modelKey: string;
    systemKey: string;
  }
> = [
  { modelKey: "manufacturingCanonical", systemKey: "manufacturingLakehouse", relationshipType: "integration", systemRole: "consumer", lifecycleState: "design" },
  { modelKey: "shopFloorExecution", systemKey: "mesControlTower", relationshipType: "integration", systemRole: "primary", lifecycleState: "build" },
  { modelKey: "shopFloorExecution", systemKey: "industrialIotHub", relationshipType: "telemetry", systemRole: "supporting", lifecycleState: "build" },
  { modelKey: "materialsLogistics", systemKey: "erpCore", relationshipType: "integration", systemRole: "primary", lifecycleState: "design" },
  { modelKey: "qualityIntelligence", systemKey: "qualityLabSuite", relationshipType: "integration", systemRole: "primary", lifecycleState: "design" },
  { modelKey: "assetReliabilityModel", systemKey: "assetReliability", relationshipType: "integration", systemRole: "primary", lifecycleState: "design" },
  { modelKey: "manufacturingAnalyticsWarehouse", systemKey: "analyticsWorkbench", relationshipType: "delivery", systemRole: "primary", lifecycleState: "validate" },
  { modelKey: "manufacturingAnalyticsWarehouse", systemKey: "manufacturingLakehouse", relationshipType: "source", systemRole: "supporting", lifecycleState: "build" },
  { modelKey: "productLifecycleModel", systemKey: "plmStudio", relationshipType: "integration", systemRole: "primary", lifecycleState: "design" },
];

const capabilityDataModelMappingsSeed: CapabilityDataModelGovernance[] = [
  {
    capabilityKey: "capPlanProduction",
    modelKey: "manufacturingCanonical",
    domainKey: "manufacturingOperations",
    lifecyclePhaseKey: "design",
    lifecycleStatus: "active",
    alignmentRating: "high",
    businessValueScore: 5,
    readinessScore: 4,
    riskLevel: "medium",
    governanceOwner: "Director of Manufacturing Planning",
    dataSteward: "Planning Excellence Lead",
    solutionArchitect: "Enterprise Data Architect",
    dataCustodian: "Manufacturing Data Ops",
    qaOwner: "Planning Quality Lead",
    reviewCadence: "Quarterly",
    authoritativeSource: true,
    notes: "Canonical planning model driving S&OP alignment",
    metadata: { roadmapPriority: "Q3 FY24", operatingRegions: ["NA", "EU"] },
  },
  {
    capabilityKey: "capDemandSupply",
    modelKey: "manufacturingCanonical",
    domainKey: "manufacturingOperations",
    lifecyclePhaseKey: "design",
    lifecycleStatus: "active",
    alignmentRating: "high",
    businessValueScore: 5,
    readinessScore: 4,
    riskLevel: "low",
    governanceOwner: "Director of Integrated Planning",
    dataSteward: "Demand Planning Lead",
    solutionArchitect: "Data Solution Architect",
    dataCustodian: "Manufacturing Data Ops",
    qaOwner: "Demand Excellence",
    reviewCadence: "Monthly",
    authoritativeSource: true,
    notes: "Feeds supply-demand balancing analytics",
    metadata: { roadmapPriority: "Q2 FY24", metrics: ["Forecast Accuracy"] },
  },
  {
    capabilityKey: "capMasterScheduling",
    modelKey: "manufacturingCanonical",
    domainKey: "manufacturingOperations",
    lifecyclePhaseKey: "design",
    lifecycleStatus: "active",
    alignmentRating: "medium",
    businessValueScore: 4,
    readinessScore: 3,
    riskLevel: "medium",
    governanceOwner: "Master Scheduler Lead",
    dataSteward: "Production Planning Analyst",
    solutionArchitect: "Manufacturing Architect",
    dataCustodian: "Manufacturing Data Ops",
    qaOwner: "Scheduling Quality",
    reviewCadence: "Monthly",
    authoritativeSource: false,
    notes: "Requires integration with constraint-based scheduling",
    metadata: { roadmapPriority: "Q4 FY24" },
  },
  {
    capabilityKey: "capShopFloorControl",
    modelKey: "shopFloorExecution",
    domainKey: "manufacturingOperations",
    lifecyclePhaseKey: "build",
    lifecycleStatus: "in_progress",
    alignmentRating: "high",
    businessValueScore: 5,
    readinessScore: 3,
    riskLevel: "high",
    governanceOwner: "VP Manufacturing",
    dataSteward: "MES Data Steward",
    solutionArchitect: "Shop-Floor Architect",
    dataCustodian: "MES Platform Team",
    qaOwner: "Manufacturing QA",
    reviewCadence: "Bi-Weekly",
    authoritativeSource: false,
    notes: "Shop floor telemetry integration underway",
    metadata: { roadmapPriority: "Q1 FY25" },
  },
  {
    capabilityKey: "capProductionReporting",
    modelKey: "manufacturingAnalyticsWarehouse",
    domainKey: "analyticsInsights",
    lifecyclePhaseKey: "validate",
    lifecycleStatus: "in_validation",
    alignmentRating: "high",
    businessValueScore: 4,
    readinessScore: 4,
    riskLevel: "low",
    governanceOwner: "Director Manufacturing Analytics",
    dataSteward: "Analytics Product Owner",
    solutionArchitect: "Analytics Architect",
    dataCustodian: "Analytics Engineering",
    qaOwner: "Analytics QA",
    reviewCadence: "Monthly",
    authoritativeSource: true,
    notes: "Supports manufacturing performance dashboards",
    metadata: { roadmapPriority: "Q1 FY24", primaryKPIs: ["OEE", "Throughput"] },
  },
  {
    capabilityKey: "capQualityControl",
    modelKey: "qualityIntelligence",
    domainKey: "quality",
    lifecyclePhaseKey: "build",
    lifecycleStatus: "active",
    alignmentRating: "high",
    businessValueScore: 5,
    readinessScore: 4,
    riskLevel: "medium",
    governanceOwner: "Head of Quality",
    dataSteward: "Quality Data Steward",
    solutionArchitect: "Quality Systems Architect",
    dataCustodian: "Quality Informatics",
    qaOwner: "Quality QA",
    reviewCadence: "Monthly",
    authoritativeSource: true,
    notes: "Foundation for SPC and lab analytics",
    metadata: { roadmapPriority: "Q2 FY24" },
  },
  {
    capabilityKey: "capComplianceManagement",
    modelKey: "qualityIntelligence",
    domainKey: "quality",
    lifecyclePhaseKey: "validate",
    lifecycleStatus: "planned",
    alignmentRating: "medium",
    businessValueScore: 4,
    readinessScore: 2,
    riskLevel: "high",
    governanceOwner: "Compliance Director",
    dataSteward: "Compliance Data Steward",
    solutionArchitect: "Quality Systems Architect",
    dataCustodian: "Quality Informatics",
    qaOwner: "Compliance QA",
    reviewCadence: "Quarterly",
    authoritativeSource: false,
    notes: "Requires governance for regulatory reporting",
    metadata: { roadmapPriority: "Q3 FY25" },
  },
  {
    capabilityKey: "capMaintenanceExecution",
    modelKey: "assetReliabilityModel",
    domainKey: "assetManagement",
    lifecyclePhaseKey: "design",
    lifecycleStatus: "active",
    alignmentRating: "medium",
    businessValueScore: 4,
    readinessScore: 3,
    riskLevel: "medium",
    governanceOwner: "Maintenance Director",
    dataSteward: "Asset Data Steward",
    solutionArchitect: "Asset Architect",
    dataCustodian: "Asset Reliability Platform",
    qaOwner: "Maintenance QA",
    reviewCadence: "Bi-Monthly",
    authoritativeSource: false,
    notes: "Focus on predictive maintenance expansion",
    metadata: { roadmapPriority: "Q2 FY25" },
  },
  {
    capabilityKey: "capOperationalAnalytics",
    modelKey: "manufacturingAnalyticsWarehouse",
    domainKey: "analyticsInsights",
    lifecyclePhaseKey: "monitor",
    lifecycleStatus: "active",
    alignmentRating: "high",
    businessValueScore: 5,
    readinessScore: 5,
    riskLevel: "low",
    governanceOwner: "Director Manufacturing Analytics",
    dataSteward: "Analytics Product Owner",
    solutionArchitect: "Analytics Architect",
    dataCustodian: "Analytics Engineering",
    qaOwner: "Analytics QA",
    reviewCadence: "Monthly",
    authoritativeSource: true,
    notes: "Drives KPI scorecards for the enterprise",
    metadata: { roadmapPriority: "In Flight" },
  },
  {
    capabilityKey: "capSupplierCollaboration",
    modelKey: "materialsLogistics",
    domainKey: "supplyChain",
    lifecyclePhaseKey: "build",
    lifecycleStatus: "in_progress",
    alignmentRating: "medium",
    businessValueScore: 4,
    readinessScore: 3,
    riskLevel: "medium",
    governanceOwner: "Supply Network Lead",
    dataSteward: "Supplier Collaboration Steward",
    solutionArchitect: "Supply Chain Architect",
    dataCustodian: "Supply Network Platform",
    qaOwner: "Supply Chain QA",
    reviewCadence: "Quarterly",
    authoritativeSource: false,
    notes: "Extends supplier visibility and ASN integration",
    metadata: { roadmapPriority: "Q4 FY24" },
  },
];

const capabilityModelSystemMappingsSeed: CapabilityModelSystemTrace[] = [
  {
    capabilityKey: "capPlanProduction",
    modelKey: "manufacturingCanonical",
    systemKey: "erpCore",
    relationshipType: "integration",
    systemRole: "primary",
    lifecycleStatus: "active",
    deploymentStatus: "production",
    heatmapScore: 4,
    riskScore: 2,
    slaHours: 4,
    isPrimary: true,
  },
  {
    capabilityKey: "capPlanProduction",
    modelKey: "manufacturingCanonical",
    systemKey: "manufacturingLakehouse",
    relationshipType: "delivery",
    systemRole: "consumer",
    lifecycleStatus: "active",
    deploymentStatus: "production",
    heatmapScore: 3,
    riskScore: 2,
    slaHours: 8,
    isPrimary: false,
  },
  {
    capabilityKey: "capShopFloorControl",
    modelKey: "shopFloorExecution",
    systemKey: "mesControlTower",
    relationshipType: "integration",
    systemRole: "primary",
    lifecycleStatus: "in_progress",
    deploymentStatus: "pilot",
    heatmapScore: 5,
    riskScore: 4,
    slaHours: 1,
    isPrimary: true,
  },
  {
    capabilityKey: "capShopFloorControl",
    modelKey: "shopFloorExecution",
    systemKey: "industrialIotHub",
    relationshipType: "telemetry",
    systemRole: "supporting",
    lifecycleStatus: "in_progress",
    deploymentStatus: "pilot",
    heatmapScore: 4,
    riskScore: 3,
    slaHours: 1,
    isPrimary: false,
  },
  {
    capabilityKey: "capQualityControl",
    modelKey: "qualityIntelligence",
    systemKey: "qualityLabSuite",
    relationshipType: "integration",
    systemRole: "primary",
    lifecycleStatus: "active",
    deploymentStatus: "production",
    heatmapScore: 4,
    riskScore: 2,
    slaHours: 6,
    isPrimary: true,
  },
  {
    capabilityKey: "capOperationalAnalytics",
    modelKey: "manufacturingAnalyticsWarehouse",
    systemKey: "analyticsWorkbench",
    relationshipType: "delivery",
    systemRole: "primary",
    lifecycleStatus: "active",
    deploymentStatus: "production",
    heatmapScore: 4,
    riskScore: 1,
    slaHours: 24,
    isPrimary: true,
  },
  {
    capabilityKey: "capSupplierCollaboration",
    modelKey: "materialsLogistics",
    systemKey: "supplyNetwork",
    relationshipType: "integration",
    systemRole: "primary",
    lifecycleStatus: "in_progress",
    deploymentStatus: "pilot",
    heatmapScore: 3,
    riskScore: 3,
    slaHours: 12,
    isPrimary: true,
  },
];

const modelLifecycleAssignmentsSeed: LifecycleAssignmentSeed[] = [
  {
    modelKey: "manufacturingCanonical",
    phaseKey: "design",
    status: "completed",
    approvalStatus: "approved",
    completedAt: new Date("2024-01-15T00:00:00Z"),
    approvedBy: "Enterprise Data Council",
  },
  {
    modelKey: "manufacturingCanonical",
    phaseKey: "build",
    status: "in_progress",
    approvalStatus: "pending",
    startedAt: new Date("2024-02-01T00:00:00Z"),
  },
  {
    modelKey: "shopFloorExecution",
    phaseKey: "build",
    status: "in_progress",
    approvalStatus: "pending",
    startedAt: new Date("2024-03-05T00:00:00Z"),
  },
  {
    modelKey: "manufacturingAnalyticsWarehouse",
    phaseKey: "validate",
    status: "in_progress",
    approvalStatus: "pending",
    startedAt: new Date("2024-03-20T00:00:00Z"),
  },
  {
    modelKey: "qualityIntelligence",
    phaseKey: "build",
    status: "completed",
    approvalStatus: "approved",
    completedAt: new Date("2023-11-10T00:00:00Z"),
    approvedBy: "Quality Governance Board",
    nextReviewAt: new Date("2024-05-10T00:00:00Z"),
  },
  {
    modelKey: "assetReliabilityModel",
    phaseKey: "design",
    status: "completed",
    approvalStatus: "approved",
    completedAt: new Date("2024-02-28T00:00:00Z"),
    approvedBy: "Asset Steering Committee",
  },
  {
    modelKey: "materialsLogistics",
    phaseKey: "design",
    status: "in_progress",
    approvalStatus: "pending",
    startedAt: new Date("2024-04-02T00:00:00Z"),
  },
];

function assertKeyedLookup<T>(map: Map<string, T | undefined>, key: string, entity: string): T {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Unable to locate ${entity} with key "${key}" during seed import`);
  }
  return value;
}

export async function seedDatabase() {
  console.log("🌱 Starting database seeding...");

  try {
  await db.transaction(async (trx: typeof db) => {
      await trx.delete(configurations);
      await trx.delete(capabilityModelSystemMappings);
      await trx.delete(capabilityDataModelMappings);
      await trx.delete(capabilitySystemMappings);
      await trx.delete(capabilityDataAreaMappings);
      await trx.delete(capabilityDataDomainMappings);
      await trx.delete(modelLifecycleAssignments);
      await trx.delete(dataModelSystemMappings);
      await trx.delete(businessCapabilities);
      await trx.delete(modelLifecyclePhases);
      await trx.delete(attributes);
      await trx.delete(dataObjects);
      await trx.delete(dataModels);
      await trx.delete(dataAreas);
      await trx.delete(dataDomains);
      await trx.delete(systems);

      const insertedSystems = await trx
        .insert(systems)
        .values(systemsSeed.map(({ key: _key, ...values }) => values))
        .returning();
      const systemIdByKey = new Map<string, System["id"]>();
  insertedSystems.forEach((row: System, index: number) => {
        systemIdByKey.set(systemsSeed[index].key, row.id);
      });

      const insertedPhases = await trx.insert(modelLifecyclePhases).values(lifecyclePhasesSeed).returning();
      const phaseIdByKey = new Map<string, ModelLifecyclePhase["id"]>();
  insertedPhases.forEach((row: ModelLifecyclePhase, index: number) => {
        phaseIdByKey.set(lifecyclePhasesSeed[index].key, row.id);
      });

      const insertedDomains = await trx
        .insert(dataDomains)
        .values(dataDomainsSeed.map(({ key: _key, ...values }) => values))
        .returning();
      const domainIdByKey = new Map<string, DataDomain["id"]>();
  insertedDomains.forEach((row: DataDomain, index: number) => {
        domainIdByKey.set(dataDomainsSeed[index].key, row.id);
      });

      const insertedAreas = await trx
        .insert(dataAreas)
        .values(
          dataAreasSeed.map(({ key: _key, domainKey, ...values }) => ({
            ...values,
            domainId: assertKeyedLookup(domainIdByKey, domainKey, "data domain"),
          }))
        )
        .returning();
      const areaIdByKey = new Map<string, DataArea["id"]>();
  insertedAreas.forEach((row: DataArea, index: number) => {
        areaIdByKey.set(dataAreasSeed[index].key, row.id);
      });

      const modelIdByKey = new Map<string, DataModel["id"]>();
      for (const model of dataModelsSeed) {
        const { key, domainKey, areaKey, targetSystemKey, parentKey, ...values } = model;
        const [insertedModel] = await trx
          .insert(dataModels)
          .values({
            ...values,
            domainId: domainKey ? assertKeyedLookup(domainIdByKey, domainKey, "data domain") : null,
            dataAreaId: areaKey ? assertKeyedLookup(areaIdByKey, areaKey, "data area") : null,
            targetSystemId: targetSystemKey ? assertKeyedLookup(systemIdByKey, targetSystemKey, "system") : null,
            parentModelId: parentKey ? assertKeyedLookup(modelIdByKey, parentKey, "data model") : null,
          })
          .returning();
        modelIdByKey.set(key, insertedModel.id);
      }

      const insertedObjects = await trx
        .insert(dataObjects)
        .values(
          dataObjectsSeed.map(({ key: _key, modelKey, domainKey, areaKey, sourceSystemKey, targetSystemKey, ...values }) => ({
            ...values,
            modelId: assertKeyedLookup(modelIdByKey, modelKey, "data model"),
            domainId: domainKey ? assertKeyedLookup(domainIdByKey, domainKey, "data domain") : null,
            dataAreaId: areaKey ? assertKeyedLookup(areaIdByKey, areaKey, "data area") : null,
            sourceSystemId: sourceSystemKey ? assertKeyedLookup(systemIdByKey, sourceSystemKey, "system") : null,
            targetSystemId: targetSystemKey ? assertKeyedLookup(systemIdByKey, targetSystemKey, "system") : null,
          }))
        )
        .returning();
      const objectIdByKey = new Map<string, number>();
  insertedObjects.forEach((row: DataObject, index: number) => {
        objectIdByKey.set(dataObjectsSeed[index].key, row.id);
      });

      if (attributesSeed.length > 0) {
        await trx.insert(attributes).values(
          attributesSeed.map(({ key: _key, objectKey, ...values }) => ({
            ...values,
            objectId: assertKeyedLookup(objectIdByKey, objectKey, "data object"),
          }))
        );
      }

      const capabilityIdByKey = new Map<string, BusinessCapability["id"]>();
      for (const capability of capabilitiesSeed) {
        const { key, parentKey, ...values } = capability;
        const [insertedCapability] = await trx
          .insert(businessCapabilities)
          .values({
            ...values,
            parentId: parentKey ? assertKeyedLookup(capabilityIdByKey, parentKey, "business capability") : null,
          })
          .returning();
        capabilityIdByKey.set(key, insertedCapability.id);
      }

      if (capabilityDomainMappingsSeed.length > 0) {
        await trx.insert(capabilityDataDomainMappings).values(
          capabilityDomainMappingsSeed.map(({ capabilityKey, domainKey, ...values }) => ({
            ...values,
            capabilityId: assertKeyedLookup(capabilityIdByKey, capabilityKey, "business capability"),
            domainId: assertKeyedLookup(domainIdByKey, domainKey, "data domain"),
          }))
        );
      }

      if (capabilityAreaMappingsSeed.length > 0) {
        await trx.insert(capabilityDataAreaMappings).values(
          capabilityAreaMappingsSeed.map(({ capabilityKey, areaKey, ...values }) => ({
            ...values,
            capabilityId: assertKeyedLookup(capabilityIdByKey, capabilityKey, "business capability"),
            dataAreaId: assertKeyedLookup(areaIdByKey, areaKey, "data area"),
          }))
        );
      }

      if (capabilitySystemMappingsSeed.length > 0) {
        await trx.insert(capabilitySystemMappings).values(
          capabilitySystemMappingsSeed.map(({ capabilityKey, systemKey, ...values }) => ({
            ...values,
            capabilityId: assertKeyedLookup(capabilityIdByKey, capabilityKey, "business capability"),
            systemId: assertKeyedLookup(systemIdByKey, systemKey, "system"),
          }))
        );
      }

      if (dataModelSystemMappingsSeed.length > 0) {
        await trx.insert(dataModelSystemMappings).values(
          dataModelSystemMappingsSeed.map(({ modelKey, systemKey, ...values }) => ({
            ...values,
            modelId: assertKeyedLookup(modelIdByKey, modelKey, "data model"),
            systemId: assertKeyedLookup(systemIdByKey, systemKey, "system"),
          }))
        );
      }

      if (capabilityDataModelMappingsSeed.length > 0) {
        await trx.insert(capabilityDataModelMappings).values(
          capabilityDataModelMappingsSeed.map(({ capabilityKey, modelKey, domainKey, lifecyclePhaseKey, metadata, ...values }) => ({
            ...values,
            capabilityId: assertKeyedLookup(capabilityIdByKey, capabilityKey, "business capability"),
            modelId: assertKeyedLookup(modelIdByKey, modelKey, "data model"),
            domainId: domainKey ? assertKeyedLookup(domainIdByKey, domainKey, "data domain") : null,
            lifecyclePhaseId: lifecyclePhaseKey ? assertKeyedLookup(phaseIdByKey, lifecyclePhaseKey, "lifecycle phase") : null,
            metadata: metadata ?? null,
          }))
        );
      }

      if (capabilityModelSystemMappingsSeed.length > 0) {
        await trx.insert(capabilityModelSystemMappings).values(
          capabilityModelSystemMappingsSeed.map(({ capabilityKey, modelKey, systemKey, ...values }) => ({
            ...values,
            capabilityId: assertKeyedLookup(capabilityIdByKey, capabilityKey, "business capability"),
            modelId: assertKeyedLookup(modelIdByKey, modelKey, "data model"),
            systemId: assertKeyedLookup(systemIdByKey, systemKey, "system"),
          }))
        );
      }

      if (modelLifecycleAssignmentsSeed.length > 0) {
        await trx.insert(modelLifecycleAssignments).values(
          modelLifecycleAssignmentsSeed.map(({ modelKey, phaseKey, ...values }) => ({
            ...values,
            modelId: assertKeyedLookup(modelIdByKey, modelKey, "data model"),
            phaseId: assertKeyedLookup(phaseIdByKey, phaseKey, "lifecycle phase"),
          }))
        );
      }

      await trx.insert(configurations).values([
        {
          category: "governance",
          key: "manufacturing_bcm_framework",
          value: {
            name: "Manufacturing BCM Starter",
            version: "2024.1",
            lastUpdated: new Date().toISOString(),
            lifecyclePhases: lifecyclePhasesSeed.map((phase) => phase.key),
          },
          description: "Active manufacturing business capability model with governance context",
        },
      ]);
    });

    console.log("✅ Database seeding complete.");
  } catch (error) {
    console.error("❌ Database seeding failed", error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}