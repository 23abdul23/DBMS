module.exports = {
  apps: [
    {
      name: "AegisBackend",
      script: "./server.js",

      out_file: "./logs/backend-out.log",
      error_file: "./logs/backend-error.log",

      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      autorestart: true,
      watch: false,
    },

    {
      name: "aegis-notification-worker",
      script: "./notifications/workers/notification.worker.js",

      out_file: "./logs/worker-out.log",
      error_file: "./logs/worker-error.log",

      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      autorestart: true,
      watch: false,
    },
  ],
}
