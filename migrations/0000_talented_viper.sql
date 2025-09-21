CREATE TABLE "attributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"object_id" integer NOT NULL,
	"conceptual_type" text,
	"logical_type" text,
	"physical_type" text,
	"length" integer,
	"precision" integer,
	"scale" integer,
	"nullable" boolean DEFAULT true,
	"is_primary_key" boolean DEFAULT false,
	"is_foreign_key" boolean DEFAULT false,
	"order_index" integer DEFAULT 0,
	"is_new" boolean DEFAULT false,
	"common_properties" jsonb,
	"description" text,
	"data_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "color_themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_color" text NOT NULL,
	"palette" jsonb NOT NULL,
	"is_system_theme" boolean DEFAULT false,
	"is_active" boolean DEFAULT false,
	"model_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain_id" integer NOT NULL,
	"description" text,
	"color_code" text DEFAULT '#10b981'
);
--> statement-breakpoint
CREATE TABLE "data_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color_code" text DEFAULT '#3b82f6',
	CONSTRAINT "data_domains_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "data_model_attributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"attribute_id" integer NOT NULL,
	"model_object_id" integer NOT NULL,
	"model_id" integer NOT NULL,
	"conceptual_type" text,
	"logical_type" text,
	"physical_type" text,
	"nullable" boolean DEFAULT true,
	"is_primary_key" boolean DEFAULT false,
	"is_foreign_key" boolean DEFAULT false,
	"order_index" integer DEFAULT 0,
	"layer_specific_config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_model_objects" (
	"id" serial PRIMARY KEY NOT NULL,
	"object_id" integer NOT NULL,
	"model_id" integer NOT NULL,
	"target_system_id" integer,
	"position" jsonb,
	"metadata" jsonb,
	"is_visible" boolean DEFAULT true,
	"layer_specific_config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_model_properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"model_id" integer NOT NULL,
	"property_name" text NOT NULL,
	"property_value" jsonb,
	"property_type" text NOT NULL,
	"layer" text,
	"description" text,
	"is_system_property" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"layer" text NOT NULL,
	"parent_model_id" integer,
	"target_system_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_objects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"model_id" integer NOT NULL,
	"domain_id" integer,
	"data_area_id" integer,
	"source_system_id" integer,
	"target_system_id" integer,
	"position" jsonb,
	"metadata" jsonb,
	"is_new" boolean DEFAULT false,
	"common_properties" jsonb,
	"description" text,
	"object_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_color_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"theme_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"color_value" text NOT NULL,
	"color_role" text NOT NULL,
	"auto_generated" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_model_object_id" integer NOT NULL,
	"target_model_object_id" integer NOT NULL,
	"type" text NOT NULL,
	"relationship_level" text NOT NULL,
	"source_attribute_id" integer,
	"target_attribute_id" integer,
	"model_id" integer NOT NULL,
	"layer" text NOT NULL,
	"name" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "systems" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"connection_string" text,
	"configuration" jsonb,
	"status" text DEFAULT 'disconnected',
	"color_code" text DEFAULT '#6366f1',
	"can_be_source" boolean DEFAULT true,
	"can_be_target" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "systems_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_object_id_data_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."data_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "color_themes" ADD CONSTRAINT "color_themes_model_id_data_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."data_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_areas" ADD CONSTRAINT "data_areas_domain_id_data_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."data_domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_model_attributes" ADD CONSTRAINT "data_model_attributes_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_model_attributes" ADD CONSTRAINT "data_model_attributes_model_object_id_data_model_objects_id_fk" FOREIGN KEY ("model_object_id") REFERENCES "public"."data_model_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_model_attributes" ADD CONSTRAINT "data_model_attributes_model_id_data_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."data_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_model_objects" ADD CONSTRAINT "data_model_objects_object_id_data_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."data_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_model_objects" ADD CONSTRAINT "data_model_objects_model_id_data_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."data_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_model_objects" ADD CONSTRAINT "data_model_objects_target_system_id_systems_id_fk" FOREIGN KEY ("target_system_id") REFERENCES "public"."systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_model_properties" ADD CONSTRAINT "data_model_properties_model_id_data_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."data_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_models" ADD CONSTRAINT "data_models_target_system_id_systems_id_fk" FOREIGN KEY ("target_system_id") REFERENCES "public"."systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_objects" ADD CONSTRAINT "data_objects_model_id_data_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."data_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_objects" ADD CONSTRAINT "data_objects_domain_id_data_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."data_domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_objects" ADD CONSTRAINT "data_objects_data_area_id_data_areas_id_fk" FOREIGN KEY ("data_area_id") REFERENCES "public"."data_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_objects" ADD CONSTRAINT "data_objects_source_system_id_systems_id_fk" FOREIGN KEY ("source_system_id") REFERENCES "public"."systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_objects" ADD CONSTRAINT "data_objects_target_system_id_systems_id_fk" FOREIGN KEY ("target_system_id") REFERENCES "public"."systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_color_assignments" ADD CONSTRAINT "entity_color_assignments_theme_id_color_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."color_themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_source_model_object_id_data_model_objects_id_fk" FOREIGN KEY ("source_model_object_id") REFERENCES "public"."data_model_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_target_model_object_id_data_model_objects_id_fk" FOREIGN KEY ("target_model_object_id") REFERENCES "public"."data_model_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_source_attribute_id_data_model_attributes_id_fk" FOREIGN KEY ("source_attribute_id") REFERENCES "public"."data_model_attributes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_target_attribute_id_data_model_attributes_id_fk" FOREIGN KEY ("target_attribute_id") REFERENCES "public"."data_model_attributes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_model_id_data_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."data_models"("id") ON DELETE no action ON UPDATE no action;