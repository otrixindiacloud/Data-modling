
import { storage } from "./storage";

async function migrateDataToAllLayers() {
  console.log("🔄 Starting migration to populate logical and physical layers...");

  try {
    // Get all models
    const allModels = await storage.getDataModels();
    
    // Find conceptual models that have data
    const conceptualModels = allModels.filter(model => 
      model.layer === "conceptual" && !model.parentModelId
    );

    for (const conceptualModel of conceptualModels) {
      console.log(`\n📊 Processing model: ${conceptualModel.name}`);
      
      // Find logical and physical models in the same family
      const logicalModel = allModels.find(m => 
        m.parentModelId === conceptualModel.id && m.layer === "logical"
      );
      const physicalModel = allModels.find(m => 
        m.parentModelId === conceptualModel.id && m.layer === "physical"
      );

      if (!logicalModel || !physicalModel) {
        console.log(`⚠️  Missing logical or physical model for ${conceptualModel.name}`);
        continue;
      }

      // Get objects from conceptual layer
      const conceptualObjects = await storage.getDataObjectsByModel(conceptualModel.id);
      console.log(`Found ${conceptualObjects.length} objects in conceptual layer`);

      // Copy objects to logical and physical layers
      for (const conceptualObj of conceptualObjects) {
        console.log(`  📦 Migrating object: ${conceptualObj.name}`);

        // Create object in logical layer
        const logicalObject = await storage.createDataObject({
          name: conceptualObj.name,
          modelId: logicalModel.id,
          domainId: conceptualObj.domainId,
          dataAreaId: conceptualObj.dataAreaId,
          sourceSystemId: conceptualObj.sourceSystemId,
          targetSystemId: conceptualObj.targetSystemId,
          isNew: conceptualObj.isNew || false,
          position: conceptualObj.position
        });

        // Create object in physical layer
        const physicalObject = await storage.createDataObject({
          name: conceptualObj.name,
          modelId: physicalModel.id,
          domainId: conceptualObj.domainId,
          dataAreaId: conceptualObj.dataAreaId,
          sourceSystemId: conceptualObj.sourceSystemId,
          targetSystemId: conceptualObj.targetSystemId,
          isNew: conceptualObj.isNew || false,
          position: conceptualObj.position
        });

        // Get attributes from existing seed data for this object name
        const seedAttributes = await getSeedAttributesForObject(conceptualObj.name);
        
        // Create attributes in logical and physical layers
        for (const attr of seedAttributes) {
          // Create in logical layer
          await storage.createAttribute({
            name: attr.name,
            objectId: logicalObject.id,
            conceptualType: attr.conceptualType,
            logicalType: attr.logicalType,
            physicalType: attr.physicalType,
            length: attr.length,
            nullable: attr.nullable,
            isPrimaryKey: attr.isPrimaryKey,
            isForeignKey: attr.isForeignKey,
            isNew: false,
            orderIndex: attr.orderIndex
          });

          // Create in physical layer
          await storage.createAttribute({
            name: attr.name,
            objectId: physicalObject.id,
            conceptualType: attr.conceptualType,
            logicalType: attr.logicalType,
            physicalType: attr.physicalType,
            length: attr.length,
            nullable: attr.nullable,
            isPrimaryKey: attr.isPrimaryKey,
            isForeignKey: attr.isForeignKey,
            isNew: false,
            orderIndex: attr.orderIndex
          });
        }

        console.log(`    ✅ Created ${seedAttributes.length} attributes`);
      }

      // Copy relationships to logical and physical layers
      const conceptualRelationships = await storage.getRelationshipsByModel(conceptualModel.id);
      console.log(`Found ${conceptualRelationships.length} relationships in conceptual layer`);

      for (const rel of conceptualRelationships) {
        // Find corresponding objects in logical layer
        const logicalObjects = await storage.getDataObjectsByModel(logicalModel.id);
        const sourceLogicalObj = logicalObjects.find(obj => obj.name === conceptualObjects.find(co => co.id === rel.sourceModelObjectId)?.name);
        const targetLogicalObj = logicalObjects.find(obj => obj.name === conceptualObjects.find(co => co.id === rel.targetModelObjectId)?.name);

        if (sourceLogicalObj && targetLogicalObj) {
          // Create relationship in logical layer
          await storage.createRelationship({
            layer: "logical",
            sourceModelObjectId: sourceLogicalObj.id,
            targetModelObjectId: targetLogicalObj.id,
            type: rel.type,
            modelId: logicalModel.id,
            relationshipLevel: "logical"
          });
        }

        // Find corresponding objects in physical layer
        const physicalObjects = await storage.getDataObjectsByModel(physicalModel.id);
        const sourcePhysicalObj = physicalObjects.find(obj => obj.name === conceptualObjects.find(co => co.id === rel.sourceModelObjectId)?.name);
        const targetPhysicalObj = physicalObjects.find(obj => obj.name === conceptualObjects.find(co => co.id === rel.targetModelObjectId)?.name);

        if (sourcePhysicalObj && targetPhysicalObj) {
          // Create relationship in physical layer
          await storage.createRelationship({
            layer: "physical",
            sourceModelObjectId: sourcePhysicalObj.id,
            targetModelObjectId: targetPhysicalObj.id,
            type: rel.type,
            modelId: physicalModel.id,
            relationshipLevel: "physical"
          });
        }
      }
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("All layers now have the same data objects with proper attributes!");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Helper function to get seed attributes for known objects
async function getSeedAttributesForObject(objectName: string) {
  const attributeMap: Record<string, any[]> = {
    "Employee": [
      { name: "employee_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 1 },
      { name: "first_name", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(50)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
      { name: "last_name", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(50)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
      { name: "email", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(100)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
      { name: "department_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 5 }
    ],
    "Department": [
      { name: "department_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 1 },
      { name: "department_name", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(100)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
      { name: "manager_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: true, isPrimaryKey: false, isForeignKey: true, orderIndex: 3 }
    ],
    "Position": [
      { name: "position_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 1 },
      { name: "position_title", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(100)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
      { name: "salary_range_min", conceptualType: "Decimal", logicalType: "Decimal", physicalType: "DECIMAL(10,2)", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
      { name: "salary_range_max", conceptualType: "Decimal", logicalType: "Decimal", physicalType: "DECIMAL(10,2)", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 }
    ],
    "Production_Order": [
      { name: "order_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 1 },
      { name: "product_code", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(50)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
      { name: "quantity_planned", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
      { name: "quantity_produced", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
      { name: "start_date", conceptualType: "DateTime", logicalType: "DateTime", physicalType: "DATETIME", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 },
      { name: "end_date", conceptualType: "DateTime", logicalType: "DateTime", physicalType: "DATETIME", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 6 },
      { name: "work_center_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 7 }
    ],
    "Work_Center": [
      { name: "work_center_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 1 },
      { name: "work_center_name", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(100)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
      { name: "capacity_per_hour", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
      { name: "status", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(20)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 }
    ],
    "Equipment": [
      { name: "equipment_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 1 },
      { name: "equipment_name", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(100)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
      { name: "serial_number", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(50)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
      { name: "last_maintenance_date", conceptualType: "DateTime", logicalType: "DateTime", physicalType: "DATETIME", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
      { name: "next_maintenance_date", conceptualType: "DateTime", logicalType: "DateTime", physicalType: "DATETIME", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 },
      { name: "work_center_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 6 }
    ],
    "Quality_Test": [
      { name: "test_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 1 },
      { name: "order_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 2 },
      { name: "test_type", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(50)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
      { name: "test_result", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(20)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
      { name: "test_date", conceptualType: "DateTime", logicalType: "DateTime", physicalType: "DATETIME", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 },
      { name: "defect_count", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 6 }
    ],
    "Inventory_Item": [
      { name: "item_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 1 },
      { name: "item_code", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(50)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
      { name: "item_description", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(200)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
      { name: "current_stock", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
      { name: "reorder_level", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 },
      { name: "unit_cost", conceptualType: "Decimal", logicalType: "Decimal", physicalType: "DECIMAL(10,2)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 6 },
      { name: "supplier_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 7 }
    ],
    "Supplier": [
      { name: "supplier_id", conceptualType: "Number", logicalType: "Integer", physicalType: "INTEGER", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 1 },
      { name: "supplier_name", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(100)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
      { name: "contact_email", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(100)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
      { name: "phone_number", conceptualType: "Text", logicalType: "String", physicalType: "VARCHAR(20)", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
      { name: "rating", conceptualType: "Decimal", logicalType: "Decimal", physicalType: "DECIMAL(3,2)", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 }
    ]
  };

  return attributeMap[objectName] || [];
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDataToAllLayers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { migrateDataToAllLayers };
