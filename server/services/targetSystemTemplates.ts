// Target System Templates - Predefined objects and attributes for different target systems
export interface TemplateObject {
  name: string;
  type: string;
  domainName: string;
  dataAreaName: string;
  sourceSystem: string;
  position: { x: number; y: number };
  attributes: TemplateAttribute[];
}

export interface TemplateAttribute {
  name: string;
  conceptualType: string;
  logicalType: string;
  physicalType: string;
  length?: number;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  orderIndex: number;
}

export interface TargetSystemTemplate {
  name: string;
  description: string;
  defaultDomains: string[];
  defaultDataAreas: { [domain: string]: string[] };
  objects: TemplateObject[];
}

// Template definitions for different target systems
export const TARGET_SYSTEM_TEMPLATES: { [key: string]: TargetSystemTemplate } = {
  "Data Lake": {
    name: "Data Lake",
    description: "Raw and processed data storage for analytics",
    defaultDomains: ["Customer", "Product", "Sales", "Operations"],
    defaultDataAreas: {
      "Customer": ["Demographics", "Behavior", "Segmentation"],
      "Product": ["Catalog", "Inventory", "Pricing"],
      "Sales": ["Transactions", "Revenue", "Performance"],
      "Operations": ["Logistics", "Supply Chain", "Quality"]
    },
    objects: [
      {
        name: "Customer",
        type: "Entity",
        domainName: "Customer",
        dataAreaName: "Demographics",
        sourceSystem: "CRM System",
        position: { x: 100, y: 100 },
        attributes: [
          { name: "CustomerId", conceptualType: "Identifier", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "FirstName", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "LastName", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "Email", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(255)", length: 255, nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "Phone", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(20)", length: 20, nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
          { name: "RegisterDate", conceptualType: "Date", logicalType: "DATE", physicalType: "DATE", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 }
        ]
      },
      {
        name: "Product",
        type: "Entity",
        domainName: "Product",
        dataAreaName: "Catalog",
        sourceSystem: "Product System",
        position: { x: 400, y: 100 },
        attributes: [
          { name: "ProductId", conceptualType: "Identifier", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "ProductName", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(200)", length: 200, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "Category", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "Price", conceptualType: "Currency", logicalType: "DECIMAL", physicalType: "DECIMAL(10,2)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "Description", conceptualType: "Text", logicalType: "TEXT", physicalType: "TEXT", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 }
        ]
      },
      {
        name: "Transaction",
        type: "Entity",
        domainName: "Sales",
        dataAreaName: "Transactions",
        sourceSystem: "Sales System",
        position: { x: 700, y: 100 },
        attributes: [
          { name: "TransactionId", conceptualType: "Identifier", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "CustomerId", conceptualType: "Reference", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 1 },
          { name: "ProductId", conceptualType: "Reference", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 2 },
          { name: "Quantity", conceptualType: "Number", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "Amount", conceptualType: "Currency", logicalType: "DECIMAL", physicalType: "DECIMAL(15,2)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
          { name: "TransactionDate", conceptualType: "Date", logicalType: "TIMESTAMP", physicalType: "TIMESTAMP", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 }
        ]
      }
    ]
  },
  "Data Warehouse": {
    name: "Data Warehouse",
    description: "Structured data for business intelligence and reporting",
    defaultDomains: ["Finance", "HR", "Sales", "Operations"],
    defaultDataAreas: {
      "Finance": ["Accounting", "Budgeting", "Revenue"],
      "HR": ["Employees", "Payroll", "Performance"],
      "Sales": ["Leads", "Opportunities", "Orders"],
      "Operations": ["Processes", "Quality", "Efficiency"]
    },
    objects: [
      {
        name: "DimEmployee",
        type: "Dimension",
        domainName: "HR",
        dataAreaName: "Employees",
        sourceSystem: "HR System",
        position: { x: 100, y: 100 },
        attributes: [
          { name: "EmployeeKey", conceptualType: "Identifier", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "EmployeeId", conceptualType: "Identifier", logicalType: "VARCHAR", physicalType: "VARCHAR(50)", length: 50, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "FirstName", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "LastName", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "Department", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
          { name: "Position", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 }
        ]
      },
      {
        name: "DimTime",
        type: "Dimension",
        domainName: "Operations",
        dataAreaName: "Processes",
        sourceSystem: "System Generated",
        position: { x: 400, y: 100 },
        attributes: [
          { name: "TimeKey", conceptualType: "Identifier", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "Date", conceptualType: "Date", logicalType: "DATE", physicalType: "DATE", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "Year", conceptualType: "Number", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "Quarter", conceptualType: "Number", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "Month", conceptualType: "Number", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
          { name: "Day", conceptualType: "Number", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 }
        ]
      },
      {
        name: "FactSales",
        type: "Fact",
        domainName: "Sales",
        dataAreaName: "Orders",
        sourceSystem: "Sales System",
        position: { x: 700, y: 100 },
        attributes: [
          { name: "SalesKey", conceptualType: "Identifier", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "EmployeeKey", conceptualType: "Reference", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 1 },
          { name: "TimeKey", conceptualType: "Reference", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 2 },
          { name: "SalesAmount", conceptualType: "Currency", logicalType: "DECIMAL", physicalType: "DECIMAL(15,2)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "Quantity", conceptualType: "Number", logicalType: "INTEGER", physicalType: "INT", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
          { name: "Commission", conceptualType: "Currency", logicalType: "DECIMAL", physicalType: "DECIMAL(10,2)", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 }
        ]
      }
    ]
  },
  "Operational Database": {
    name: "Operational Database",
    description: "Transactional system for day-to-day operations",
    defaultDomains: ["Users", "Orders", "Inventory", "Payments"],
    defaultDataAreas: {
      "Users": ["Authentication", "Profiles", "Permissions"],
      "Orders": ["Processing", "Fulfillment", "Returns"],
      "Inventory": ["Stock", "Tracking", "Procurement"],
      "Payments": ["Transactions", "Billing", "Refunds"]
    },
    objects: [
      {
        name: "User",
        type: "Entity",
        domainName: "Users",
        dataAreaName: "Authentication",
        sourceSystem: "Auth System",
        position: { x: 100, y: 100 },
        attributes: [
          { name: "UserId", conceptualType: "Identifier", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "Username", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "Email", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(255)", length: 255, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "PasswordHash", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(255)", length: 255, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "CreatedAt", conceptualType: "Date", logicalType: "TIMESTAMP", physicalType: "TIMESTAMP", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
          { name: "LastLogin", conceptualType: "Date", logicalType: "TIMESTAMP", physicalType: "TIMESTAMP", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 }
        ]
      },
      {
        name: "Order",
        type: "Entity",
        domainName: "Orders",
        dataAreaName: "Processing",
        sourceSystem: "Order System",
        position: { x: 400, y: 100 },
        attributes: [
          { name: "OrderId", conceptualType: "Identifier", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "UserId", conceptualType: "Reference", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 1 },
          { name: "Status", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(50)", length: 50, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "TotalAmount", conceptualType: "Currency", logicalType: "DECIMAL", physicalType: "DECIMAL(15,2)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "OrderDate", conceptualType: "Date", logicalType: "TIMESTAMP", physicalType: "TIMESTAMP", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 }
        ]
      },
      {
        name: "Payment",
        type: "Entity",
        domainName: "Payments",
        dataAreaName: "Transactions",
        sourceSystem: "Payment Gateway",
        position: { x: 700, y: 100 },
        attributes: [
          { name: "PaymentId", conceptualType: "Identifier", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "OrderId", conceptualType: "Reference", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: false, isForeignKey: true, orderIndex: 1 },
          { name: "Method", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(50)", length: 50, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "Amount", conceptualType: "Currency", logicalType: "DECIMAL", physicalType: "DECIMAL(15,2)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "Status", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(50)", length: 50, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 },
          { name: "ProcessedAt", conceptualType: "Date", logicalType: "TIMESTAMP", physicalType: "TIMESTAMP", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 5 }
        ]
      }
    ]
  },
  "Analytics Platform": {
    name: "Analytics Platform",
    description: "Advanced analytics and machine learning data structures",
    defaultDomains: ["Metrics", "Events", "Features", "Models"],
    defaultDataAreas: {
      "Metrics": ["Performance", "Usage", "Quality"],
      "Events": ["User Actions", "System Events", "Business Events"],
      "Features": ["Engineering", "Selection", "Storage"],
      "Models": ["Training", "Inference", "Evaluation"]
    },
    objects: [
      {
        name: "UserEvent",
        type: "Event",
        domainName: "Events",
        dataAreaName: "User Actions",
        sourceSystem: "Analytics System",
        position: { x: 100, y: 100 },
        attributes: [
          { name: "EventId", conceptualType: "Identifier", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "UserId", conceptualType: "Reference", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "EventType", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "Properties", conceptualType: "Text", logicalType: "JSON", physicalType: "JSON", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "Timestamp", conceptualType: "Date", logicalType: "TIMESTAMP", physicalType: "TIMESTAMP", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 }
        ]
      },
      {
        name: "FeatureStore",
        type: "Feature",
        domainName: "Features",
        dataAreaName: "Storage",
        sourceSystem: "ML Platform",
        position: { x: 400, y: 100 },
        attributes: [
          { name: "FeatureId", conceptualType: "Identifier", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "EntityId", conceptualType: "Reference", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "FeatureName", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(200)", length: 200, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "FeatureValue", conceptualType: "Number", logicalType: "DECIMAL", physicalType: "DECIMAL(20,6)", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "ComputedAt", conceptualType: "Date", logicalType: "TIMESTAMP", physicalType: "TIMESTAMP", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 }
        ]
      },
      {
        name: "ModelMetrics",
        type: "Metric",
        domainName: "Models",
        dataAreaName: "Evaluation",
        sourceSystem: "ML Platform",
        position: { x: 700, y: 100 },
        attributes: [
          { name: "MetricId", conceptualType: "Identifier", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "ModelId", conceptualType: "Reference", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "MetricType", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "MetricValue", conceptualType: "Number", logicalType: "DECIMAL", physicalType: "DECIMAL(10,6)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "EvaluatedAt", conceptualType: "Date", logicalType: "TIMESTAMP", physicalType: "TIMESTAMP", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 }
        ]
      }
    ]
  },
  "Reporting System": {
    name: "Reporting System",
    description: "Business reporting and dashboard data structures",
    defaultDomains: ["Reports", "Dashboards", "KPIs", "Alerts"],
    defaultDataAreas: {
      "Reports": ["Financial", "Operational", "Compliance"],
      "Dashboards": ["Executive", "Department", "Real-time"],
      "KPIs": ["Performance", "Growth", "Efficiency"],
      "Alerts": ["Thresholds", "Anomalies", "Notifications"]
    },
    objects: [
      {
        name: "Report",
        type: "Report",
        domainName: "Reports",
        dataAreaName: "Financial",
        sourceSystem: "Reporting Engine",
        position: { x: 100, y: 100 },
        attributes: [
          { name: "ReportId", conceptualType: "Identifier", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "ReportName", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(200)", length: 200, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "Category", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(100)", length: 100, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "Parameters", conceptualType: "Text", logicalType: "JSON", physicalType: "JSON", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "GeneratedAt", conceptualType: "Date", logicalType: "TIMESTAMP", physicalType: "TIMESTAMP", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 }
        ]
      },
      {
        name: "Dashboard",
        type: "Dashboard",
        domainName: "Dashboards",
        dataAreaName: "Executive",
        sourceSystem: "BI Platform",
        position: { x: 400, y: 100 },
        attributes: [
          { name: "DashboardId", conceptualType: "Identifier", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "DashboardName", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(200)", length: 200, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "Layout", conceptualType: "Text", logicalType: "JSON", physicalType: "JSON", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "RefreshInterval", conceptualType: "Number", logicalType: "INTEGER", physicalType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "CreatedAt", conceptualType: "Date", logicalType: "TIMESTAMP", physicalType: "TIMESTAMP", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 }
        ]
      },
      {
        name: "KPIMetric",
        type: "KPI",
        domainName: "KPIs",
        dataAreaName: "Performance",
        sourceSystem: "KPI Engine",
        position: { x: 700, y: 100 },
        attributes: [
          { name: "KPIId", conceptualType: "Identifier", logicalType: "VARCHAR", physicalType: "VARCHAR(36)", length: 36, nullable: false, isPrimaryKey: true, isForeignKey: false, orderIndex: 0 },
          { name: "KPIName", conceptualType: "Text", logicalType: "VARCHAR", physicalType: "VARCHAR(200)", length: 200, nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 1 },
          { name: "CurrentValue", conceptualType: "Number", logicalType: "DECIMAL", physicalType: "DECIMAL(15,4)", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 2 },
          { name: "TargetValue", conceptualType: "Number", logicalType: "DECIMAL", physicalType: "DECIMAL(15,4)", nullable: true, isPrimaryKey: false, isForeignKey: false, orderIndex: 3 },
          { name: "MeasurementDate", conceptualType: "Date", logicalType: "DATE", physicalType: "DATE", nullable: false, isPrimaryKey: false, isForeignKey: false, orderIndex: 4 }
        ]
      }
    ]
  }
};

// Helper function to get template by target system
export function getTargetSystemTemplate(targetSystem: string): TargetSystemTemplate | null {
  return TARGET_SYSTEM_TEMPLATES[targetSystem] || null;
}

// Helper function to get all available target systems
export function getAvailableTargetSystems(): string[] {
  return Object.keys(TARGET_SYSTEM_TEMPLATES);
}