-- Migration: Rename data_model_attributes to data_model_object_attributes
-- This makes the naming more consistent with the data model hierarchy

-- Step 1: Rename the table
ALTER TABLE data_model_attributes RENAME TO data_model_object_attributes;

-- Step 2: Rename all foreign key constraints
ALTER TABLE data_model_object_attributes 
  RENAME CONSTRAINT data_model_attributes_attribute_id_data_object_attributes_id_fk 
  TO data_model_object_attributes_attribute_id_data_object_attributes_id_fk;

ALTER TABLE data_model_object_attributes 
  RENAME CONSTRAINT data_model_attributes_model_object_id_data_model_objects_id_fk 
  TO data_model_object_attributes_model_object_id_data_model_objects_id_fk;

ALTER TABLE data_model_object_attributes 
  RENAME CONSTRAINT data_model_attributes_model_id_data_models_id_fk 
  TO data_model_object_attributes_model_id_data_models_id_fk;

-- Step 3: Rename foreign key constraints in data_model_object_relationships table
ALTER TABLE data_model_object_relationships 
  RENAME CONSTRAINT data_model_object_relationships_source_attribute_id_data_model_attributes_id_fk 
  TO data_model_object_relationships_source_attribute_id_data_model_object_attributes_id_fk;

ALTER TABLE data_model_object_relationships 
  RENAME CONSTRAINT data_model_object_relationships_target_attribute_id_data_model_attributes_id_fk 
  TO data_model_object_relationships_target_attribute_id_data_model_object_attributes_id_fk;

-- Step 4: Rename indexes
ALTER INDEX IF EXISTS idx_data_model_attributes_name RENAME TO idx_data_model_object_attributes_name;

-- Step 5: Update comments
COMMENT ON TABLE data_model_object_attributes IS 'Attributes that belong to data model objects. Can be system-synced (with attributeId) or user-created (attributeId NULL).';
COMMENT ON COLUMN data_model_object_attributes.attribute_id IS 'References data_object_attributes for system-synced attributes only. NULL for user-created attributes.';
COMMENT ON COLUMN data_model_object_attributes.name IS 'Attribute name. Required for user-created attributes. Duplicated from attributes for system-synced attributes.';
