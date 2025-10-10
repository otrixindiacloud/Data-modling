-- Migration: Fix data_model_object_relationships.model_id foreign key
-- The model_id column should reference data_model_layers.id instead of data_models.id
-- since relationships are created at the layer level (conceptual, logical, physical)

-- Step 0: Update existing relationships to use layer model IDs
-- This maps parent data_models.id to their corresponding conceptual data_model_layers.id
UPDATE "data_model_object_relationships" r
SET "model_id" = (
  SELECT dl.id 
  FROM "data_model_layers" dl 
  WHERE dl."dataModelId" = r."model_id" 
    AND dl."layer" = 'conceptual'
  LIMIT 1
)
WHERE "model_id" IN (SELECT id FROM "data_models");

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE "data_model_object_relationships" 
DROP CONSTRAINT IF EXISTS "data_model_object_relationships_model_id_data_models_id_fk";

-- Step 2: Add new foreign key constraint pointing to data_model_layers
ALTER TABLE "data_model_object_relationships" 
ADD CONSTRAINT "data_model_object_relationships_model_id_data_model_layers_id_fk" 
FOREIGN KEY ("model_id") REFERENCES "data_model_layers"("id") ON DELETE CASCADE;
