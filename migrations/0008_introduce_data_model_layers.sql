-- Introduce dedicated data model layers and layer-object mappings

BEGIN;

-- Rename existing data_models to data_model_layers to reflect new structure
ALTER TABLE data_models RENAME TO data_model_layers;

-- Rename the default sequence to match the new table name if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.sequences
    WHERE sequence_schema = 'public' AND sequence_name = 'data_models_id_seq'
  ) THEN
    ALTER SEQUENCE data_models_id_seq RENAME TO data_model_layers_id_seq;
  END IF;
END;
$$;

-- Update the default sequence reference on the id column (avoid stale defaults)
ALTER TABLE data_model_layers ALTER COLUMN id SET DEFAULT nextval('data_model_layers_id_seq');

-- Create the new parent data_models table that will hold a single record per model
CREATE TABLE data_models (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  target_system_id INTEGER REFERENCES systems(id),
  domain_id INTEGER REFERENCES data_domains(id),
  data_area_id INTEGER REFERENCES data_areas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add the foreign key column linking layers back to the parent model
ALTER TABLE data_model_layers ADD COLUMN data_model_id INTEGER;
ALTER TABLE data_model_layers
  ADD CONSTRAINT data_model_layers_data_model_id_fkey
  FOREIGN KEY (data_model_id)
  REFERENCES data_models(id)
  ON DELETE CASCADE;

-- Seed parent models from existing conceptual layers
WITH conceptual_layers AS (
  SELECT
    id AS conceptual_layer_id,
    name,
    target_system_id,
    domain_id,
    data_area_id,
    created_at,
    updated_at
  FROM data_model_layers
  WHERE layer = 'conceptual'
)
INSERT INTO data_models (id, name, target_system_id, domain_id, data_area_id, created_at, updated_at)
SELECT
  conceptual_layer_id,
  name,
  target_system_id,
  domain_id,
  data_area_id,
  created_at,
  updated_at
FROM conceptual_layers
ON CONFLICT (id) DO NOTHING;

-- Align the parent table's sequence with the imported identifiers
SELECT setval('data_models_id_seq', (SELECT COALESCE(MAX(id), 1) FROM data_models));

-- Populate the foreign key on the conceptual layers
UPDATE data_model_layers
SET data_model_id = id
WHERE layer = 'conceptual';

-- Propagate the foreign key to child layers using the previous parent relationships
UPDATE data_model_layers AS child
SET data_model_id = parent.data_model_id
FROM data_model_layers AS parent
WHERE child.data_model_id IS NULL
  AND child.parent_model_id = parent.id;

-- Ensure every remaining layer references a parent model (guards against orphaned rows)
UPDATE data_model_layers
SET data_model_id = id
WHERE data_model_id IS NULL;

-- Introduce Flow layer for every model (first layer)
INSERT INTO data_model_layers (
  data_model_id,
  name,
  layer,
  parent_model_id,
  target_system_id,
  domain_id,
  data_area_id,
  created_at,
  updated_at
)
SELECT
  id AS data_model_id,
  name || ' Flow' AS name,
  'flow' AS layer,
  NULL AS parent_model_id,
  target_system_id,
  domain_id,
  data_area_id,
  created_at,
  updated_at
FROM data_models
ON CONFLICT DO NOTHING;

-- Ensure flow layer metadata aligns with conceptual layer defaults
UPDATE data_model_layers AS flow
SET
  name = conceptual.name,
  parent_model_id = conceptual.id
FROM data_model_layers AS conceptual
WHERE flow.layer = 'flow'
  AND conceptual.layer = 'conceptual'
  AND flow.data_model_id = conceptual.data_model_id;

-- Reset sequences after the new rows have been added
SELECT setval('data_model_layers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM data_model_layers));

-- Enforce non-null once all rows have a parent model mapping
ALTER TABLE data_model_layers ALTER COLUMN data_model_id SET NOT NULL;

-- Create mapping table between layers and objects
CREATE TABLE data_model_layer_objects (
  id SERIAL PRIMARY KEY,
  data_model_layer_id INTEGER NOT NULL REFERENCES data_model_layers(id) ON DELETE CASCADE,
  data_model_object_id INTEGER NOT NULL REFERENCES data_model_objects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT data_model_layer_objects_unique UNIQUE (data_model_layer_id, data_model_object_id)
);

-- Backfill mapping records using existing data
INSERT INTO data_model_layer_objects (data_model_layer_id, data_model_object_id, created_at, updated_at)
SELECT
  model_id AS data_model_layer_id,
  id AS data_model_object_id,
  created_at,
  updated_at
FROM data_model_objects
ON CONFLICT DO NOTHING;

COMMIT;
