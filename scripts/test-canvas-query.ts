import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema.js';

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql, { schema });

async function testCanvasQuery() {
  const modelId = 6; // The test model
  
  console.log(`Testing canvas query for model ${modelId}...\n`);
  
  // Get the model
  const model = await db.select()
    .from(schema.dataModels)
    .where(eq(schema.dataModels.id, modelId));
  
  console.log('Model:', JSON.stringify(model, null, 2));
  
  // Get the layers for this model
  const layers = await db.select()
    .from(schema.dataModelLayers)
    .where(eq(schema.dataModelLayers.dataModelId, modelId));
  
  console.log('\nLayers:', JSON.stringify(layers, null, 2));
  
  // Get objects through the mapping table for one layer
  if (layers.length > 0) {
    const layerId = layers[0].id;
    console.log(`\nGetting objects for layer ${layerId}...`);
    
    const layerObjects = await db.select({
      modelObject: schema.dataModelObjects,
      dataObject: schema.dataObjects
    })
    .from(schema.dataModelLayerObjects)
    .innerJoin(
      schema.dataModelObjects,
      eq(schema.dataModelLayerObjects.modelObjectId, schema.dataModelObjects.id)
    )
    .leftJoin(
      schema.dataObjects,
      eq(schema.dataModelObjects.objectId, schema.dataObjects.id)
    )
    .where(eq(schema.dataModelLayerObjects.layerId, layerId));
    
    console.log('\nLayer Objects:');
    console.log(JSON.stringify(layerObjects, null, 2));
  }
}

testCanvasQuery().catch(console.error);
