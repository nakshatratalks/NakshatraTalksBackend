module.exports = {
  apps: [{
    name: "nakshatra-webhook",
    script: "./webhook-server.js",
    cwd: "/var/tmp/NakshatraTalksBackend",
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      WEBHOOK_SECRET: "nakshatra-webhook-secret-2024"
    },
    watch: false,
    max_memory_restart: "200M",
    error_file: "/var/log/pm2/nakshatra-webhook-error.log",
    out_file: "/var/log/pm2/nakshatra-webhook-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: "10s"
  }]
};
