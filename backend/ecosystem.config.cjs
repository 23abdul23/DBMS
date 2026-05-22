module.exports = {
  apps: [
    {
      name: "AegisBackend",
      script: "./server.js",

      out_file: "./logs/backend.log",
      error_file: "./logs/backend.log",

      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      autorestart: true,
      watch: false,
    },

    {
      name: "aegis-notification-worker",
      script: "./notifications/workers/notification.worker.js",

      out_file: "./logs/notification-worker.log",
      error_file: "./logs/notification-worker.log",

      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      autorestart: true,
      watch: false,
    },
  ],
}
