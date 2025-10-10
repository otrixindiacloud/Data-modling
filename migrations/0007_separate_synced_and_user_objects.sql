-- Migration: Separate System-Synced Objects from User-Created Objects
-- Purpose: Allow user-created objects to exist in data_model_objects without requiring data_objects entry
-- System Sync objects populate data_objects, user objects go directly to data_model_objects

-- Step 1: Add new fields to data_model_objects to store object definition
ALTER TABLE data_model_objects 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS object_type TEXT,
  ADD COLUMN IF NOT EXISTS domain_id INTEGER REFERENCES data_domains(id),
  ADD COLUMN IF NOT EXISTS data_area_id INTEGER REFERENCES data_areas(id),
  ADD COLUMN IF NOT EXISTS source_system_id INTEGER REFERENCES systems(id);

-- Step 2: Make objectId nullable (user-created objects won't have data_objects entry)
ALTER TABLE data_model_objects 
  ALTER COLUMN object_id DROP NOT NULL;

-- Step 3: Add constraint to ensure either objectId is set (system sync) OR name is set (user created)
ALTER TABLE data_model_objects 
  ADD CONSTRAINT check_object_source CHECK (
    (object_id IS NOT NULL) OR 
    (name IS NOT NULL)
  );

-- Step 4: Add new fields to data_model_attributes to store attribute definition
ALTER TABLE data_model_attributes 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS data_type TEXT,
  ADD COLUMN IF NOT EXISTS length INTEGER,
  ADD COLUMN IF NOT EXISTS precision INTEGER,
  ADD COLUMN IF NOT EXISTS scale INTEGER;

-- Step 5: Make attributeId nullable (user-created attributes won't have attributes entry)
ALTER TABLE data_model_attributes 
  ALTER COLUMN attribute_id DROP NOT NULL;

-- Step 6: Add constraint to ensure either attributeId is set (system sync) OR name is set (user created)
ALTER TABLE data_model_attributes 
  ADD CONSTRAINT check_attribute_source CHECK (
    (attribute_id IS NOT NULL) OR 
    (name IS NOT NULL)
  );

-- Step 7: Migrate existing data - copy name and other fields from data_objects to data_model_objects
UPDATE data_model_objects dmo
SET 
  name = do.name,
  description = do.description,
  object_type = do.object_type,
  domain_id = do.domain_id,
  data_area_id = do.data_area_id,
  source_system_id = do.source_system_id
FROM data_objects do
WHERE dmo.object_id = do.id
  AND dmo.name IS NULL;

-- Step 8: Migrate existing data - copy name and other fields from attributes to data_model_attributes
UPDATE data_model_attributes dma
SET 
  name = a.name,
  description = a.description,
  data_type = a.data_type,
  length = a.length,
  precision = a.precision,
  scale = a.scale
FROM data_object_attributes a
WHERE dma.attribute_id = a.id
  AND dma.name IS NULL;

-- Step 9: Add index for performance on new fields
CREATE INDEX IF NOT EXISTS idx_data_model_objects_name ON data_model_objects(name);
CREATE INDEX IF NOT EXISTS idx_data_model_objects_domain ON data_model_objects(domain_id);
CREATE INDEX IF NOT EXISTS idx_data_model_objects_data_area ON data_model_objects(data_area_id);
CREATE INDEX IF NOT EXISTS idx_data_model_attributes_name ON data_model_attributes(name);

-- Step 10: Add comments to clarify the new architecture
COMMENT ON COLUMN data_model_objects.object_id IS 'References data_objects for system-synced objects only. NULL for user-created objects.';
COMMENT ON COLUMN data_model_objects.name IS 'Object name. Required for user-created objects. Duplicated from data_objects for system-synced objects.';
COMMENT ON COLUMN data_model_attributes.attribute_id IS 'References data_object_attributes for system-synced attributes only. NULL for user-created attributes.';
COMMENT ON COLUMN data_model_attributes.name IS 'Attribute name. Required for user-created attributes. Duplicated from attributes for system-synced attributes.';
