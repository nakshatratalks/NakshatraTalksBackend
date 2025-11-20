const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');

// Configuration
const PORT = 9000;
const DEPLOY_SCRIPT = '/var/tmp/NakshatraTalksBackend/deploy.sh';
const SECRET = process.env.WEBHOOK_SECRET || 'nakshatra-webhook-secret-2024';

// Verify GitHub signature
function verifySignature(payload, signature) {
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// Execute deployment script
function deploy() {
  console.log('🚀 Triggering deployment...');

  exec(DEPLOY_SCRIPT, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Deployment error:', error);
      console.error(stderr);
      return;
    }
    console.log('✅ Deployment output:');
    console.log(stdout);
  });
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Only accept POST requests to /webhook
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      // Get GitHub signature
      const signature = req.headers['x-hub-signature-256'];

      // Verify signature (optional - comment out if not using secrets)
      if (signature && !verifySignature(body, signature)) {
        console.error('❌ Invalid signature');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      const payload = JSON.parse(body);

      // Log webhook event
      console.log('📨 Webhook received:', {
        event: req.headers['x-github-event'],
        repository: payload.repository?.name,
        branch: payload.ref,
        pusher: payload.pusher?.name
      });

      // Only deploy on push events to main/master branch
      const isPushEvent = req.headers['x-github-event'] === 'push';
      const isMainBranch = payload.ref === 'refs/heads/main' || payload.ref === 'refs/heads/master';

      if (isPushEvent && isMainBranch) {
        deploy();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Deployment triggered' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'No deployment triggered' }));
      }
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🎣 Webhook server listening on port', PORT);
  console.log('📝 Webhook URL: http://147.79.66.3:' + PORT + '/webhook');
  console.log('🔐 Secret:', SECRET);
});
