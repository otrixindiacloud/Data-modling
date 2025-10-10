import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema.js';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function checkDataObjects() {
  // Check data_objects
  const dataObjects = await db.select()
    .from(schema.dataObjects)
    .where(eq(schema.dataObjects.id, 488));

  console.log('Data Object 488:');
  console.log(JSON.stringify(dataObjects, null, 2));

  // Check data_model_objects linking to it
  const modelObjects = await db.select()
    .from(schema.dataModelObjects)
    .where(eq(schema.dataModelObjects.objectId, 488));

  console.log('\nData Model Objects linking to object 488:');
  console.log(JSON.stringify(modelObjects, null, 2));
}

checkDataObjects().catch(console.error);
