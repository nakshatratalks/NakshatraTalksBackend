# VPS Analysis and Fix Report - NakshatraTalks Backend

**Date:** 2025-11-21
**VPS:** 147.79.66.3
**Repository:** nakshatratalks/NakshatraTalksBackend

---

## Executive Summary

✅ **Swagger UI Issue:** FIXED
⚠️ **CI/CD Webhook:** NEEDS MANUAL CONFIGURATION

---

## Issues Identified and Fixed

### 1. Swagger UI Not Showing Updated Endpoints ✅ FIXED

#### Root Cause
The Swagger configuration file (`server/src/config/swagger.ts`) was using incorrect paths for production:
- **Incorrect:** `./dist/routes/*.js`
- **Correct:** `./server/dist/routes/*.js`

**Why this happened:**
- PM2 runs with `cwd=/var/tmp/NakshatraTalksBackend`
- The compiled files are in `/var/tmp/NakshatraTalksBackend/server/dist/`
- Swagger was looking in `/var/tmp/NakshatraTalksBackend/dist/` (doesn't exist)
- This caused Swagger to not find any route files to scan for JSDoc comments

#### Fix Applied
Updated `server/src/config/swagger.ts:69-71`:

```typescript
// Before
apis: process.env.NODE_ENV === 'production'
  ? ['./dist/routes/*.js', './dist/controllers/*.js', ...]
  : ['./src/routes/*.ts', './src/controllers/*.ts', ...]

// After
apis: process.env.NODE_ENV === 'production'
  ? ['./server/dist/routes/*.js', './server/dist/controllers/*.js', ...]
  : ['./server/src/routes/*.ts', './server/src/controllers/*.ts', ...]
```

#### Verification
```bash
# Verified on VPS
curl -s http://localhost:4000/api-docs.json | python3 -c 'import sys, json; ...'
```

**Result:** ✅ All 16 API endpoints now show correctly in Swagger UI at http://147.79.66.3:4000/api-docs/

**Endpoints now available:**
- /health
- /auth/send-otp
- /auth/verify-otp
- /auth/me
- /auth/admin/signin
- /auth/admin/signup
- /auth/admin/me
- /auth/admin/link-user
- /api/v1/users/profile
- /api/v1/astrologers/live
- /api/v1/astrologers/top-rated
- /api/v1/astrologers/{id}
- /api/v1/astrologers/{id}/live-status
- /api/v1/admin/users
- /api/v1/admin/astrologers
- /api/v1/admin/astrologers/{id}

---

### 2. CI/CD Webhook Not Triggering ⚠️ NEEDS MANUAL SETUP

#### Root Cause
GitHub webhook is either:
1. Not configured in the repository
2. Configured with incorrect URL or secret
3. Not active or misconfigured

#### Investigation Results

**Webhook Server Status:** ✅ Running correctly
```bash
pm2 list | grep webhook
# nakshatra-webhook | online | port 9000
```

**Server Configuration:**
- URL: http://147.79.66.3:9000/webhook
- Secret: nakshatra-webhook-secret-2024
- Listening on: 0.0.0.0:9000

**Evidence:**
- Manual POST requests to webhook endpoint work correctly
- Server logs show it's listening and ready
- Deploy script exists and has correct permissions
- No GitHub webhook events received (checked logs)

#### Action Required: Configure GitHub Webhook

**Steps to fix:**
1. Go to https://github.com/nakshatratalks/NakshatraTalksBackend/settings/hooks
2. Click "Add webhook" or edit existing webhook
3. Configure:
   - **Payload URL:** `http://147.79.66.3:9000/webhook`
   - **Content type:** `application/json`
   - **Secret:** `nakshatra-webhook-secret-2024`
   - **SSL verification:** Disable (using HTTP)
   - **Events:** Just the push event
   - **Active:** ✅ Checked

4. Save and verify:
   - GitHub will send a test ping
   - Check "Recent Deliveries" tab for green checkmark
   - Push a commit to test

**Reference:** See `WEBHOOK_SETUP_GUIDE.md` for detailed instructions

---

## Changes Deployed to VPS

### Files Modified:
1. `server/src/config/swagger.ts` - Fixed Swagger paths for production

### Files Created:
1. `WEBHOOK_SETUP_GUIDE.md` - Comprehensive webhook configuration guide
2. `test-webhook.sh` - Script to test webhook endpoint locally
3. `VPS_ANALYSIS_REPORT.md` - This report

### VPS Actions Performed:
1. ✅ Pulled latest changes from GitHub
2. ✅ Rebuilt TypeScript server (`npm run build`)
3. ✅ Restarted PM2 API process
4. ✅ Verified Swagger endpoints are working

---

## Current VPS Status

### PM2 Processes:
```
nakshatra-api      | online | port 4000 | /var/tmp/NakshatraTalksBackend/server/dist/server.js
nakshatra-webhook  | online | port 9000 | /var/tmp/NakshatraTalksBackend/webhook-server.js
```

### Git Status:
```
Branch: main
Latest commit: 2fb6ca7 (Add comprehensive GitHub webhook setup guide)
Status: Clean, up to date with origin/main
```

### Services Working:
- ✅ API Server: http://147.79.66.3:4000
- ✅ Health Check: http://147.79.66.3:4000/health
- ✅ Swagger UI: http://147.79.66.3:4000/api-docs
- ✅ Webhook Server: http://147.79.66.3:9000/webhook
- ⚠️ GitHub Webhook: Needs manual configuration

---

## Testing & Verification

### Test Swagger UI (Locally):
```bash
# Check if all endpoints are showing
curl -s http://147.79.66.3:4000/api-docs.json | grep -o '"\/[^"]*":' | wc -l
# Should show: 16
```

### Test Webhook (Locally):
```bash
# Run the test script
bash test-webhook.sh

# Or manually:
curl -X POST http://147.79.66.3:9000/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"ref":"refs/heads/main","repository":{"name":"test"},"pusher":{"name":"test"}}'
```

### Verify on VPS:
```bash
# SSH into VPS
ssh root@147.79.66.3

# Check PM2 status
pm2 list

# Check API logs
pm2 logs nakshatra-api --lines 20

# Check webhook logs
pm2 logs nakshatra-webhook --lines 20

# Check if latest code is deployed
cd /var/tmp/NakshatraTalksBackend && git log -1 --oneline
```

---

## Next Steps

### Immediate Actions Required:

1. **Configure GitHub Webhook** ⚠️ HIGH PRIORITY
   - Follow instructions in `WEBHOOK_SETUP_GUIDE.md`
   - Configure webhook at https://github.com/nakshatratalks/NakshatraTalksBackend/settings/hooks
   - Test by pushing a small commit

2. **Verify Swagger UI in Browser**
   - Open http://147.79.66.3:4000/api-docs/
   - Confirm all 16 endpoints are visible
   - Test a few endpoints to ensure they work

3. **Test CI/CD Pipeline**
   - After configuring webhook, make a small change
   - Push to main branch
   - Verify webhook triggers deployment
   - Check if changes appear on production

### Optional Improvements:

1. **Add HTTPS to webhook endpoint**
   - Set up Let's Encrypt SSL certificate
   - Configure nginx reverse proxy
   - Update webhook URL to use HTTPS

2. **Add deployment notifications**
   - Send Slack/Discord notification on successful deployment
   - Email alerts for failed deployments

3. **Add automated testing**
   - Run tests before deployment
   - Abort deployment if tests fail

---

## Summary of Commits

All fixes have been committed to the main branch:

1. `4ac380e` - Fix Swagger API paths to match PM2 working directory structure
2. `2fb6ca7` - Add comprehensive GitHub webhook setup guide

**Both local PC and VPS are now in sync with these changes.**

---

## Contact & Support

If you encounter any issues:
1. Check PM2 logs: `pm2 logs [process-name]`
2. Check this report and the guides
3. Review GitHub webhook "Recent Deliveries" for errors

---

**Report Generated By:** Claude Code
**Analysis Completed:** 2025-11-21 06:45 UTC
