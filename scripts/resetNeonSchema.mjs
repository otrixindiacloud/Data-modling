import 'dotenv/config';
import pkg from 'pg';

const { Client } = pkg;

async function resetSchema() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query('SELECT current_user');
    const currentUser = rows[0]?.current_user;

    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    if (currentUser) {
      await client.query(`GRANT ALL ON SCHEMA public TO "${currentUser}";`);
    }
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('Public schema reset successfully.');
  } finally {
    await client.end();
  }
}

resetSchema().catch((error) => {
  console.error('Failed to reset schema:', error);
  process.exit(1);
});
