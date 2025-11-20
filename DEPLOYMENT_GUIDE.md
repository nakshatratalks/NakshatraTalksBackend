# NakshatraTalks Deployment Guide

## Overview

This guide explains the CI/CD pipeline setup for automatic deployment of NakshatraTalks backend to the VPS.

## Architecture

```
GitHub Repository
       ↓
   (git push)
       ↓
GitHub Webhook
       ↓
   http://147.79.66.3:9000/webhook
       ↓
Webhook Server (PM2)
       ↓
Deployment Script
       ↓
   1. Git pull
   2. npm install
   3. npm build
   4. PM2 restart
       ↓
Updated API Live
```

## Components

### 1. Deployment Script (`/var/tmp/NakshatraTalksBackend/deploy.sh`)

Automated deployment script that:
- Pulls latest changes from Git
- Installs dependencies
- Builds the TypeScript server
- Restarts PM2 process

**Location**: `/var/tmp/NakshatraTalksBackend/deploy.sh`

**Manual Deployment**:
```bash
ssh root@147.79.66.3
cd /var/tmp/NakshatraTalksBackend
./deploy.sh
```

### 2. Webhook Server (`webhook-server.js`)

Node.js HTTP server that:
- Listens on port 9000
- Receives GitHub webhook events
- Validates webhook signature (optional)
- Triggers deployment script on push to main/master

**Webhook URL**: `http://147.79.66.3:9000/webhook`
**Secret**: `nakshatra-webhook-secret-2024`

**PM2 Status**:
```bash
pm2 list
# Should show:
# - nakshatra-api (online)
# - nakshatra-webhook (online)
# - tingatalk-backend (online)
```

## Setting Up GitHub Webhook

### Step 1: Access Repository Settings

1. Go to your GitHub repository: `https://github.com/nakshatratalks/NakshatraTalksBackend`
2. Click on **Settings** tab
3. Click on **Webhooks** in the left sidebar
4. Click **Add webhook**

### Step 2: Configure Webhook

Fill in the following details:

**Payload URL**:
```
http://147.79.66.3:9000/webhook
```

**Content type**:
```
application/json
```

**Secret** (optional but recommended):
```
nakshatra-webhook-secret-2024
```

**Which events would you like to trigger this webhook?**
- Select: **Just the push event**

**Active**:
- ✅ Check this box

Click **Add webhook**

### Step 3: Test Webhook

1. Make a small change to your code
2. Commit and push to main/master branch:
   ```bash
   git add .
   git commit -m "Test deployment"
   git push origin main
   ```

3. Check GitHub webhook deliveries:
   - Go to Settings > Webhooks
   - Click on your webhook
   - Click "Recent Deliveries" tab
   - You should see a 200 response

4. Check deployment logs on VPS:
   ```bash
   ssh root@147.79.66.3
   pm2 logs nakshatra-webhook
   ```

## Deployment Workflow

### Automatic Deployment (via GitHub)

1. **Developer pushes code to GitHub**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **GitHub triggers webhook** → `http://147.79.66.3:9000/webhook`

3. **Webhook server receives event** and validates it

4. **Deployment script executes automatically**:
   - Stashes local changes
   - Pulls latest from GitHub
   - Installs dependencies
   - Builds server
   - Restarts PM2

5. **API is updated** and live at `http://147.79.66.3:4000`

**Total Time**: ~30-60 seconds

### Manual Deployment

If you need to deploy manually:

```bash
# SSH into VPS
ssh root@147.79.66.3

# Navigate to project directory
cd /var/tmp/NakshatraTalksBackend

# Run deployment script
./deploy.sh
```

## Monitoring Deployment

### Check Webhook Logs

```bash
ssh root@147.79.66.3
pm2 logs nakshatra-webhook --lines 50
```

### Check API Logs

```bash
pm2 logs nakshatra-api --lines 50
```

### Check PM2 Status

```bash
pm2 list
pm2 monit
```

### Check Recent Deployments

```bash
ssh root@147.79.66.3
cd /var/tmp/NakshatraTalksBackend
git log --oneline -10
```

## Troubleshooting

### Webhook Not Triggering

1. **Check GitHub webhook deliveries**:
   - Go to Settings > Webhooks
   - Check "Recent Deliveries"
   - Look for error responses

2. **Check webhook server is running**:
   ```bash
   pm2 list | grep webhook
   pm2 logs nakshatra-webhook
   ```

3. **Check firewall**:
   ```bash
   ufw status | grep 9000
   # Should show: 9000/tcp ALLOW Anywhere
   ```

4. **Test webhook endpoint manually**:
   ```bash
   curl -X POST http://147.79.66.3:9000/webhook \
     -H "Content-Type: application/json" \
     -d '{"ref":"refs/heads/main"}'
   ```

### Deployment Script Fails

1. **Check script permissions**:
   ```bash
   ls -l /var/tmp/NakshatraTalksBackend/deploy.sh
   # Should show: -rwxr-xr-x
   ```

2. **Run script manually to see errors**:
   ```bash
   cd /var/tmp/NakshatraTalksBackend
   ./deploy.sh
   ```

3. **Check Git status**:
   ```bash
   cd /var/tmp/NakshatraTalksBackend
   git status
   git remote -v
   ```

### Build Fails

1. **Check Node.js version**:
   ```bash
   node --version
   # Should be v18 or higher
   ```

2. **Check npm dependencies**:
   ```bash
   cd /var/tmp/NakshatraTalksBackend/server
   npm install
   npm run build
   ```

3. **Check TypeScript errors**:
   ```bash
   cd /var/tmp/NakshatraTalksBackend/server
   npm run type-check
   ```

### PM2 Restart Fails

1. **Check PM2 status**:
   ```bash
   pm2 list
   pm2 describe nakshatra-api
   ```

2. **Check error logs**:
   ```bash
   pm2 logs nakshatra-api --err --lines 50
   ```

3. **Restart manually**:
   ```bash
   pm2 restart nakshatra-api
   ```

## Security Considerations

### 1. Webhook Secret

The webhook uses a secret to validate requests from GitHub. The current secret is:
```
nakshatra-webhook-secret-2024
```

**To change the secret**:
1. Update GitHub webhook settings
2. Update webhook-ecosystem.config.js:
   ```bash
   ssh root@147.79.66.3
   nano /var/tmp/NakshatraTalksBackend/webhook-ecosystem.config.js
   # Change WEBHOOK_SECRET value
   pm2 restart nakshatra-webhook
   ```

### 2. SSH Keys

The VPS uses SSH keys for GitHub access. If you need to update:
```bash
ssh root@147.79.66.3
cat ~/.ssh/id_rsa.pub
# Add this to GitHub Deploy Keys
```

### 3. Firewall Rules

Current firewall configuration:
```bash
ufw status
# Ports open:
# - 22 (SSH)
# - 3000 (TingaTalk)
# - 4000 (NakshatraTalks API)
# - 9000 (Webhook)
# - 80/443 (HTTP/HTTPS)
```

## Server URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Production API** | http://147.79.66.3:4000 | Main API endpoint |
| **Swagger Docs** | http://147.79.66.3:4000/api-docs | API documentation |
| **Health Check** | http://147.79.66.3:4000/health | Server health status |
| **Webhook Endpoint** | http://147.79.66.3:9000/webhook | GitHub webhook receiver |

## PM2 Management

### View All Processes
```bash
pm2 list
```

### View Process Details
```bash
pm2 describe nakshatra-api
pm2 describe nakshatra-webhook
```

### View Logs
```bash
# All logs
pm2 logs

# Specific service
pm2 logs nakshatra-api
pm2 logs nakshatra-webhook

# Error logs only
pm2 logs nakshatra-api --err

# Last 100 lines
pm2 logs nakshatra-api --lines 100
```

### Restart Services
```bash
# Restart API
pm2 restart nakshatra-api

# Restart webhook
pm2 restart nakshatra-webhook

# Restart all
pm2 restart all
```

### Stop/Start Services
```bash
# Stop
pm2 stop nakshatra-api
pm2 stop nakshatra-webhook

# Start
pm2 start nakshatra-api
pm2 start nakshatra-webhook
```

### Save Configuration
```bash
pm2 save
```

## Rollback Procedure

If a deployment breaks something:

```bash
# SSH into VPS
ssh root@147.79.66.3
cd /var/tmp/NakshatraTalksBackend

# Check recent commits
git log --oneline -10

# Rollback to previous commit
git reset --hard <commit-hash>

# Or rollback by 1 commit
git reset --hard HEAD~1

# Rebuild and restart
cd server
npm install
npm run build
cd ..
pm2 restart nakshatra-api
```

## Environment Variables

**Location**: `/var/tmp/NakshatraTalksBackend/.env`

```env
PORT=4000
NODE_ENV=production
SUPABASE_URL=https://vckkbwvjczptjwixxvwi.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CLIENT_URL=http://localhost:3000
```

## Maintenance

### Update Dependencies
```bash
ssh root@147.79.66.3
cd /var/tmp/NakshatraTalksBackend/server
npm update
npm run build
pm2 restart nakshatra-api
```

### Check Disk Space
```bash
df -h
```

### Check Memory Usage
```bash
free -h
pm2 monit
```

### Clean Old Logs
```bash
pm2 flush
```

### Update Node.js
```bash
# Check current version
node --version

# Update using nvm (if installed)
nvm install --lts
nvm use --lts
```

## Support

If you encounter issues:
1. Check logs: `pm2 logs`
2. Check GitHub webhook deliveries
3. Try manual deployment: `./deploy.sh`
4. Check API status: `curl http://147.79.66.3:4000/health`

## Summary

✅ Automatic deployment on push to main/master
✅ Webhook server running on port 9000
✅ Deployment script at `/var/tmp/NakshatraTalksBackend/deploy.sh`
✅ Manual deployment available
✅ PM2 process management
✅ Firewall configured
✅ Logs available via PM2

**Deployment Time**: 30-60 seconds
**Downtime**: < 5 seconds (during PM2 restart)
