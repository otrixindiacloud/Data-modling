import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as PgPool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "@shared/schema";

const connectionString = process.env.DATABASE_URL;

let db: ReturnType<typeof drizzlePg> | ReturnType<typeof drizzleNeon> | null = null;
let pool: NeonPool | PgPool | null = null;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not defined. Set it to your Postgres connection string (for example, a Neon database) before running the server or seed scripts.",
  );
} else {
  const usesNeon = /neon\.tech/.test(connectionString) || connectionString.startsWith("postgresql://neon");

  if (usesNeon) {
    neonConfig.webSocketConstructor = ws;
    pool = new NeonPool({ connectionString });
    db = drizzleNeon(pool, { schema });
  } else {
    pool = new PgPool({ connectionString });
    db = drizzlePg(pool, { schema });
  }
}

export { db, pool };
