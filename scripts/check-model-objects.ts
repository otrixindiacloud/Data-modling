import { db } from '../server/db';
import { dataModelObjects } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function checkModelObjects() {
  try {
    const objects = await db.select().from(dataModelObjects).where(eq(dataModelObjects.modelId, 74));
    console.log('Objects in model 74:', JSON.stringify(objects, null, 2));
    console.log('\nTotal objects:', objects.length);
    
    if (objects.length > 0) {
      const firstObject = objects[0];
      console.log('\nFirst object details:');
      console.log('- ID:', firstObject.id);
      console.log('- Name:', firstObject.name);
      console.log('- Domain ID:', firstObject.domainId);
      console.log('- Data Area ID:', firstObject.dataAreaId);
      console.log('- Source System ID:', firstObject.sourceSystemId);
      console.log('- Target System ID:', firstObject.targetSystemId);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkModelObjects();
