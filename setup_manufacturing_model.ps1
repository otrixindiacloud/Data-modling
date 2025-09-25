# Manufacturing ERP System Setup Script
# This script creates a complete manufacturing data model with all tables, attributes, and relationships

Write-Host "Setting up Manufacturing ERP System Data Model..." -ForegroundColor Green

# Load the configuration
$config = Get-Content "manufacturing_model_setup.json" | ConvertFrom-Json

# Step 1: Create all data objects
Write-Host "`nStep 1: Creating data objects..." -ForegroundColor Yellow

$objectIds = @{}

foreach ($obj in $config.objects) {
    try {
        Write-Host "Creating object: $($obj.name)" -ForegroundColor Cyan
        
        # Create the object
        $objectBody = @{
            name = $obj.name
            description = $obj.description
            domainId = $obj.domainId
            dataAreaId = $obj.dataAreaId
        } | ConvertTo-Json
        
        $objectResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/objects" -Method POST -ContentType "application/json" -Body $objectBody
        $objectIds[$obj.name] = $objectResponse.id
        
        Write-Host "  ✓ Created object: $($obj.name) (ID: $($objectResponse.id))" -ForegroundColor Green
        
        # Create attributes for this object
        Write-Host "  Creating attributes for $($obj.name)..." -ForegroundColor Gray
        foreach ($attr in $obj.attributes) {
            try {
                $isForeignKey = $false
                if ($attr.PSObject.Properties.Name -contains "isForeignKey") {
                    $isForeignKey = $attr.isForeignKey
                }
                
                $attrBody = @{
                    name = $attr.name
                    conceptualType = $attr.conceptualType
                    logicalType = $attr.logicalType
                    physicalType = $attr.physicalType
                    nullable = $attr.nullable
                    isPrimaryKey = $attr.isPrimaryKey
                    isForeignKey = $isForeignKey
                    objectId = $objectResponse.id
                } | ConvertTo-Json
                
                $attrResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/attributes" -Method POST -ContentType "application/json" -Body $attrBody
                Write-Host "    ✓ Created attribute: $($attr.name)" -ForegroundColor DarkGreen
            }
            catch {
                Write-Host "    ✗ Failed to create attribute: $($attr.name) - $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    catch {
        Write-Host "  ✗ Failed to create object: $($obj.name) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 2: Add objects to the conceptual model
Write-Host "`nStep 2: Adding objects to conceptual model..." -ForegroundColor Yellow

$conceptualModelId = 120

foreach ($obj in $config.objects) {
    if ($objectIds.ContainsKey($obj.name)) {
        try {
            $addToModelBody = @{
                objectId = $objectIds[$obj.name]
                position = $obj.position
                targetSystem = "Operational Database"
                isVisible = $true
                layerSpecificConfig = @{
                    position = $obj.position
                    layer = "conceptual"
                }
            } | ConvertTo-Json
            
            $addResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/models/$conceptualModelId/objects" -Method POST -ContentType "application/json" -Body $addToModelBody
            Write-Host "  ✓ Added $($obj.name) to conceptual model" -ForegroundColor Green
        }
        catch {
            Write-Host "  ✗ Failed to add $($obj.name) to model - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Step 3: Create relationships
Write-Host "`nStep 3: Creating relationships..." -ForegroundColor Yellow

foreach ($rel in $config.relationships) {
    if ($objectIds.ContainsKey($rel.source) -and $objectIds.ContainsKey($rel.target)) {
        try {
            $relBody = @{
                sourceObjectId = $objectIds[$rel.source]
                targetObjectId = $objectIds[$rel.target]
                type = $rel.type
                modelId = $conceptualModelId
                description = $rel.description
            } | ConvertTo-Json
            
            $relResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/relationships" -Method POST -ContentType "application/json" -Body $relBody
            Write-Host "  ✓ Created relationship: $($rel.source) -> $($rel.target) ($($rel.type))" -ForegroundColor Green
        }
        catch {
            Write-Host "  ✗ Failed to create relationship: $($rel.source) -> $($rel.target) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Step 4: Summary
Write-Host "`nStep 4: Summary" -ForegroundColor Yellow
Write-Host "Objects created: $($objectIds.Count)" -ForegroundColor Green
Write-Host "Relationships created: $($config.relationships.Count)" -ForegroundColor Green
Write-Host "`nManufacturing ERP System setup complete!" -ForegroundColor Green
Write-Host "You can now view the model at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Model ID: $conceptualModelId (Conceptual Layer)" -ForegroundColor Cyan