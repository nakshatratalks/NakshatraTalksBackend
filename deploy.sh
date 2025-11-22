#\!/bin/bash

# NakshatraTalks Backend Deployment Script
# This script pulls the latest changes from Git, builds the server, and restarts PM2

set -e  # Exit on any error

echo "🚀 Starting deployment for NakshatraTalks Backend..."
echo "=================================================="

# Get the directory of the script
SCRIPT_DIR="/var/tmp/NakshatraTalksBackend"
SERVER_DIR="$SCRIPT_DIR/server"

# Navigate to project directory
cd "$SCRIPT_DIR"

echo "📂 Current directory: $(pwd)"

# Check if git repository
if [ \! -d ".git" ]; then
  echo "❌ Error: Not a git repository"
  exit 1
fi

# Store current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "🌿 Current branch: $CURRENT_BRANCH"

# Stash any local changes
echo "💾 Stashing local changes..."
git stash

# Pull latest changes
echo "📥 Pulling latest changes from origin/$CURRENT_BRANCH..."
git pull origin "$CURRENT_BRANCH"

# Check if pull was successful
if [ $? -ne 0 ]; then
  echo "❌ Error: Failed to pull changes from Git"
  exit 1
fi

# Navigate to server directory
cd "$SERVER_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production=false

# Build the server
echo "🔨 Building the server..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "❌ Error: Build failed"
  exit 1
fi

# Copy .env to root if not exists
if [ -f "$SERVER_DIR/.env" ] && [ \! -f "$SCRIPT_DIR/.env" ]; then
  echo "📋 Copying .env to root directory..."
  cp "$SERVER_DIR/.env" "$SCRIPT_DIR/.env"
fi

# Restart PM2
echo "🔄 Restarting PM2 process..."
pm2 restart nakshatra-api

# Wait a moment for the process to restart
sleep 3

# Check PM2 status
echo "✅ Checking PM2 status..."
pm2 list | grep nakshatra-api

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

echo "=================================================="
echo "✅ Deployment completed successfully\!"
echo "🌐 API is running at: http://api.nakshatratalks.com"
echo "📚 Swagger docs: http://api.nakshatratalks.com/api-docs"
echo "=================================================="

# Show recent logs
echo "📜 Recent logs:"
pm2 logs nakshatra-api --lines 10 --nostream
