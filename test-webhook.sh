#!/bin/bash

# Test script for GitHub webhook
# This simulates a GitHub push event to test the webhook locally

echo "🧪 Testing webhook endpoint..."
echo "================================"

# Test 1: Check if webhook server is reachable
echo ""
echo "Test 1: Checking if webhook server is reachable..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://147.79.66.3:9000/webhook -X POST)

if [ "$response" = "000" ]; then
    echo "❌ Cannot reach webhook server. Check if:"
    echo "   - Webhook server is running: pm2 list | grep webhook"
    echo "   - Port 9000 is accessible from your network"
    exit 1
else
    echo "✅ Webhook server is reachable (HTTP $response)"
fi

# Test 2: Send a simulated GitHub push event
echo ""
echo "Test 2: Sending simulated GitHub push event..."

# Create a minimal GitHub push payload
payload='{
  "ref": "refs/heads/main",
  "repository": {
    "name": "NakshatraTalksBackend",
    "full_name": "nakshatratalks/NakshatraTalksBackend"
  },
  "pusher": {
    "name": "test-user"
  },
  "commits": [
    {
      "id": "test123",
      "message": "Test commit"
    }
  ]
}'

# Send the webhook request
curl -X POST http://147.79.66.3:9000/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d "$payload"

echo ""
echo ""
echo "================================"
echo "✅ Test completed!"
echo ""
echo "Next steps:"
echo "1. Check webhook logs on VPS:"
echo "   ssh root@147.79.66.3 'pm2 logs nakshatra-webhook --lines 20'"
echo ""
echo "2. Check if deployment was triggered:"
echo "   ssh root@147.79.66.3 'pm2 logs nakshatra-api --lines 20'"
echo ""
echo "3. If the test worked but GitHub webhooks don't:"
echo "   - Go to https://github.com/nakshatratalks/NakshatraTalksBackend/settings/hooks"
echo "   - Configure webhook as described in WEBHOOK_SETUP_GUIDE.md"
