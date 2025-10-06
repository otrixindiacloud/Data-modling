-- Add source_handle and target_handle columns to data_model_object_relationships table
-- These fields store React Flow handle IDs to preserve edge connection points

ALTER TABLE "data_model_object_relationships" 
ADD COLUMN IF NOT EXISTS "source_handle" text,
ADD COLUMN IF NOT EXISTS "target_handle" text;

-- Add helpful comment
COMMENT ON COLUMN "data_model_object_relationships"."source_handle" IS 'React Flow source handle ID for preserving edge connection points';
COMMENT ON COLUMN "data_model_object_relationships"."target_handle" IS 'React Flow target handle ID for preserving edge connection points';
