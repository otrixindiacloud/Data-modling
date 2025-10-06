-- Ensure data_object_relationships table exists for storing global relationships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'data_object_relationships'
  ) THEN
    CREATE TABLE "data_object_relationships" (
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
  END IF;
END $$;

-- Refresh foreign key constraints to match latest schema naming
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'data_object_relationships_source_data_object_id_data_objects_id_fk'
  ) THEN
    ALTER TABLE "data_object_relationships"
      DROP CONSTRAINT "data_object_relationships_source_data_object_id_data_objects_id_fk";
  END IF;

  ALTER TABLE "data_object_relationships"
    ADD CONSTRAINT "data_object_relationships_source_data_object_id_data_objects_id_fk"
      FOREIGN KEY ("source_data_object_id")
      REFERENCES "data_objects"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'data_object_relationships_target_data_object_id_data_objects_id_fk'
  ) THEN
    ALTER TABLE "data_object_relationships"
      DROP CONSTRAINT "data_object_relationships_target_data_object_id_data_objects_id_fk";
  END IF;

  ALTER TABLE "data_object_relationships"
    ADD CONSTRAINT "data_object_relationships_target_data_object_id_data_objects_id_fk"
      FOREIGN KEY ("target_data_object_id")
      REFERENCES "data_objects"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'data_object_relationships_source_attribute_id_data_object_attributes_id_fk'
  ) THEN
    ALTER TABLE "data_object_relationships"
      DROP CONSTRAINT "data_object_relationships_source_attribute_id_data_object_attributes_id_fk";
  END IF;

  ALTER TABLE "data_object_relationships"
    ADD CONSTRAINT "data_object_relationships_source_attribute_id_data_object_attributes_id_fk"
      FOREIGN KEY ("source_attribute_id")
      REFERENCES "data_object_attributes"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'data_object_relationships_target_attribute_id_data_object_attributes_id_fk'
  ) THEN
    ALTER TABLE "data_object_relationships"
      DROP CONSTRAINT "data_object_relationships_target_attribute_id_data_object_attributes_id_fk";
  END IF;

  ALTER TABLE "data_object_relationships"
    ADD CONSTRAINT "data_object_relationships_target_attribute_id_data_object_attributes_id_fk"
      FOREIGN KEY ("target_attribute_id")
      REFERENCES "data_object_attributes"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
END $$;
