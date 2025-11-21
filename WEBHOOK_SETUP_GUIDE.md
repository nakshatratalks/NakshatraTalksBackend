# GitHub Webhook Setup Guide for NakshatraTalks Backend

## Current Status
- ✅ Webhook server is running on VPS at port 9000
- ✅ Deploy script is configured and working
- ❌ GitHub webhook needs to be configured/verified

## Webhook Configuration

### Step 1: Access GitHub Repository Settings
1. Go to https://github.com/nakshatratalks/NakshatraTalksBackend
2. Click on **Settings** tab
3. Click on **Webhooks** in the left sidebar
4. Click **Add webhook** (or edit existing webhook if one exists)

### Step 2: Configure Webhook Settings
Enter the following details:

**Payload URL:**
```
http://147.79.66.3:9000/webhook
```

**Content type:**
```
application/json
```

**Secret:**
```
nakshatra-webhook-secret-2024
```

**SSL verification:**
- Select "Disable" (since we're using HTTP, not HTTPS)

**Which events would you like to trigger this webhook?**
- Select "Just the push event"

**Active:**
- ✅ Ensure this checkbox is checked

### Step 3: Save and Test

1. Click **Add webhook** or **Update webhook**
2. GitHub will send a test ping event
3. You should see a green checkmark if successful
4. Click on the webhook to view **Recent Deliveries**

### Step 4: Verify Webhook is Working

After saving, push a commit to the main branch and check:

1. **GitHub Side:** Check webhook Recent Deliveries tab for status
2. **VPS Side:** Check webhook logs:
   ```bash
   ssh root@147.79.66.3
   pm2 logs nakshatra-webhook --lines 20
   ```

## Expected Behavior

When you push to the main branch:
1. GitHub sends a webhook POST request to http://147.79.66.3:9000/webhook
2. Webhook server verifies the signature
3. Webhook server triggers the deploy script: `/var/tmp/NakshatraTalksBackend/deploy.sh`
4. Deploy script:
   - Pulls latest changes from GitHub
   - Installs dependencies
   - Builds the TypeScript code
   - Restarts PM2 process
5. Changes are live on production!

## Troubleshooting

### Check if webhook server is running:
```bash
ssh root@147.79.66.3 "pm2 list | grep webhook"
```

### Check webhook logs:
```bash
ssh root@147.79.66.3 "pm2 logs nakshatra-webhook --lines 50"
```

### Test webhook manually:
```bash
curl -X POST http://147.79.66.3:9000/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"ref":"refs/heads/main","repository":{"name":"test"},"pusher":{"name":"test"}}'
```

### Check deploy script:
```bash
ssh root@147.79.66.3 "bash /var/tmp/NakshatraTalksBackend/deploy.sh"
```

## Common Issues

1. **Webhook shows red X in GitHub:**
   - Check if port 9000 is accessible: `telnet 147.79.66.3 9000`
   - Check firewall rules on VPS
   - Verify webhook server is running

2. **Webhook receives event but doesn't deploy:**
   - Check if event is a push to main branch
   - Check webhook logs for errors
   - Verify deploy script has execute permissions: `chmod +x deploy.sh`

3. **Deploy script fails:**
   - Check deploy logs in PM2
   - Verify git credentials are set up
   - Check file permissions

## Security Note

The current setup uses HTTP without SSL. For production, consider:
- Setting up HTTPS with Let's Encrypt
- Using a reverse proxy (nginx) with SSL termination
- Restricting access to webhook endpoint by IP (GitHub's IP ranges)
