-- Rename attributes table to data_object_attributes for clarity and alignment
ALTER TABLE "attributes" RENAME TO "data_object_attributes";

-- Rename sequence to match new table name and ensure ownership
ALTER SEQUENCE IF EXISTS "attributes_id_seq" RENAME TO "data_object_attributes_id_seq";
ALTER SEQUENCE "data_object_attributes_id_seq"
  OWNED BY "data_object_attributes"."id";

-- Update foreign key constraint names referencing the old table name
DO $$ BEGIN
  ALTER TABLE "data_model_attributes"
    RENAME CONSTRAINT "data_model_attributes_attribute_id_attributes_id_fk"
    TO "data_model_attributes_attribute_id_data_object_attributes_id_fk";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "data_object_relationships"
    RENAME CONSTRAINT "data_object_relationships_source_attribute_id_attributes_id_fk"
    TO "data_object_relationships_source_attribute_id_data_object_attributes_id_fk";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "data_object_relationships"
    RENAME CONSTRAINT "data_object_relationships_target_attribute_id_attributes_id_fk"
    TO "data_object_relationships_target_attribute_id_data_object_attributes_id_fk";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;