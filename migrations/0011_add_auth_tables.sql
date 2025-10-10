-- Add authentication and multi-tenant tables

BEGIN;

-- Organizations table
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id"),
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "name" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "is_super_admin" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Memberships table (many-to-many between users and organizations)
CREATE TABLE IF NOT EXISTS "memberships" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id"),
  "role" TEXT NOT NULL,
  "invited_by_user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Unique constraint on user_id + organization_id
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_user_org_unique" ON "memberships"("user_id", "organization_id");

-- Invitations table
CREATE TABLE IF NOT EXISTS "invitations" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id"),
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "invited_by_user_id" INTEGER REFERENCES "users"("id"),
  "accepted" BOOLEAN DEFAULT false,
  "expires_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMIT;
