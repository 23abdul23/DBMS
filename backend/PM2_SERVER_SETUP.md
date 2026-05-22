# PM2 Server Setup For Aegis

This guide documents the pm2 processes required to run the backend on a server. You **must run both processes** for notifications to work end-to-end.

## Processes To Run

You should run **at least these two separate pm2 processes**:

1. **API process** (`backend/server.js`): Express API, routes, event listeners
2. **Notification Worker** (`backend/notifications/workers/notification.worker.js`): BullMQ worker that processes notification jobs

Redis and PostgreSQL are external services that should be running before starting pm2 processes.

## Prerequisites

Before starting pm2, verify:

- ✅ PostgreSQL is running and DATABASE_URL is correct
- ✅ Redis is running on localhost:6379
- ✅ backend/.env has PORT, JWT_SECRET, and DATABASE_URL set
- ✅ npm install completed in backend/

## Option 1: Manual pm2 Commands (Simplest)

From the backend directory:

```bash
cd /path/to/Aegis/backend

# Start API process
pm2 start server.js --name aegis-api

# Start Notification Worker
pm2 start notifications/workers/notification.worker.js --name aegis-notification-worker

# Save process list to survive reboot
pm2 save
```

### Make processes restart on server reboot:

```bash
pm2 startup
# Copy and run the output command (specific to your OS)

pm2 save
```

---

## Option 2: Ecosystem File (Recommended for Production)

Create `backend/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "aegis-api",
      script: "./server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "./logs/aegis-api-error.log",
      out_file: "./logs/aegis-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
    {
      name: "aegis-notification-worker",
      script: "./notifications/workers/notification.worker.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/aegis-worker-error.log",
      out_file: "./logs/aegis-worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
}
```

Start with ecosystem file:

```bash
cd /path/to/Aegis/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Common Admin Commands

```bash
# View all processes
pm2 list
pm2 status

# View logs
pm2 logs aegis-api
pm2 logs aegis-notification-worker
pm2 logs  # all logs

# Real-time monitoring
pm2 monit

# Restart specific process
pm2 restart aegis-api
pm2 restart aegis-notification-worker
pm2 restart all

# Stop specific process
pm2 stop aegis-api
pm2 stop aegis-notification-worker
pm2 stop all

# Delete processes
pm2 delete aegis-api
pm2 delete aegis-notification-worker
pm2 delete all

# Clear logs
pm2 flush
```

---

## What Each Process Does

### aegis-api (server.js)

**Purpose**: Express API server that handles all HTTP requests

**What it does**:

- Listens on PORT (default 5000)
- Registers all API routes (/auth, /outpass, /notifications, etc.)
- Authenticates requests with JWT
- Emits notification events when wardens approve/reject outpasses
- **Adds notification jobs to Redis queue** when events are emitted

**Logs to watch for**:

```
🚀 Aegis ID Backend running on port 5000
Route: /api/notifications
eventBus.on('OUTPASS_APPROVED', async (payload) => ...
```

**Fails if**:

- PORT is already in use
- Cannot connect to PostgreSQL
- Cannot connect to Redis

---

### aegis-notification-worker (notification.worker.js)

**Purpose**: Long-running process that consumes notification jobs from Redis queue and sends native push notifications

**What it does**:

- Connects to Redis queue named `"notifications"`
- Listens for `"send-notification"` and `"send-push-delivery"` jobs
- For each notification:
  1. Creates notification record in database
  2. Fetches user's active native push tokens
  3. Queues one delivery job per device
- For each delivery:
  1. Sends direct FCM or APNs push
  2. Updates retry/failure state in `notification_deliveries`
- Logs successes and failures with `[Worker]` and `[Delivery]` prefixes

**Logs to watch for**:

```
[Worker] 🚀 Notification worker started and listening for jobs...
[Worker] Queue: 'notifications' | Redis: localhost:6379
[Worker] Processing send-notification job abc123...
[Worker] Processing send-push-delivery job def456...
[Delivery] Delivered notification xyz789 via FCM to token pushToken123 on attempt 1
```

**Fails if**:

- Cannot connect to Redis
- Cannot connect to PostgreSQL
- No push tokens exist for the user

---

## Troubleshooting

### Process keeps restarting

Check logs:

```bash
pm2 logs aegis-api
# Look for error messages in the output
```

Common causes:

- Missing PORT binding → Change PORT in .env or kill process using the port
- Database connection failed → Verify DATABASE_URL and PostgreSQL is running
- Redis connection failed → Verify Redis is running on localhost:6379

### API shows 502 behind nginx

```bash
pm2 status
# Check if aegis-api shows 'online'

pm2 logs aegis-api --err
# Check for startup errors

# If process died, restart it:
pm2 restart aegis-api
```

### Notifications not being sent

```bash
pm2 logs aegis-notification-worker
# Should see [Worker] logs

# If worker is not online:
pm2 status aegis-notification-worker
pm2 restart aegis-notification-worker

# Check for Redis connection issues
redis-cli ping  # Should return PONG
```

### Jobs queued but not processed

1. Verify worker is running:

   ```bash
   pm2 status aegis-notification-worker
   ```

2. Check worker logs:

   ```bash
   pm2 logs aegis-notification-worker
   ```

3. Check Redis queue:

   ```bash
   redis-cli
   > LLEN bull:notifications:wait
   # If > 0, jobs are waiting
   ```

4. If worker crashed:
   ```bash
   pm2 restart aegis-notification-worker
   ```

### Port 5000 already in use

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

---

## Environment Variables Required

Make sure `backend/.env` has:

```env
# Server
PORT=5000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/aegis

# Auth
JWT_SECRET=very-long-secret-string-here

# API URLs (for frontend)
API_BASE_URL=https://api.aegisid.app/api
API_HOST=api.aegisid.app

# Redis (if not localhost:6379)
REDIS_HOST=localhost
REDIS_PORT=6379

# Email (for OTP)
GMAIL_ID=your-email@gmail.com
GMAIL_PASSWORD=app-specific-password

# Emergency contacts
EMERGENCY_MEDICAL_PHONE=9329594882
```

---

## Deployment Checklist

- [ ] PostgreSQL running and DATABASE_URL verified
- [ ] Redis running on configured host:port
- [ ] backend/.env configured with all required variables
- [ ] `pm2 start server.js --name aegis-api` shows online
- [ ] `pm2 start notifications/workers/notification.worker.js --name aegis-notification-worker` shows online
- [ ] `pm2 save` executed
- [ ] `pm2 startup` generated and executed (for reboot persistence)
- [ ] `pm2 logs` shows no critical errors
- [ ] Test API: `curl http://localhost:5000/api/health`
- [ ] Frontend can register push tokens
- [ ] Frontend can retrieve notifications
- [ ] Warden can approve/reject outpass and notification is delivered

---

## Health Checks

### API Health

```bash
curl http://localhost:5000/api/health
# Should return: {"status":"OK","message":"Aegis ID Backend is running",...}
```

### Redis Connection

```bash
redis-cli ping
# Should return: PONG
```

### Database Connection

```bash
# From backend directory
npx prisma db execute --stdin < /dev/null
# Should not error
```

### Queue Status

```bash
redis-cli
> KEYS bull:notifications*
# Should see queue-related keys if worker is processing
```

---

## Performance Tips

1. **Memory**: Set `max_memory_restart` in ecosystem file to auto-restart if over limit
2. **Watch Mode**: Keep `watch: false` in production; use CI/CD for deploys
3. **Instances**: Keep API at 1 instance if no load balancer; use 2-4 with nginx
4. **Logs**: Enable log file rotation or use a log aggregator like CloudWatch/Datadog
5. **Redis**: Use Redis persistence (RDB/AOF) in production
6. **Monitoring**: Use `pm2 monit` or third-party monitoring for alerts

---

## Further Reading

- [PM2 Documentation](https://pm2.keymetrics.io/docs)
- [BullMQ Documentation](https://docs.bullmq.io)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
