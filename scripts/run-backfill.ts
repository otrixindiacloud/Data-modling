import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema.js';

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql, { schema });

async function backfillNames() {
  console.log('Running backfill query...');
  
  const result = await db.execute(sql`
    UPDATE data_model_objects dmo
    SET 
      name = COALESCE(dmo.name, dobj.name),
      description = COALESCE(dmo.description, dobj.description),
      object_type = COALESCE(dmo.object_type, dobj.object_type),
      domain_id = COALESCE(dmo.domain_id, dobj.domain_id),
      data_area_id = COALESCE(dmo.data_area_id, dobj.data_area_id)
    FROM data_objects dobj
    WHERE dmo.object_id = dobj.id
      AND (dmo.name IS NULL OR dmo.description IS NULL OR dmo.object_type IS NULL)
  `);
  
  console.log('Backfill completed:', result);
  
  // Verify the update
  const updated = await db.select()
    .from(schema.dataModelObjects)
    .limit(5);
  
  console.log('\nUpdated data_model_objects:');
  console.log(JSON.stringify(updated, null, 2));
}

backfillNames().catch(console.error);
