#!/bin/bash
# Test authentication endpoints

BASE_URL="http://localhost:5000"

echo "=== Testing Authentication Endpoints ==="
echo ""

# Test 1: Register a new user
echo "1. Testing registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Test Organization",
    "email": "test@example.com",
    "password": "password123"
  }')

echo "Register response:"
echo "$REGISTER_RESPONSE" | jq '.'
echo ""

# Extract token from response
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo "✓ Registration successful! Token obtained."
  echo ""
  
  # Test 2: Get user profile
  echo "2. Testing /api/auth/me endpoint..."
  ME_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/me" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "Profile response:"
  echo "$ME_RESPONSE" | jq '.'
  echo ""
  
  # Test 3: Logout
  echo "3. Testing logout..."
  LOGOUT_RESPONSE=$(curl -s -w "\nHTTP Status: %{http_code}" -X POST "$BASE_URL/api/auth/logout" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "$LOGOUT_RESPONSE"
  echo ""
  
  # Test 4: Login with credentials
  echo "4. Testing login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "identifier": "test@example.com",
      "password": "password123"
    }')
  
  echo "Login response:"
  echo "$LOGIN_RESPONSE" | jq '.'
  echo ""
  
  NEW_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
  if [ "$NEW_TOKEN" != "null" ] && [ -n "$NEW_TOKEN" ]; then
    echo "✓ Login successful! New token obtained."
  else
    echo "✗ Login failed"
  fi
else
  echo "✗ Registration failed"
  echo "Response: $REGISTER_RESPONSE"
fi

echo ""
echo "=== Test Complete ==="
