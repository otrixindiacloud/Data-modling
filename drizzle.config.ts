import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: "postgresql://neondb_owner:npg_m1ZsUEONL9wb@ep-wandering-dew-aff22m1q.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require",
  },
});
