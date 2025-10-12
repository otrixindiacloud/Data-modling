# Quick Reference: Layer-Specific Positions

**For Developers and Testers**

## Quick Test

### 1. Create Object
```bash
# Create object in Conceptual layer
curl -X POST http://localhost:5000/api/models/10/objects \
  -H "Content-Type: application/json" \
  -d '{
    "objectId": 100,
    "position": {"x": 100, "y": 100}
  }'
```

### 2. Check Console
Should see:
```
[STORAGE] Successfully created layer mappings for object X across 4 layers
```

### 3. Test UI
1. Open browser → http://localhost:5000
2. Go to Conceptual layer
3. Position object at (100, 100)
4. Switch to Logical layer (NO reload!)
5. Move object to (500, 500)
6. Switch back to Conceptual → Object at (100, 100) ✅
7. Switch to Logical → Object at (500, 500) ✅

## Key Endpoints

### Fetch Canvas (with layer-specific positions)
```
GET /api/models/:id/canvas?layer=conceptual
GET /api/models/:id/canvas?layer=logical
GET /api/models/:id/canvas?layer=physical
GET /api/models/:id/canvas?layer=flow
```

### Save Positions (per layer)
```
POST /api/models/:id/canvas/positions
Body: {
  "layer": "logical",
  "positions": [
    {"objectId": 123, "position": {"x": 500, "y": 600}}
  ]
}
```

### Admin Sync
```
POST /api/admin/ensure-layer-mappings
```

## Database Queries

### Check positions for an object across layers
```sql
SELECT 
  l.layer,
  lo.position_x,
  lo.position_y
FROM data_model_layer_objects lo
JOIN data_model_layers l ON l.id = lo.data_model_layer_id
WHERE lo.data_model_object_id = 123
ORDER BY l.layer;
```

### Find objects without layer mappings
```sql
SELECT 
  dmo.id,
  dmo.name,
  COUNT(dlo.id) as mapping_count
FROM data_model_objects dmo
LEFT JOIN data_model_layer_objects dlo ON dlo.data_model_object_id = dmo.id
GROUP BY dmo.id, dmo.name
HAVING COUNT(dlo.id) = 0;
```

## Console Logs

### Object Creation ✅
```
[STORAGE] Creating layer mappings for object 5 in data model 2
[STORAGE] Found 4 layers for data model 2
[STORAGE] Successfully created layer mappings for object 5 across 4 layers
```

### Fetching Canvas ✅
```
[CANVAS] Fetching canvas for model 1, layer conceptual, layerId: 10
[CANVAS] Using layer-specific position for object 123: (100, 150)
```

### Saving Positions ✅
```
[CANVAS] Saving positions for model 1, layer logical, layerId: 11
[CANVAS] Saved position for object 123 in layer logical: (500, 600)
```

### Server Startup ✅
```
[STARTUP] Ensuring layer mappings for existing objects...
[STORAGE] Completed: processed 25 objects, created mappings for 3 objects
```

## Expected Behavior

### ✅ Creating Objects
- Object created in one layer
- Automatically appears in ALL layers
- Each layer can have different position

### ✅ Switching Layers
- NO page reload
- Smooth transition
- Object positions change per layer
- UI state preserved

### ✅ Saving Positions
- Auto-save after dragging
- Saved per layer
- Independent positions

## Troubleshooting

### Objects have same position in all layers?
- Check console for layerId values
- Verify database has correct layer IDs
- Check `data_model_layer_objects` table

### Page still reloads on layer switch?
- Check `LayerNavigator.tsx` for `window.location.reload()`
- Should be removed

### Object not appearing in all layers?
- Check console for layer mapping creation
- Run admin sync: `POST /api/admin/ensure-layer-mappings`
- Restart server (auto-sync runs on startup)

## Documentation

- `docs/COMPLETE-IMPLEMENTATION-SUMMARY.md` - Full overview
- `docs/layer-specific-positions-implementation.md` - Technical details
- `docs/layer-positions-correct-fix.md` - Bug fix details
- `docs/automatic-layer-mapping.md` - Auto-mapping details
- `docs/layer-switching-no-reload.md` - No reload details

---

**Status**: All features implemented! 🎉
