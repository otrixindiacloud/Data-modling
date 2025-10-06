import "dotenv/config";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString });
  await client.connect();

  const tableFilter = process.argv[2]?.toLowerCase();

  const result = await client.query(`
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      array_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS columns,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      array_agg(ccu.column_name ORDER BY kcu.ordinal_position) AS foreign_columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    GROUP BY
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      ccu.table_schema,
      ccu.table_name
    ORDER BY tc.table_schema, tc.table_name, tc.constraint_name;
  `);

  const rows = tableFilter
    ? result.rows.filter((row) =>
        `${row.table_schema}.${row.table_name}`.toLowerCase().includes(tableFilter) ||
        row.table_name.toLowerCase().includes(tableFilter),
      )
    : result.rows;

  console.log(JSON.stringify(rows, null, 2));
  console.log(`Total foreign keys: ${rows.length} (of ${result.rowCount})`);

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
