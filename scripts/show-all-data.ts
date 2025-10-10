import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema.js';

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql, { schema });

async function showAllData() {
  console.log('=== DATA MODELS ===');
  const models = await db.select().from(schema.dataModels);
  console.log(JSON.stringify(models, null, 2));
  
  console.log('\n=== DATA MODEL LAYERS ===');
  const layers = await db.select().from(schema.dataModelLayers);
  console.log(JSON.stringify(layers, null, 2));
  
  console.log('\n=== DATA MODEL OBJECTS ===');
  const modelObjects = await db.select().from(schema.dataModelObjects);
  console.log(JSON.stringify(modelObjects, null, 2));
  
  console.log('\n=== DATA MODEL LAYER OBJECTS (mapping) ===');
  const layerObjects = await db.select().from(schema.dataModelLayerObjects);
  console.log(JSON.stringify(layerObjects, null, 2));
}

showAllData().catch(console.error);
