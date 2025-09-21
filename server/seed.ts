import { db } from "./db";
import { 
  dataModels, 
  dataDomains, 
  dataAreas, 
  dataObjects, 
  attributes, 
  relationships, 
  systems,
  configurations 
} from "@shared/schema";

export async function seedDatabase() {
  console.log("🌱 Starting database seeding...");

  try {
    // Clear existing data
    await db.delete(configurations);
    await db.delete(relationships);
    await db.delete(attributes);
    await db.delete(dataObjects);
    await db.delete(dataAreas);
    await db.delete(dataDomains);
    await db.delete(dataModels);

    // Seed Systems first (needed for foreign key references)
    const [dataLakeSystem, dataWarehouseSystem, sapSystem] = await db.insert(systems).values([
      {
        name: "Data Lake",
        category: "Data Storage",
        type: "adls",
        description: "Azure Data Lake Storage for raw data ingestion",
        canBeSource: false,
        canBeTarget: true
      },
      {
        name: "Data Warehouse",
        category: "Data Storage", 
        type: "sql",
        description: "SQL Data Warehouse for structured analytics",
        canBeSource: false,
        canBeTarget: true
      },
      {
        name: "SAP ERP",
        category: "Enterprise Resource Planning",
        type: "api",
        description: "SAP ERP system for enterprise operations",
        canBeSource: true,
        canBeTarget: false
      }
    ]).returning();

    // Seed Data Domains
    const [hrDomain, financeDomain, operationsDomain, manufacturingDomain, qualityDomain, supplyChainDomain, sapPlanningDomain, sapProductionDomain, sapMaterialsDomain, sapMaintenanceDomain] = await db.insert(dataDomains).values([
      {
        name: "Human Resources",
        description: "People management and organizational data"
      },
      {
        name: "Finance",
        description: "Financial transactions and accounting data"
      },
      {
        name: "Operations",
        description: "Day-to-day business operations and processes"
      },
      {
        name: "Manufacturing",
        description: "Production processes and manufacturing operations"
      },
      {
        name: "Quality Control",
        description: "Quality assurance and control processes"
      },
      {
        name: "Supply Chain",
        description: "Supply chain management and logistics"
      },
      {
        name: "SAP Production Planning",
        description: "SAP PP module - Production planning and control"
      },
      {
        name: "SAP Manufacturing Execution",
        description: "SAP MES - Manufacturing execution systems"
      },
      {
        name: "SAP Materials Management",
        description: "SAP MM module - Materials and inventory management"
      },
      {
        name: "SAP Plant Maintenance",
        description: "SAP PM module - Equipment and maintenance management"
      }
    ]).returning();

    // Seed Data Areas
    const [talentArea, payrollArea, accountingArea, procurementArea, productionArea, maintenanceArea, qualityAssuranceArea, inventoryArea, logisticsArea, sapMrpArea, sapProductionOrdersArea, sapBomArea, sapRoutingArea, sapCapacityArea, sapShopFloorArea, sapMaterialMasterArea, sapPurchasingArea, sapWarehouseArea, sapMaintenanceOrdersArea, sapEquipmentArea, sapWorkCenterArea] = await db.insert(dataAreas).values([
      {
        name: "Talent Management",
        domainId: hrDomain.id,
        description: "Employee lifecycle and performance"
      },
      {
        name: "Payroll",
        domainId: hrDomain.id,
        description: "Compensation and benefits"
      },
      {
        name: "Accounting",
        domainId: financeDomain.id,
        description: "Financial records and reporting"
      },
      {
        name: "Procurement",
        domainId: operationsDomain.id,
        description: "Purchasing and supplier management"
      },
      {
        name: "Production Planning",
        domainId: manufacturingDomain.id,
        description: "Manufacturing schedules and production planning"
      },
      {
        name: "Equipment Maintenance",
        domainId: manufacturingDomain.id,
        description: "Equipment maintenance and downtime tracking"
      },
      {
        name: "Quality Assurance",
        domainId: qualityDomain.id,
        description: "Quality control and testing processes"
      },
      {
        name: "Inventory Management",
        domainId: supplyChainDomain.id,
        description: "Raw materials and finished goods inventory"
      },
      {
        name: "Logistics",
        domainId: supplyChainDomain.id,
        description: "Shipping and distribution management"
      },
      {
        name: "SAP MRP",
        domainId: sapPlanningDomain.id,
        description: "Material Requirements Planning"
      },
      {
        name: "SAP Production Orders",
        domainId: sapPlanningDomain.id,
        description: "Production order management and tracking"
      },
      {
        name: "SAP BOM Management",
        domainId: sapPlanningDomain.id,
        description: "Bill of Materials structure and versions"
      },
      {
        name: "SAP Routing",
        domainId: sapPlanningDomain.id,
        description: "Production routing and operations"
      },
      {
        name: "SAP Capacity Planning",
        domainId: sapPlanningDomain.id,
        description: "Resource and capacity management"
      },
      {
        name: "SAP Shop Floor Control",
        domainId: sapProductionDomain.id,
        description: "Real-time production execution and monitoring"
      },
      {
        name: "SAP Material Master",
        domainId: sapMaterialsDomain.id,
        description: "Material master data and classifications"
      },
      {
        name: "SAP Purchasing",
        domainId: sapMaterialsDomain.id,
        description: "Purchase orders and vendor management"
      },
      {
        name: "SAP Warehouse Management",
        domainId: sapMaterialsDomain.id,
        description: "Storage location and stock movements"
      },
      {
        name: "SAP Maintenance Orders",
        domainId: sapMaintenanceDomain.id,
        description: "Preventive and corrective maintenance orders"
      },
      {
        name: "SAP Equipment Master",
        domainId: sapMaintenanceDomain.id,
        description: "Equipment hierarchy and technical objects"
      },
      {
        name: "SAP Work Center Management",
        domainId: sapMaintenanceDomain.id,
        description: "Production work centers and resources"
      }
    ]).returning();

    // Seed Data Models
    const [hrModel, manufacturingModel, sapManufacturingModel] = await db.insert(dataModels).values([
      {
        name: "HR Data Model",
        layer: "conceptual",
        targetSystemId: dataLakeSystem.id
      },
      {
        name: "Manufacturing Operations Model",
        layer: "conceptual",
        targetSystemId: dataWarehouseSystem.id
      },
      {
        name: "SAP Manufacturing Integration Model",
        layer: "conceptual",
        targetSystemId: dataWarehouseSystem.id
      }
    ]).returning();

    // Seed Data Objects
    const [employeeObj, departmentObj, positionObj, productionOrderObj, workCenterObj, equipmentObj, qualityTestObj, inventoryItemObj, supplierObj, sapMaterialMasterObj, sapBomHeaderObj, sapBomItemObj, sapRoutingHeaderObj, sapRoutingOperationObj, sapProductionOrderHeaderObj, sapProductionOrderComponentObj, sapWorkCenterObj, sapEquipmentMasterObj, sapMaintenanceOrderObj, sapPurchaseOrderObj, sapMrpElementObj] = await db.insert(dataObjects).values([
      {
        name: "Employee",
        modelId: hrModel.id,
        domainId: hrDomain.id,
        dataAreaId: talentArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataLakeSystem.id,
        isNew: false,
        position: { x: 100, y: 100 }
      },
      {
        name: "Department",
        modelId: hrModel.id,
        domainId: hrDomain.id,
        dataAreaId: talentArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataLakeSystem.id,
        isNew: false,
        position: { x: 400, y: 100 }
      },
      {
        name: "Position",
        modelId: hrModel.id,
        domainId: hrDomain.id,
        dataAreaId: talentArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataLakeSystem.id,
        isNew: false,
        position: { x: 250, y: 300 }
      },
      {
        name: "Production_Order",
        modelId: manufacturingModel.id,
        domainId: manufacturingDomain.id,
        dataAreaId: productionArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 150, y: 150 }
      },
      {
        name: "Work_Center",
        modelId: manufacturingModel.id,
        domainId: manufacturingDomain.id,
        dataAreaId: productionArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 450, y: 150 }
      },
      {
        name: "Equipment",
        modelId: manufacturingModel.id,
        domainId: manufacturingDomain.id,
        dataAreaId: maintenanceArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 300, y: 350 }
      },
      {
        name: "Quality_Test",
        modelId: manufacturingModel.id,
        domainId: qualityDomain.id,
        dataAreaId: qualityAssuranceArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 600, y: 350 }
      },
      {
        name: "Inventory_Item",
        modelId: manufacturingModel.id,
        domainId: supplyChainDomain.id,
        dataAreaId: inventoryArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: true,
        position: { x: 150, y: 550 }
      },
      {
        name: "Supplier",
        modelId: manufacturingModel.id,
        domainId: supplyChainDomain.id,
        dataAreaId: logisticsArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 450, y: 550 }
      },
      // SAP Manufacturing Objects
      {
        name: "SAP_Material_Master",
        modelId: sapManufacturingModel.id,
        domainId: sapMaterialsDomain.id,
        dataAreaId: sapMaterialMasterArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 100, y: 100 }
      },
      {
        name: "SAP_BOM_Header",
        modelId: sapManufacturingModel.id,
        domainId: sapPlanningDomain.id,
        dataAreaId: sapBomArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 400, y: 100 }
      },
      {
        name: "SAP_BOM_Item",
        modelId: sapManufacturingModel.id,
        domainId: sapPlanningDomain.id,
        dataAreaId: sapBomArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 400, y: 300 }
      },
      {
        name: "SAP_Routing_Header",
        modelId: sapManufacturingModel.id,
        domainId: sapPlanningDomain.id,
        dataAreaId: sapRoutingArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 700, y: 100 }
      },
      {
        name: "SAP_Routing_Operation",
        modelId: sapManufacturingModel.id,
        domainId: sapPlanningDomain.id,
        dataAreaId: sapRoutingArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 700, y: 300 }
      },
      {
        name: "SAP_Production_Order_Header",
        modelId: sapManufacturingModel.id,
        domainId: sapPlanningDomain.id,
        dataAreaId: sapProductionOrdersArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 100, y: 500 }
      },
      {
        name: "SAP_Production_Order_Component",
        modelId: sapManufacturingModel.id,
        domainId: sapPlanningDomain.id,
        dataAreaId: sapProductionOrdersArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 400, y: 500 }
      },
      {
        name: "SAP_Work_Center",
        modelId: sapManufacturingModel.id,
        domainId: sapMaintenanceDomain.id,
        dataAreaId: sapWorkCenterArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 700, y: 500 }
      },
      {
        name: "SAP_Equipment_Master",
        modelId: sapManufacturingModel.id,
        domainId: sapMaintenanceDomain.id,
        dataAreaId: sapEquipmentArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 100, y: 700 }
      },
      {
        name: "SAP_Maintenance_Order",
        modelId: sapManufacturingModel.id,
        domainId: sapMaintenanceDomain.id,
        dataAreaId: sapMaintenanceOrdersArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: true,
        position: { x: 400, y: 700 }
      },
      {
        name: "SAP_Purchase_Order",
        modelId: sapManufacturingModel.id,
        domainId: sapMaterialsDomain.id,
        dataAreaId: sapPurchasingArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: false,
        position: { x: 700, y: 700 }
      },
      {
        name: "SAP_MRP_Element",
        modelId: sapManufacturingModel.id,
        domainId: sapPlanningDomain.id,
        dataAreaId: sapMrpArea.id,
        sourceSystemId: sapSystem.id,
        targetSystemId: dataWarehouseSystem.id,
        isNew: true,
        position: { x: 1000, y: 100 }
      }
    ]).returning();

    // Seed Attributes
    await db.insert(attributes).values([
      // Employee attributes
      {
        name: "employee_id",
        dataType: "INTEGER",
        isPrimaryKey: true,
        isRequired: true,
        objectId: employeeObj.id
      },
      {
        name: "first_name",
        dataType: "VARCHAR(50)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: employeeObj.id
      },
      {
        name: "last_name",
        dataType: "VARCHAR(50)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: employeeObj.id
      },
      {
        name: "email",
        dataType: "VARCHAR(100)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: employeeObj.id
      },
      {
        name: "department_id",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: employeeObj.id
      },
      // Department attributes
      {
        name: "department_id",
        dataType: "INTEGER",
        isPrimaryKey: true,
        isRequired: true,
        objectId: departmentObj.id
      },
      {
        name: "department_name",
        dataType: "VARCHAR(100)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: departmentObj.id
      },
      {
        name: "manager_id",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: false,
        isForeignKey: true,
        objectId: departmentObj.id
      },
      // Position attributes
      {
        name: "position_id",
        dataType: "INTEGER",
        isPrimaryKey: true,
        isRequired: true,
        objectId: positionObj.id
      },
      {
        name: "position_title",
        dataType: "VARCHAR(100)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: positionObj.id
      },
      {
        name: "salary_range_min",
        dataType: "DECIMAL(10,2)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: positionObj.id
      },
      {
        name: "salary_range_max",
        dataType: "DECIMAL(10,2)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: positionObj.id
      },
      // Production Order attributes
      {
        name: "order_id",
        dataType: "INTEGER",
        isPrimaryKey: true,
        isRequired: true,
        objectId: productionOrderObj.id
      },
      {
        name: "product_code",
        dataType: "VARCHAR(50)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: productionOrderObj.id
      },
      {
        name: "quantity_planned",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: true,
        objectId: productionOrderObj.id
      },
      {
        name: "quantity_produced",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: false,
        objectId: productionOrderObj.id
      },
      {
        name: "start_date",
        dataType: "DATETIME",
        isPrimaryKey: false,
        isRequired: true,
        objectId: productionOrderObj.id
      },
      {
        name: "end_date",
        dataType: "DATETIME",
        isPrimaryKey: false,
        isRequired: false,
        objectId: productionOrderObj.id
      },
      {
        name: "work_center_id",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: productionOrderObj.id
      },
      // Work Center attributes
      {
        name: "work_center_id",
        dataType: "INTEGER",
        isPrimaryKey: true,
        isRequired: true,
        objectId: workCenterObj.id
      },
      {
        name: "work_center_name",
        dataType: "VARCHAR(100)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: workCenterObj.id
      },
      {
        name: "capacity_per_hour",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: true,
        objectId: workCenterObj.id
      },
      {
        name: "status",
        dataType: "VARCHAR(20)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: workCenterObj.id
      },
      // Equipment attributes
      {
        name: "equipment_id",
        dataType: "INTEGER",
        isPrimaryKey: true,
        isRequired: true,
        objectId: equipmentObj.id
      },
      {
        name: "equipment_name",
        dataType: "VARCHAR(100)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: equipmentObj.id
      },
      {
        name: "serial_number",
        dataType: "VARCHAR(50)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: equipmentObj.id
      },
      {
        name: "last_maintenance_date",
        dataType: "DATETIME",
        isPrimaryKey: false,
        isRequired: false,
        objectId: equipmentObj.id
      },
      {
        name: "next_maintenance_date",
        dataType: "DATETIME",
        isPrimaryKey: false,
        isRequired: false,
        objectId: equipmentObj.id
      },
      {
        name: "work_center_id",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: equipmentObj.id
      },
      // Quality Test attributes
      {
        name: "test_id",
        dataType: "INTEGER",
        isPrimaryKey: true,
        isRequired: true,
        objectId: qualityTestObj.id
      },
      {
        name: "order_id",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: qualityTestObj.id
      },
      {
        name: "test_type",
        dataType: "VARCHAR(50)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: qualityTestObj.id
      },
      {
        name: "test_result",
        dataType: "VARCHAR(20)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: qualityTestObj.id
      },
      {
        name: "test_date",
        dataType: "DATETIME",
        isPrimaryKey: false,
        isRequired: true,
        objectId: qualityTestObj.id
      },
      {
        name: "defect_count",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: false,
        objectId: qualityTestObj.id
      },
      // Inventory Item attributes
      {
        name: "item_id",
        dataType: "INTEGER",
        isPrimaryKey: true,
        isRequired: true,
        objectId: inventoryItemObj.id
      },
      {
        name: "item_code",
        dataType: "VARCHAR(50)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: inventoryItemObj.id
      },
      {
        name: "item_description",
        dataType: "VARCHAR(200)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: inventoryItemObj.id
      },
      {
        name: "current_stock",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: true,
        objectId: inventoryItemObj.id
      },
      {
        name: "reorder_level",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: true,
        objectId: inventoryItemObj.id
      },
      {
        name: "unit_cost",
        dataType: "DECIMAL(10,2)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: inventoryItemObj.id
      },
      {
        name: "supplier_id",
        dataType: "INTEGER",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: inventoryItemObj.id
      },
      // Supplier attributes
      {
        name: "supplier_id",
        dataType: "INTEGER",
        isPrimaryKey: true,
        isRequired: true,
        objectId: supplierObj.id
      },
      {
        name: "supplier_name",
        dataType: "VARCHAR(100)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: supplierObj.id
      },
      {
        name: "contact_email",
        dataType: "VARCHAR(100)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: supplierObj.id
      },
      {
        name: "phone_number",
        dataType: "VARCHAR(20)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: supplierObj.id
      },
      {
        name: "rating",
        dataType: "DECIMAL(3,2)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: supplierObj.id
      },
      // SAP Material Master attributes
      {
        name: "material_number",
        dataType: "VARCHAR(40)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapMaterialMasterObj.id
      },
      {
        name: "material_type",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapMaterialMasterObj.id
      },
      {
        name: "material_description",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapMaterialMasterObj.id
      },
      {
        name: "base_unit_of_measure",
        dataType: "VARCHAR(3)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapMaterialMasterObj.id
      },
      {
        name: "material_group",
        dataType: "VARCHAR(9)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMaterialMasterObj.id
      },
      {
        name: "plant",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapMaterialMasterObj.id
      },
      {
        name: "mrp_type",
        dataType: "VARCHAR(2)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMaterialMasterObj.id
      },
      {
        name: "lot_size",
        dataType: "VARCHAR(2)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMaterialMasterObj.id
      },
      // SAP BOM Header attributes
      {
        name: "bom_number",
        dataType: "VARCHAR(8)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapBomHeaderObj.id
      },
      {
        name: "material_number",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: sapBomHeaderObj.id
      },
      {
        name: "plant",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapBomHeaderObj.id
      },
      {
        name: "bom_usage",
        dataType: "VARCHAR(1)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapBomHeaderObj.id
      },
      {
        name: "alternative_bom",
        dataType: "VARCHAR(2)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapBomHeaderObj.id
      },
      {
        name: "valid_from_date",
        dataType: "DATE",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapBomHeaderObj.id
      },
      {
        name: "base_quantity",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapBomHeaderObj.id
      },
      // SAP BOM Item attributes
      {
        name: "bom_number",
        dataType: "VARCHAR(8)",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: sapBomItemObj.id
      },
      {
        name: "item_number",
        dataType: "VARCHAR(4)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapBomItemObj.id
      },
      {
        name: "component_material",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: sapBomItemObj.id
      },
      {
        name: "component_quantity",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapBomItemObj.id
      },
      {
        name: "unit_of_measure",
        dataType: "VARCHAR(3)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapBomItemObj.id
      },
      {
        name: "item_category",
        dataType: "VARCHAR(1)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapBomItemObj.id
      },
      // SAP Routing Header attributes
      {
        name: "routing_number",
        dataType: "VARCHAR(8)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapRoutingHeaderObj.id
      },
      {
        name: "material_number",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: sapRoutingHeaderObj.id
      },
      {
        name: "plant",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapRoutingHeaderObj.id
      },
      {
        name: "routing_usage",
        dataType: "VARCHAR(1)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapRoutingHeaderObj.id
      },
      {
        name: "routing_status",
        dataType: "VARCHAR(2)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapRoutingHeaderObj.id
      },
      {
        name: "lot_size_from",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapRoutingHeaderObj.id
      },
      {
        name: "lot_size_to",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapRoutingHeaderObj.id
      },
      // SAP Routing Operation attributes
      {
        name: "routing_number",
        dataType: "VARCHAR(8)",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: sapRoutingOperationObj.id
      },
      {
        name: "operation_number",
        dataType: "VARCHAR(4)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapRoutingOperationObj.id
      },
      {
        name: "work_center",
        dataType: "VARCHAR(8)",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: sapRoutingOperationObj.id
      },
      {
        name: "operation_description",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapRoutingOperationObj.id
      },
      {
        name: "setup_time",
        dataType: "DECIMAL(9,3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapRoutingOperationObj.id
      },
      {
        name: "machine_time",
        dataType: "DECIMAL(9,3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapRoutingOperationObj.id
      },
      {
        name: "labor_time",
        dataType: "DECIMAL(9,3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapRoutingOperationObj.id
      },
      // SAP Production Order Header attributes
      {
        name: "production_order",
        dataType: "VARCHAR(10)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapProductionOrderHeaderObj.id
      },
      {
        name: "material_number",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: sapProductionOrderHeaderObj.id
      },
      {
        name: "plant",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapProductionOrderHeaderObj.id
      },
      {
        name: "order_type",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapProductionOrderHeaderObj.id
      },
      {
        name: "order_quantity",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapProductionOrderHeaderObj.id
      },
      {
        name: "confirmed_quantity",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapProductionOrderHeaderObj.id
      },
      {
        name: "system_status",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapProductionOrderHeaderObj.id
      },
      {
        name: "basic_start_date",
        dataType: "DATE",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapProductionOrderHeaderObj.id
      },
      {
        name: "basic_finish_date",
        dataType: "DATE",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapProductionOrderHeaderObj.id
      },
      // SAP Production Order Component attributes
      {
        name: "production_order",
        dataType: "VARCHAR(10)",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: sapProductionOrderComponentObj.id
      },
      {
        name: "item_number",
        dataType: "VARCHAR(4)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapProductionOrderComponentObj.id
      },
      {
        name: "material_number",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: sapProductionOrderComponentObj.id
      },
      {
        name: "required_quantity",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapProductionOrderComponentObj.id
      },
      {
        name: "withdrawn_quantity",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapProductionOrderComponentObj.id
      },
      {
        name: "requirement_date",
        dataType: "DATE",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapProductionOrderComponentObj.id
      },
      {
        name: "storage_location",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapProductionOrderComponentObj.id
      },
      // SAP Work Center attributes
      {
        name: "work_center",
        dataType: "VARCHAR(8)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapWorkCenterObj.id
      },
      {
        name: "plant",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapWorkCenterObj.id
      },
      {
        name: "work_center_category",
        dataType: "VARCHAR(1)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapWorkCenterObj.id
      },
      {
        name: "description",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapWorkCenterObj.id
      },
      {
        name: "capacity_category",
        dataType: "VARCHAR(8)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapWorkCenterObj.id
      },
      {
        name: "available_capacity",
        dataType: "DECIMAL(9,3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapWorkCenterObj.id
      },
      {
        name: "capacity_unit",
        dataType: "VARCHAR(3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapWorkCenterObj.id
      },
      // SAP Equipment Master attributes
      {
        name: "equipment_number",
        dataType: "VARCHAR(18)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapEquipmentMasterObj.id
      },
      {
        name: "description",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapEquipmentMasterObj.id
      },
      {
        name: "equipment_category",
        dataType: "VARCHAR(1)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapEquipmentMasterObj.id
      },
      {
        name: "technical_object_type",
        dataType: "VARCHAR(10)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapEquipmentMasterObj.id
      },
      {
        name: "superior_equipment",
        dataType: "VARCHAR(18)",
        isPrimaryKey: false,
        isRequired: false,
        isForeignKey: true,
        objectId: sapEquipmentMasterObj.id
      },
      {
        name: "functional_location",
        dataType: "VARCHAR(30)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapEquipmentMasterObj.id
      },
      {
        name: "manufacturer",
        dataType: "VARCHAR(30)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapEquipmentMasterObj.id
      },
      {
        name: "model_number",
        dataType: "VARCHAR(18)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapEquipmentMasterObj.id
      },
      {
        name: "serial_number",
        dataType: "VARCHAR(18)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapEquipmentMasterObj.id
      },
      // SAP Maintenance Order attributes
      {
        name: "maintenance_order",
        dataType: "VARCHAR(12)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapMaintenanceOrderObj.id
      },
      {
        name: "order_type",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapMaintenanceOrderObj.id
      },
      {
        name: "equipment_number",
        dataType: "VARCHAR(18)",
        isPrimaryKey: false,
        isRequired: false,
        isForeignKey: true,
        objectId: sapMaintenanceOrderObj.id
      },
      {
        name: "functional_location",
        dataType: "VARCHAR(30)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMaintenanceOrderObj.id
      },
      {
        name: "description",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMaintenanceOrderObj.id
      },
      {
        name: "priority",
        dataType: "VARCHAR(1)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMaintenanceOrderObj.id
      },
      {
        name: "basic_start_date",
        dataType: "DATE",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMaintenanceOrderObj.id
      },
      {
        name: "basic_finish_date",
        dataType: "DATE",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMaintenanceOrderObj.id
      },
      {
        name: "system_status",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapMaintenanceOrderObj.id
      },
      // SAP Purchase Order attributes
      {
        name: "purchase_order",
        dataType: "VARCHAR(10)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapPurchaseOrderObj.id
      },
      {
        name: "item_number",
        dataType: "VARCHAR(5)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapPurchaseOrderObj.id
      },
      {
        name: "material_number",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: false,
        isForeignKey: true,
        objectId: sapPurchaseOrderObj.id
      },
      {
        name: "vendor",
        dataType: "VARCHAR(10)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapPurchaseOrderObj.id
      },
      {
        name: "plant",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapPurchaseOrderObj.id
      },
      {
        name: "order_quantity",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapPurchaseOrderObj.id
      },
      {
        name: "delivery_date",
        dataType: "DATE",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapPurchaseOrderObj.id
      },
      {
        name: "net_price",
        dataType: "DECIMAL(11,2)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapPurchaseOrderObj.id
      },
      // SAP MRP Element attributes
      {
        name: "mrp_element",
        dataType: "VARCHAR(12)",
        isPrimaryKey: true,
        isRequired: true,
        objectId: sapMrpElementObj.id
      },
      {
        name: "material_number",
        dataType: "VARCHAR(40)",
        isPrimaryKey: false,
        isRequired: true,
        isForeignKey: true,
        objectId: sapMrpElementObj.id
      },
      {
        name: "plant",
        dataType: "VARCHAR(4)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapMrpElementObj.id
      },
      {
        name: "mrp_element_data",
        dataType: "DATE",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapMrpElementObj.id
      },
      {
        name: "exception_message",
        dataType: "VARCHAR(2)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMrpElementObj.id
      },
      {
        name: "receipt_qty",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMrpElementObj.id
      },
      {
        name: "requirement_qty",
        dataType: "DECIMAL(13,3)",
        isPrimaryKey: false,
        isRequired: false,
        objectId: sapMrpElementObj.id
      },
      {
        name: "mrp_element_category",
        dataType: "VARCHAR(2)",
        isPrimaryKey: false,
        isRequired: true,
        objectId: sapMrpElementObj.id
      }
    ]);

    // Seed Relationships
    await db.insert(relationships).values([
      {
        sourceObjectId: employeeObj.id,
        targetObjectId: departmentObj.id,
        type: "N:1",
        sourceAttributeName: "department_id",
        targetAttributeName: "department_id",
        modelId: hrModel.id
      },
      {
        sourceObjectId: departmentObj.id,
        targetObjectId: employeeObj.id,
        type: "1:1",
        sourceAttributeName: "manager_id",
        targetAttributeName: "employee_id",
        modelId: hrModel.id
      },
      {
        sourceObjectId: productionOrderObj.id,
        targetObjectId: workCenterObj.id,
        type: "N:1",
        sourceAttributeName: "work_center_id",
        targetAttributeName: "work_center_id",
        modelId: manufacturingModel.id
      },
      {
        sourceObjectId: equipmentObj.id,
        targetObjectId: workCenterObj.id,
        type: "N:1",
        sourceAttributeName: "work_center_id",
        targetAttributeName: "work_center_id",
        modelId: manufacturingModel.id
      },
      {
        sourceObjectId: qualityTestObj.id,
        targetObjectId: productionOrderObj.id,
        type: "N:1",
        sourceAttributeName: "order_id",
        targetAttributeName: "order_id",
        modelId: manufacturingModel.id
      },
      {
        sourceObjectId: inventoryItemObj.id,
        targetObjectId: supplierObj.id,
        type: "N:1",
        sourceAttributeName: "supplier_id",
        targetAttributeName: "supplier_id",
        modelId: manufacturingModel.id
      },
      // SAP Manufacturing Relationships
      {
        sourceObjectId: sapBomHeaderObj.id,
        targetObjectId: sapMaterialMasterObj.id,
        type: "N:1",
        sourceAttributeName: "material_number",
        targetAttributeName: "material_number",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapBomItemObj.id,
        targetObjectId: sapBomHeaderObj.id,
        type: "N:1",
        sourceAttributeName: "bom_number",
        targetAttributeName: "bom_number",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapBomItemObj.id,
        targetObjectId: sapMaterialMasterObj.id,
        type: "N:1",
        sourceAttributeName: "component_material",
        targetAttributeName: "material_number",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapRoutingHeaderObj.id,
        targetObjectId: sapMaterialMasterObj.id,
        type: "N:1",
        sourceAttributeName: "material_number",
        targetAttributeName: "material_number",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapRoutingOperationObj.id,
        targetObjectId: sapRoutingHeaderObj.id,
        type: "N:1",
        sourceAttributeName: "routing_number",
        targetAttributeName: "routing_number",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapRoutingOperationObj.id,
        targetObjectId: sapWorkCenterObj.id,
        type: "N:1",
        sourceAttributeName: "work_center",
        targetAttributeName: "work_center",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapProductionOrderHeaderObj.id,
        targetObjectId: sapMaterialMasterObj.id,
        type: "N:1",
        sourceAttributeName: "material_number",
        targetAttributeName: "material_number",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapProductionOrderComponentObj.id,
        targetObjectId: sapProductionOrderHeaderObj.id,
        type: "N:1",
        sourceAttributeName: "production_order",
        targetAttributeName: "production_order",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapProductionOrderComponentObj.id,
        targetObjectId: sapMaterialMasterObj.id,
        type: "N:1",
        sourceAttributeName: "material_number",
        targetAttributeName: "material_number",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapMaintenanceOrderObj.id,
        targetObjectId: sapEquipmentMasterObj.id,
        type: "N:1",
        sourceAttributeName: "equipment_number",
        targetAttributeName: "equipment_number",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapPurchaseOrderObj.id,
        targetObjectId: sapMaterialMasterObj.id,
        type: "N:1",
        sourceAttributeName: "material_number",
        targetAttributeName: "material_number",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapMrpElementObj.id,
        targetObjectId: sapMaterialMasterObj.id,
        type: "N:1",
        sourceAttributeName: "material_number",
        targetAttributeName: "material_number",
        modelId: sapManufacturingModel.id
      },
      {
        sourceObjectId: sapEquipmentMasterObj.id,
        targetObjectId: sapEquipmentMasterObj.id,
        type: "N:1",
        sourceAttributeName: "superior_equipment",
        targetAttributeName: "equipment_number",
        modelId: sapManufacturingModel.id
      }
    ]);

    // Data Sources section removed - table not defined in schema

    // Seed Initial Configuration
    await db.insert(configurations).values([
      {
        category: "ai",
        key: "openai_model",
        value: "gpt-4o",
        description: "Default OpenAI model for AI suggestions"
      },
      {
        category: "ai",
        key: "temperature",
        value: 0.7,
        description: "AI response creativity level"
      },
      {
        category: "ui",
        key: "theme",
        value: "dark",
        description: "Default UI theme"
      },
      {
        category: "ui",
        key: "auto_save",
        value: true,
        description: "Enable automatic saving"
      },
      {
        category: "export",
        key: "default_format",
        value: "json",
        description: "Default export format"
      }
    ]);

    console.log("✅ Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}