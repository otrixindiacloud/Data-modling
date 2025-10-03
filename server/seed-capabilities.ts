import { db } from "./db";
import { businessCapabilities, capabilityDataDomainMappings, dataDomains, type DataDomain } from "@shared/schema";

export async function seedCapabilities() {
  console.log("🌱 Seeding business capabilities...");

  try {
    // First, let's get existing domains
    const domains = await db.select().from(dataDomains);
    console.log("Found domains:", domains.map((d: DataDomain) => d.name));

    // Clear existing capability data
    try {
      await db.delete(capabilityDataDomainMappings);
      await db.delete(businessCapabilities);
    } catch (e) {
      console.log("No existing capability data to clear");
    }

    // Seed a few basic capabilities
    const [strategicCap, operationalCap] = await db.insert(businessCapabilities).values([
      {
        name: "Strategic Management",
        code: "STRATEGIC",
        description: "Strategic planning and governance",
        level: 1,
        parentId: null,
        sortOrder: 1,
        colorCode: "#8B5CF6",
        icon: "target",
        isStandard: true,
        criticality: "high"
      },
      {
        name: "Operational Excellence",
        code: "OPERATIONAL", 
        description: "Core operational capabilities",
        level: 1,
        parentId: null,
        sortOrder: 2,
        colorCode: "#3B82F6",
        icon: "operations",
        isStandard: true,
        criticality: "critical"
      }
    ]).returning();

    // Add some sub-capabilities
    const [production, quality] = await db.insert(businessCapabilities).values([
      {
        name: "Production & Manufacturing",
        code: "PRODUCTION",
        description: "Manufacturing operations and execution",
        level: 2,
        parentId: operationalCap.id,
        sortOrder: 1,
        colorCode: "#EF4444",
        icon: "production",
        isStandard: true,
        criticality: "critical",
        maturityLevel: "managed"
      },
      {
        name: "Quality Management",
        code: "QUALITY",
        description: "Quality assurance and control",
        level: 2,
        parentId: operationalCap.id,
        sortOrder: 2,
        colorCode: "#06B6D4",
        icon: "quality",
        isStandard: true,
        criticality: "critical",
        maturityLevel: "managed"
      }
    ]).returning();

    // Map to existing domains if they exist
    if (domains.length > 0) {
      const manufacturingDomain = domains.find((d: DataDomain) => d.name.includes('Manufacturing') || d.name.includes('Operations'));
      if (manufacturingDomain) {
        await db.insert(capabilityDataDomainMappings).values([
          {
            capabilityId: production.id,
            domainId: manufacturingDomain.id,
            mappingType: "primary",
            importance: "high"
          }
        ]);
      }
    }

    console.log("✅ Business capabilities seeded successfully!");
    console.log(`- Created ${2} top-level capabilities`);
    console.log(`- Created ${2} sub-capabilities`);
    
  } catch (error) {
    console.error("❌ Error seeding capabilities:", error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCapabilities()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}