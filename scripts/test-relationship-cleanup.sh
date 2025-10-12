#!/bin/bash

# Test script for relationship cleanup functionality
# This script demonstrates how orphaned relationships are detected and removed

BASE_URL="http://localhost:5000"
MODEL_ID=6  # Update this to match your test model

echo "========================================="
echo "Testing Relationship Cleanup"
echo "========================================="
echo ""

echo "1. Checking current relationships in model ${MODEL_ID}..."
RELATIONSHIPS=$(curl -s "${BASE_URL}/api/models/${MODEL_ID}/relationships" | jq -r '. | length')
echo "   Found ${RELATIONSHIPS} relationships"
echo ""

echo "2. Running cleanup on model ${MODEL_ID}..."
CLEANUP_RESULT=$(curl -s -X POST "${BASE_URL}/api/models/${MODEL_ID}/relationships/cleanup")
echo "   Result: ${CLEANUP_RESULT}" | jq '.'
DELETED=$(echo "${CLEANUP_RESULT}" | jq -r '.deleted')
echo ""

echo "3. Checking relationships after cleanup..."
RELATIONSHIPS_AFTER=$(curl -s "${BASE_URL}/api/models/${MODEL_ID}/relationships" | jq -r '. | length')
echo "   Found ${RELATIONSHIPS_AFTER} relationships"
echo ""

echo "4. Summary:"
echo "   Before cleanup: ${RELATIONSHIPS} relationships"
echo "   Deleted:        ${DELETED} orphaned relationships"
echo "   After cleanup:  ${RELATIONSHIPS_AFTER} relationships"
echo "   Remaining valid: $((RELATIONSHIPS - DELETED))"
echo ""

echo "========================================="
echo "Test Complete"
echo "========================================="
