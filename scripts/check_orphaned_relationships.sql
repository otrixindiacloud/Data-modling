-- Check for orphaned relationships (relationships pointing to non-existent model objects)

-- 1. Find relationships where source_model_object_id doesn't exist in data_model_objects
SELECT 
    'Missing Source' as issue_type,
    r.id as relationship_id,
    r.model_id as layer_id,
    r.source_model_object_id,
    r.target_model_object_id,
    r.type as relationship_type
FROM data_model_object_relationships r
LEFT JOIN data_model_objects so ON r.source_model_object_id = so.id
WHERE so.id IS NULL
ORDER BY r.id
LIMIT 20;

-- 2. Find relationships where target_model_object_id doesn't exist in data_model_objects
SELECT 
    'Missing Target' as issue_type,
    r.id as relationship_id,
    r.model_id as layer_id,
    r.source_model_object_id,
    r.target_model_object_id,
    r.type as relationship_type
FROM data_model_object_relationships r
LEFT JOIN data_model_objects tgt ON r.target_model_object_id = tgt.id
WHERE tgt.id IS NULL
ORDER BY r.id
LIMIT 20;

-- 3. Find relationships where source and target objects belong to different layers
SELECT 
    'Cross-Layer Reference' as issue_type,
    r.id as relationship_id,
    r.model_id as relationship_layer_id,
    so.model_id as source_object_layer_id,
    tgt.model_id as target_object_layer_id,
    so.id as source_model_object_id,
    tgt.id as target_model_object_id,
    r.type as relationship_type
FROM data_model_object_relationships r
JOIN data_model_objects so ON r.source_model_object_id = so.id
JOIN data_model_objects tgt ON r.target_model_object_id = tgt.id
WHERE so.model_id != r.model_id OR tgt.model_id != r.model_id
ORDER BY r.id
LIMIT 20;

-- 4. Count total relationships per layer
SELECT 
    dml.id as layer_id,
    dml.layer as layer_name,
    COUNT(r.id) as total_relationships,
    COUNT(DISTINCT r.source_model_object_id) as unique_source_objects,
    COUNT(DISTINCT r.target_model_object_id) as unique_target_objects
FROM data_model_layers dml
LEFT JOIN data_model_object_relationships r ON r.model_id = dml.id
GROUP BY dml.id, dml.layer
ORDER BY dml.id;

-- 5. Count objects per layer
SELECT 
    dml.id as layer_id,
    dml.layer as layer_name,
    COUNT(dmo.id) as total_objects
FROM data_model_layers dml
LEFT JOIN data_model_objects dmo ON dmo.model_id = dml.id
GROUP BY dml.id, dml.layer
ORDER BY dml.id;
