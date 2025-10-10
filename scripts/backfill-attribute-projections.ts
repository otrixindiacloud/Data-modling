/**
 * Backfill missing data_model_object_attributes for objects that have canonical attributes
 * but no projection records in logical/physical layers
 * 
 * This script finds all data_model_objects that:
 * 1. Link to a data_object (object_id IS NOT NULL)
 * 2. That data_object has attributes in data_object_attributes
 * 3. But no corresponding data_model_object_attributes exist for that model_object
 * 
 * Then creates the missing projection records.
 */

import { db } from "../server/db";
import { 
  dataModelObjects, 
  dataModelLayers,
  dataObjects,
  attributes,  // Canonical attributes table is named "attributes"
  dataModelObjectAttributes 
} from "../shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";

async function backfillAttributeProjections() {
  if (!db) {
    throw new Error("Database connection not available");
  }

  console.log("🔍 Finding objects with missing attribute projections...\n");

  // Get all model objects in logical/physical layers that link to data_objects
  const modelObjects = await db
    .select({
      modelObjectId: dataModelObjects.id,
      modelObjectName: dataModelObjects.name,
      modelId: dataModelObjects.modelId,
      objectId: dataModelObjects.objectId,
      targetSystemId: dataModelObjects.targetSystemId,
      layer: dataModelLayers.layer,
    })
    .from(dataModelObjects)
    .innerJoin(dataModelLayers, eq(dataModelObjects.modelId, dataModelLayers.id))
    .where(
      and(
        isNotNull(dataModelObjects.objectId),
        // Only logical and physical layers (conceptual doesn't show attributes in the same way)
      )
    );

  const logicalPhysicalObjects = modelObjects.filter(
    obj => obj.layer === 'logical' || obj.layer === 'physical'
  );

  console.log(`Found ${logicalPhysicalObjects.length} model objects in logical/physical layers`);

  let totalCreated = 0;
  let objectsProcessed = 0;

  for (const modelObj of logicalPhysicalObjects) {
    if (!modelObj.objectId) continue;

    // Check if projection attributes already exist
    const existingProjections = await db
      .select()
      .from(dataModelObjectAttributes)
      .where(
        and(
          eq(dataModelObjectAttributes.modelObjectId, modelObj.modelObjectId),
          eq(dataModelObjectAttributes.modelId, modelObj.modelId)
        )
      );

    if (existingProjections.length > 0) {
      // Already has projections, skip
      continue;
    }

    // Get canonical attributes for this data_object
    const canonicalAttributes = await db
      .select()
      .from(attributes)
      .where(eq(attributes.objectId, modelObj.objectId))
      .orderBy(attributes.orderIndex);

    if (canonicalAttributes.length === 0) {
      // No canonical attributes to project
      continue;
    }

    console.log(`\n📦 Processing: ${modelObj.modelObjectName} (${modelObj.layer} layer)`);
    console.log(`   Object ID: ${modelObj.objectId}, Model Object ID: ${modelObj.modelObjectId}`);
    console.log(`   Found ${canonicalAttributes.length} canonical attributes to project`);

    // Create projection attributes
    let created = 0;
    for (const canonicalAttr of canonicalAttributes) {
      try {
        await db.insert(dataModelObjectAttributes).values({
          attributeId: canonicalAttr.id,
          modelObjectId: modelObj.modelObjectId,
          modelId: modelObj.modelId,
          name: canonicalAttr.name,
          description: canonicalAttr.description,
          dataType: canonicalAttr.dataType,
          conceptualType: canonicalAttr.conceptualType,
          logicalType: canonicalAttr.logicalType,
          physicalType: canonicalAttr.physicalType,
          length: canonicalAttr.length,
          precision: canonicalAttr.precision,
          scale: canonicalAttr.scale,
          nullable: canonicalAttr.nullable,
          isPrimaryKey: canonicalAttr.isPrimaryKey,
          isForeignKey: canonicalAttr.isForeignKey,
          orderIndex: canonicalAttr.orderIndex,
          layerSpecificConfig: {},
        });
        created++;
      } catch (err: any) {
        console.error(`   ❌ Error creating projection for attribute ${canonicalAttr.name}:`, err.message);
      }
    }

    console.log(`   ✅ Created ${created} attribute projections`);
    totalCreated += created;
    objectsProcessed++;
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`   Objects processed: ${objectsProcessed}`);
  console.log(`   Total attribute projections created: ${totalCreated}`);
}

backfillAttributeProjections()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Error:", err);
    process.exit(1);
  });
