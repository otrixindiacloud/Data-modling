import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import Database from 'better-sqlite3';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import ws from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@shared/schema";

// Use PostgreSQL if DATABASE_URL is provided, otherwise use SQLite for local development
const usePostgreSQL = !!process.env.DATABASE_URL;

let db: any;
let pool: any = null;

if (usePostgreSQL) {
  // Use PostgreSQL when DATABASE_URL is provided
  neonConfig.webSocketConstructor = ws;

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set for PostgreSQL. Did you forget to provision a database?",
    );
  }

  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

export { db, pool };
