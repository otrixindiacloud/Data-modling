#!/bin/bash
# Debug login issues

BASE_URL="http://localhost:5000"

echo "=== Testing Login Endpoint ==="
echo ""

echo "Test 1: Login with existing user (demo@company.com)"
echo "Request payload:"
echo '{"identifier":"demo@company.com","password":"securepass123"}'
echo ""
echo "Response:"
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"demo@company.com","password":"securepass123"}' | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "Test 2: Login with wrong password"
echo "Request payload:"
echo '{"identifier":"demo@company.com","password":"wrongpassword"}'
echo ""
echo "Response:"
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"demo@company.com","password":"wrongpassword"}' | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "Test 3: Login with short identifier (should fail validation)"
echo "Request payload:"
echo '{"identifier":"ab","password":"password123"}'
echo ""
echo "Response:"
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"ab","password":"password123"}' | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "Test 4: Login with missing field (should fail validation)"
echo "Request payload:"
echo '{"identifier":"test@example.com"}'
echo ""
echo "Response:"
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com"}' | python3 -m json.tool
echo ""
