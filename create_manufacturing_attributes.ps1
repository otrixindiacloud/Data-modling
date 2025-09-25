# Manufacturing ERP System - Create Attributes Script

# MI_REQUEST_OUTPUT_MATERIALS attributes
$attributes = @(
    @{name="REQUEST_ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$false; isPrimaryKey=$false; isForeignKey=$true; objectId=472},
    @{name="WORKORDER_ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$true; objectId=472},
    @{name="WORKORDER_NO"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=472},
    @{name="OUTPUT_MATERIAL"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=472},
    @{name="BATCH_SIZE"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=472},
    @{name="BATCH_UOM"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=472},
    @{name="BATCH_REMAINING"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=472},
    @{name="QTY_TO_PRODUCTED"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=472},
    @{name="REQUESTED_QTY"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=472}
)

# MI_WORKORDERS attributes
$workorderAttributes = @(
    @{name="WORKORDER_ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$false; isPrimaryKey=$true; isForeignKey=$false; objectId=475},
    @{name="WORKORDER_NO"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=475},
    @{name="OUTPUT_MATERIAL"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=475},
    @{name="START_DATE"; conceptualType="Date"; logicalType="DATE"; physicalType="DATE"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=475},
    @{name="END_DATE"; conceptualType="Date"; logicalType="DATE"; physicalType="DATE"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=475},
    @{name="BATCH_SIZE"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=475},
    @{name="BATCH_UOM"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=475},
    @{name="BATCH_REMAINING"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=475},
    @{name="QTY_TO_PRODUCTED"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=475},
    @{name="STATUS"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=475}
)

# MI_REQUEST_RAW_MATERIALS attributes
$rawMaterialAttributes = @(
    @{name="REQUEST_RAW_MATERIAL_ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$false; isPrimaryKey=$true; isForeignKey=$false; objectId=478},
    @{name="REQUEST_ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$true; objectId=478},
    @{name="OUTPUT_MATERIAL_ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$true; objectId=478},
    @{name="WORKORDER_ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$true; objectId=478},
    @{name="WORKORDER_NO"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=478},
    @{name="OUTPUT_MATERIAL"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=478},
    @{name="RAW_MATERIAL_CODE"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=478},
    @{name="RAW_MATERIAL_DESCRIPTION"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(255 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=478},
    @{name="REQUIRED_QTY"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=478},
    @{name="UOM"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=478},
    @{name="REQUESTED_QTY"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=478}
)

# MI_WORKORDER_MATERIALS attributes
$workorderMaterialAttributes = @(
    @{name="ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$false; isPrimaryKey=$true; isForeignKey=$false; objectId=481},
    @{name="WORKORDER_ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$true; objectId=481},
    @{name="RAW_MATERIAL_CODE"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=481},
    @{name="RAW_MATERIAL_DESCRIPTION"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(255 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=481},
    @{name="REQUIRED_QTY"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=481},
    @{name="UOM"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=481}
)

# MI_CONSUMPTION_RAW_MATERIAL attributes
$consumptionAttributes = @(
    @{name="CONSUMPTION_ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$false; isPrimaryKey=$true; isForeignKey=$false; objectId=484},
    @{name="CONSUMPTION_DATE"; conceptualType="Date"; logicalType="DATE"; physicalType="DATE"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=484},
    @{name="WORKORDER_ID"; conceptualType="Identifier"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$true; objectId=484},
    @{name="WORKORDER_NO"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=484},
    @{name="OUTPUT_MATERIAL"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=484},
    @{name="RAW_MATERIAL_CODE"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=484},
    @{name="RAW_MATERIAL_DESCRIPTION"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(255 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=484},
    @{name="UOM"; conceptualType="Text"; logicalType="VARCHAR2"; physicalType="VARCHAR2(100 CHAR)"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=484},
    @{name="CONSUMPTION_QTY"; conceptualType="Number"; logicalType="NUMBER"; physicalType="NUMBER"; nullable=$true; isPrimaryKey=$false; isForeignKey=$false; objectId=484}
)

# Function to create attributes
function Create-Attributes {
    param($attributeList, $tableName)
    
    Write-Host "Creating attributes for $tableName..."
    foreach ($attr in $attributeList) {
        try {
            $body = @{
                name = $attr.name
                conceptualType = $attr.conceptualType
                logicalType = $attr.logicalType
                physicalType = $attr.physicalType
                nullable = $attr.nullable
                isPrimaryKey = $attr.isPrimaryKey
                isForeignKey = $attr.isForeignKey
                objectId = $attr.objectId
            } | ConvertTo-Json
            
            $response = Invoke-RestMethod -Uri "http://localhost:5000/api/attributes" -Method POST -ContentType "application/json" -Body $body
            Write-Host "  ✓ Created attribute: $($attr.name)"
        }
        catch {
            Write-Host "  ✗ Failed to create attribute: $($attr.name) - $($_.Exception.Message)"
        }
    }
}

# Create all attributes
Create-Attributes $attributes "MI_REQUEST_OUTPUT_MATERIALS"
Create-Attributes $workorderAttributes "MI_WORKORDERS"
Create-Attributes $rawMaterialAttributes "MI_REQUEST_RAW_MATERIALS"
Create-Attributes $workorderMaterialAttributes "MI_WORKORDER_MATERIALS"
Create-Attributes $consumptionAttributes "MI_CONSUMPTION_RAW_MATERIAL"

Write-Host "All attributes created successfully!"