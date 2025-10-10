import { db } from '../server/db';
import { dataModelObjects, dataModelAttributes, systems as systemsTable, dataDomains, dataAreas } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testCanvasEndpoint() {
  try {
    const modelId = 74;
    
    // Fetch model objects
    const objects = await db.select().from(dataModelObjects).where(eq(dataModelObjects.modelId, modelId));
    console.log(`\nFound ${objects.length} objects for model ${modelId}`);
    
    for (const obj of objects) {
      console.log(`\n===== Object: ${obj.name} (ID: ${obj.id}) =====`);
      console.log(`Domain ID: ${obj.domainId}`);
      console.log(`Data Area ID: ${obj.dataAreaId}`);
      console.log(`Source System ID: ${obj.sourceSystemId}`);
      console.log(`Target System ID: ${obj.targetSystemId}`);
      
      // Fetch related data
      if (obj.domainId) {
        const domain = await db.select().from(dataDomains).where(eq(dataDomains.id, obj.domainId));
        console.log(`Domain Name: ${domain[0]?.name || 'NOT FOUND'}`);
      } else {
        console.log('Domain Name: NULL');
      }
      
      if (obj.dataAreaId) {
        const dataArea = await db.select().from(dataAreas).where(eq(dataAreas.id, obj.dataAreaId));
        console.log(`Data Area Name: ${dataArea[0]?.name || 'NOT FOUND'}`);
      } else {
        console.log('Data Area Name: NULL');
      }
      
      if (obj.sourceSystemId) {
        const system = await db.select().from(systemsTable).where(eq(systemsTable.id, obj.sourceSystemId));
        console.log(`Source System Name: ${system[0]?.name || 'NOT FOUND'}`);
      } else {
        console.log('Source System Name: NULL');
      }
      
      if (obj.targetSystemId) {
        const system = await db.select().from(systemsTable).where(eq(systemsTable.id, obj.targetSystemId));
        console.log(`Target System Name: ${system[0]?.name || 'NOT FOUND'}`);
      } else {
        console.log('Target System Name: NULL');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testCanvasEndpoint();
