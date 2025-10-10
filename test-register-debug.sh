#!/bin/bash
# Debug registration issues

BASE_URL="http://localhost:5000"

echo "=== Testing Registration Endpoint ==="
echo ""

echo "Test 1: Minimal valid registration (should work)"
echo "Request payload:"
cat << 'EOF'
{
  "organizationName": "Test Company",
  "email": "newuser@example.com",
  "password": "password123"
}
EOF
echo ""
echo "Response:"
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Test Company",
    "email": "newuser@example.com",
    "password": "password123"
  }' | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "Test 2: Registration with all optional fields"
echo "Request payload:"
cat << 'EOF'
{
  "organizationName": "Full Test Company",
  "organizationSlug": "full-test",
  "userName": "John Doe",
  "email": "fulltest@example.com",
  "password": "securepass123"
}
EOF
echo ""
echo "Response:"
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Full Test Company",
    "organizationSlug": "full-test",
    "userName": "John Doe",
    "email": "fulltest@example.com",
    "password": "securepass123"
  }' | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "Test 3: Short organization name (should fail - min 3 chars)"
echo "Request payload:"
cat << 'EOF'
{
  "organizationName": "AB",
  "email": "short@example.com",
  "password": "password123"
}
EOF
echo ""
echo "Response:"
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "AB",
    "email": "short@example.com",
    "password": "password123"
  }' | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "Test 4: Short password (should fail - min 8 chars)"
echo "Request payload:"
cat << 'EOF'
{
  "organizationName": "Test Company",
  "email": "shortpass@example.com",
  "password": "pass123"
}
EOF
echo ""
echo "Response:"
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Test Company",
    "email": "shortpass@example.com",
    "password": "pass123"
  }' | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "Test 5: Invalid email format (should fail)"
echo "Request payload:"
cat << 'EOF'
{
  "organizationName": "Test Company",
  "email": "notanemail",
  "password": "password123"
}
EOF
echo ""
echo "Response:"
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Test Company",
    "email": "notanemail",
    "password": "password123"
  }' | python3 -m json.tool
echo ""
echo "---"
echo ""

echo "Test 6: With extra unexpected field (should fail due to .strict())"
echo "Request payload:"
cat << 'EOF'
{
  "organizationName": "Test Company",
  "email": "extra@example.com",
  "password": "password123",
  "extraField": "this should not be here"
}
EOF
echo ""
echo "Response:"
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Test Company",
    "email": "extra@example.com",
    "password": "password123",
    "extraField": "this should not be here"
  }' | python3 -m json.tool
echo ""
