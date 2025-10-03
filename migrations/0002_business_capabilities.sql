-- Business Capabilities Tables
CREATE TABLE IF NOT EXISTS "business_capabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"level" integer NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0,
	"color_code" text DEFAULT '#6366f1',
	"icon" text,
	"is_standard" boolean DEFAULT true,
	"maturity_level" text,
	"criticality" text DEFAULT 'medium',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_capabilities_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "capability_data_domain_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"capability_id" integer NOT NULL,
	"domain_id" integer NOT NULL,
	"mapping_type" text NOT NULL,
	"importance" text DEFAULT 'medium',
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "capability_data_area_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"capability_id" integer NOT NULL,
	"data_area_id" integer NOT NULL,
	"mapping_type" text NOT NULL,
	"importance" text DEFAULT 'medium',
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "capability_system_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"capability_id" integer NOT NULL,
	"system_id" integer NOT NULL,
	"mapping_type" text NOT NULL,
	"system_role" text NOT NULL,
	"coverage" text DEFAULT 'partial',
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "business_capabilities" ADD CONSTRAINT "business_capabilities_parent_id_business_capabilities_id_fk" FOREIGN KEY ("parent_id") REFERENCES "business_capabilities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "capability_data_domain_mappings" ADD CONSTRAINT "capability_data_domain_mappings_capability_id_business_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "business_capabilities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "capability_data_domain_mappings" ADD CONSTRAINT "capability_data_domain_mappings_domain_id_data_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "data_domains"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "capability_data_area_mappings" ADD CONSTRAINT "capability_data_area_mappings_capability_id_business_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "business_capabilities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "capability_data_area_mappings" ADD CONSTRAINT "capability_data_area_mappings_data_area_id_data_areas_id_fk" FOREIGN KEY ("data_area_id") REFERENCES "data_areas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "capability_system_mappings" ADD CONSTRAINT "capability_system_mappings_capability_id_business_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "business_capabilities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "capability_system_mappings" ADD CONSTRAINT "capability_system_mappings_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;