-- Rename existing relationships table to data_model_object_relationships
ALTER TABLE "relationships" RENAME TO "data_model_object_relationships";

-- Rename sequence generated for the primary key to match new table name
ALTER SEQUENCE IF EXISTS "relationships_id_seq" RENAME TO "data_model_object_relationships_id_seq";

-- Ensure the renamed sequence is still owned by the primary key column
ALTER SEQUENCE "data_model_object_relationships_id_seq"
  OWNED BY "data_model_object_relationships"."id";

-- Rename foreign key constraints to reflect new table name
ALTER TABLE "data_model_object_relationships"
  RENAME CONSTRAINT "relationships_source_model_object_id_data_model_objects_id_fk"
  TO "data_model_object_relationships_source_model_object_id_data_model_objects_id_fk";

ALTER TABLE "data_model_object_relationships"
  RENAME CONSTRAINT "relationships_target_model_object_id_data_model_objects_id_fk"
  TO "data_model_object_relationships_target_model_object_id_data_model_objects_id_fk";

ALTER TABLE "data_model_object_relationships"
  RENAME CONSTRAINT "relationships_source_attribute_id_data_model_attributes_id_fk"
  TO "data_model_object_relationships_source_attribute_id_data_model_attributes_id_fk";

ALTER TABLE "data_model_object_relationships"
  RENAME CONSTRAINT "relationships_target_attribute_id_data_model_attributes_id_fk"
  TO "data_model_object_relationships_target_attribute_id_data_model_attributes_id_fk";

ALTER TABLE "data_model_object_relationships"
  RENAME CONSTRAINT "relationships_model_id_data_models_id_fk"
  TO "data_model_object_relationships_model_id_data_models_id_fk";

-- Create new table for global data object relationships
CREATE TABLE IF NOT EXISTS "data_object_relationships" (
  "id" serial PRIMARY KEY NOT NULL,
  "source_data_object_id" integer NOT NULL,
  "target_data_object_id" integer NOT NULL,
  "type" text NOT NULL,
  "relationship_level" text DEFAULT 'object' NOT NULL,
  "source_attribute_id" integer,
  "target_attribute_id" integer,
  "name" text,
  "description" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints for the new table
ALTER TABLE "data_object_relationships"
  ADD CONSTRAINT "data_object_relationships_source_data_object_id_data_objects_id_fk"
    FOREIGN KEY ("source_data_object_id") REFERENCES "data_objects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "data_object_relationships"
  ADD CONSTRAINT "data_object_relationships_target_data_object_id_data_objects_id_fk"
    FOREIGN KEY ("target_data_object_id") REFERENCES "data_objects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "data_object_relationships"
  ADD CONSTRAINT "data_object_relationships_source_attribute_id_attributes_id_fk"
    FOREIGN KEY ("source_attribute_id") REFERENCES "attributes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "data_object_relationships"
  ADD CONSTRAINT "data_object_relationships_target_attribute_id_attributes_id_fk"
    FOREIGN KEY ("target_attribute_id") REFERENCES "attributes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
