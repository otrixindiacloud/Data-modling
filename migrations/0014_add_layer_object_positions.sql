-- Add position columns to data_model_layer_objects table
-- This allows each layer to have its own canvas position for objects

ALTER TABLE data_model_layer_objects
ADD COLUMN position_x DOUBLE PRECISION,
ADD COLUMN position_y DOUBLE PRECISION;

-- Create an index for faster position queries
CREATE INDEX idx_layer_objects_layer_id ON data_model_layer_objects(data_model_layer_id);
CREATE INDEX idx_layer_objects_object_id ON data_model_layer_objects(data_model_object_id);

-- Migrate existing positions from data_model_objects to data_model_layer_objects
-- This will copy the current position to all layers where the object appears
UPDATE data_model_layer_objects dlo
SET 
  position_x = CASE 
    WHEN jsonb_typeof(dmo.position::jsonb) = 'object' 
    THEN (dmo.position::jsonb->>'x')::DOUBLE PRECISION
    ELSE NULL
  END,
  position_y = CASE 
    WHEN jsonb_typeof(dmo.position::jsonb) = 'object' 
    THEN (dmo.position::jsonb->>'y')::DOUBLE PRECISION
    ELSE NULL
  END
FROM data_model_objects dmo
WHERE dlo.data_model_object_id = dmo.id
  AND dmo.position IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN data_model_layer_objects.position_x IS 'X coordinate of the object on the canvas for this specific layer';
COMMENT ON COLUMN data_model_layer_objects.position_y IS 'Y coordinate of the object on the canvas for this specific layer';
