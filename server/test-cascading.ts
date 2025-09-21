import { storage } from "./storage";

// Script to create test data models demonstrating logical -> physical cascading
async function createTestCascadingData() {
  console.log("Creating test data for logical -> physical cascading...");

  try {
    // Create conceptual model
    const conceptualModel = await storage.createDataModel({
      name: "Employee Management Model",
      layer: "conceptual",
      targetSystemId: null
    });

    console.log("Created conceptual model:", conceptualModel.id);

    // Create logical model as child of conceptual
    const logicalModel = await storage.createDataModel({
      name: "Employee Management Model - Logical",
      layer: "logical",
      targetSystemId: null,
      parentModelId: conceptualModel.id
    });

    console.log("Created logical model:", logicalModel.id);

    // Create physical model as child of logical
    const physicalModel = await storage.createDataModel({
      name: "Employee Management Model - Physical",
      layer: "physical",
      targetSystemId: null,
      parentModelId: logicalModel.id
    });

    console.log("Created physical model:", physicalModel.id);

    // Get HR domain
    const domains = await storage.getDataDomains();
    const hrDomain = domains.find(d => d.name === "Human Resources");
    
    if (!hrDomain) {
      throw new Error("HR domain not found");
    }

    // Create Employee object in conceptual layer
    const conceptualEmployee = await storage.createDataObject({
      name: "Employee",
      modelId: conceptualModel.id,
      domainId: hrDomain.id,
      position: { x: 200, y: 100 },
      sourceSystemId: null,
      targetSystemId: null,
      isNew: false
    });

    console.log("Created conceptual employee:", conceptualEmployee.id);

    // Create Employee object in logical layer
    const logicalEmployee = await storage.createDataObject({
      name: "Employee",
      modelId: logicalModel.id,
      domainId: hrDomain.id,
      position: { x: 200, y: 100 },
      sourceSystemId: null,
      targetSystemId: null,
      isNew: false
    });

    console.log("Created logical employee:", logicalEmployee.id);

    // Create Employee object in physical layer
    const physicalEmployee = await storage.createDataObject({
      name: "Employee",
      modelId: physicalModel.id,
      domainId: hrDomain.id,
      position: { x: 200, y: 100 },
      sourceSystemId: null,
      targetSystemId: null,
      isNew: false
    });

    console.log("Created physical employee:", physicalEmployee.id);

    // Create attributes in logical layer that should cascade to physical
    const logicalAttributes = [
      {
        name: "employee_id",
        objectId: logicalEmployee.id,
        conceptualType: "Number",
        logicalType: "Integer",
        isPrimaryKey: true,
        nullable: false,
        orderIndex: 1
      },
      {
        name: "first_name",
        objectId: logicalEmployee.id,
        conceptualType: "Text",
        logicalType: "String",
        isPrimaryKey: false,
        nullable: false,
        orderIndex: 2
      },
      {
        name: "last_name",
        objectId: logicalEmployee.id,
        conceptualType: "Text",
        logicalType: "String",
        isPrimaryKey: false,
        nullable: false,
        orderIndex: 3
      },
      {
        name: "email",
        objectId: logicalEmployee.id,
        conceptualType: "Text",
        logicalType: "Email",
        isPrimaryKey: false,
        nullable: false,
        orderIndex: 4
      },
      {
        name: "hire_date",
        objectId: logicalEmployee.id,
        conceptualType: "Date",
        logicalType: "Date",
        isPrimaryKey: false,
        nullable: false,
        orderIndex: 5
      },
      {
        name: "salary",
        objectId: logicalEmployee.id,
        conceptualType: "Number",
        logicalType: "Currency",
        isPrimaryKey: false,
        nullable: true,
        orderIndex: 6
      }
    ];

    // Create logical attributes (these should automatically cascade to physical)
    for (const attr of logicalAttributes) {
      const logicalAttr = await storage.createAttribute(attr);
      console.log(`Created logical attribute: ${logicalAttr.name}`);
    }

    // Create Department object in logical layer
    const logicalDepartment = await storage.createDataObject({
      name: "Department",
      modelId: logicalModel.id,
      domainId: hrDomain.id,
      position: { x: 500, y: 100 },
      sourceSystemId: null,
      targetSystemId: null,
      isNew: false
    });

    console.log("Created logical department:", logicalDepartment.id);

    // Create Department object in physical layer
    const physicalDepartment = await storage.createDataObject({
      name: "Department",
      modelId: physicalModel.id,
      domainId: hrDomain.id,
      position: { x: 500, y: 100 },
      sourceSystemId: null,
      targetSystemId: null,
      isNew: false
    });

    console.log("Created physical department:", physicalDepartment.id);

    // Create department attributes in logical layer
    const departmentAttributes = [
      {
        name: "department_id",
        objectId: logicalDepartment.id,
        conceptualType: "Number",
        logicalType: "Integer",
        isPrimaryKey: true,
        nullable: false,
        orderIndex: 1
      },
      {
        name: "department_name",
        objectId: logicalDepartment.id,
        conceptualType: "Text",
        logicalType: "String",
        isPrimaryKey: false,
        nullable: false,
        orderIndex: 2
      },
      {
        name: "manager_id",
        objectId: logicalDepartment.id,
        conceptualType: "Number",
        logicalType: "Integer",
        isPrimaryKey: false,
        nullable: true,
        isForeignKey: true,
        orderIndex: 3
      }
    ];

    // Create department attributes (these should automatically cascade to physical)
    for (const attr of departmentAttributes) {
      const logicalAttr = await storage.createAttribute(attr);
      console.log(`Created logical department attribute: ${logicalAttr.name}`);
    }

    console.log("\nTest data creation completed!");
    console.log("You now have:");
    console.log("- Conceptual model with Employee object");
    console.log("- Logical model with Employee and Department objects with attributes");
    console.log("- Physical model with corresponding objects and attributes");
    console.log("\nTry adding attributes to logical layer objects - they should automatically cascade to physical layer!");

  } catch (error) {
    console.error("Error creating test data:", error);
  }
}

// Run the test data creation
createTestCascadingData().catch(console.error);