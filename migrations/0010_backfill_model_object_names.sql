-- Backfill name, description, and other fields from data_objects to data_model_objects

BEGIN;

-- Update data_model_objects with data from linked data_objects
UPDATE data_model_objects dmo
SET 
  name = COALESCE(dmo.name, dobj.name),
  description = COALESCE(dmo.description, dobj.description),
  object_type = COALESCE(dmo.object_type, dobj.object_type),
  domain_id = COALESCE(dmo.domain_id, dobj.domain_id),
  data_area_id = COALESCE(dmo.data_area_id, dobj.data_area_id)
FROM data_objects dobj
WHERE dmo.object_id = dobj.id
  AND (dmo.name IS NULL OR dmo.description IS NULL OR dmo.object_type IS NULL);

COMMIT;
