BEGIN;

ALTER TABLE data_objects
  ADD COLUMN IF NOT EXISTS system_id INTEGER REFERENCES systems(id);

UPDATE data_objects
SET system_id = COALESCE(target_system_id, source_system_id)
WHERE system_id IS NULL;

COMMIT;
