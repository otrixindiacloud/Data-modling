#!/bin/bash

# Script to clean up unnecessary files created during initial exploration

echo "Cleaning up unnecessary route split files..."

FILES_TO_REMOVE=(
  "/workspaces/Data-modling/server/model_routes.ts"
  "/workspaces/Data-modling/server/system_routes.ts"
  "/workspaces/Data-modling/server/capability_routes.ts"
  "/workspaces/Data-modling/server/configuration_routes.ts"
  "/workspaces/Data-modling/server/report_routes.ts"
  "/workspaces/Data-modling/server/route_helpers.ts"
  "/workspaces/Data-modling/server/model_sync_helpers.ts"
  "/workspaces/Data-modling/server/routes_old.ts"
  "/workspaces/Data-modling/server/routes_new.ts"
)

REMOVED_COUNT=0
SKIPPED_COUNT=0

for file in "${FILES_TO_REMOVE[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "✓ Removed: $file"
    ((REMOVED_COUNT++))
  else
    echo "⊘ Skipped (not found): $file"
    ((SKIPPED_COUNT++))
  fi
done

echo ""
echo "Cleanup complete!"
echo "Files removed: $REMOVED_COUNT"
echo "Files not found: $SKIPPED_COUNT"
echo ""
echo "Keeping backup files:"
echo "  - server/routes.ts.backup (original file)"
echo ""
echo "Current structure:"
echo "  server/routes.ts (refactored)"
echo "  server/utils/ (utility modules)"
