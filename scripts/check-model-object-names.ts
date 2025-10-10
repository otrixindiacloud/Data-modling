import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema.js';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function checkModelObjectNames() {
  const modelObjects = await db.select({
    id: schema.dataModelObjects.id,
    objectId: schema.dataModelObjects.objectId,
    name: schema.dataModelObjects.name,
    description: schema.dataModelObjects.description,
    objectType: schema.dataModelObjects.objectType
  })
  .from(schema.dataModelObjects)
  .limit(10);

  console.log('Data Model Objects:');
  console.log(JSON.stringify(modelObjects, null, 2));
}

checkModelObjectNames().catch(console.error);
