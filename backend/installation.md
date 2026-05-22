# Backend Installation And Setup

This guide covers the backend-only setup for Aegis: PostgreSQL, Prisma, Redis, the Express API, and the notification worker.

## 1. Prerequisites

Install these tools before starting:

- Node.js 18 or newer
- npm
- PostgreSQL 15 or newer
- Redis 6 or newer for notifications
- Git
- Docker Desktop if you want containerized Redis or database services

## 2. Install Dependencies

From the repository root:

```bash
cd backend
npm install
```

## 3. Configure The Backend Environment

Create `backend/.env` by copying `backend/.env.example`.

Recommended starting values:

```env
DB_MODE=sql
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aegis?schema=public
JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRE=7d
PORT=5000
FRONTEND_URL=http://localhost:8081

GMAIL_ID=your-email@example.com
GMAIL_PASSWORD=your-app-password

API_BASE_URL=http://localhost:5000/api
API_BASE_URL_PRIMARY=http://localhost:5000/api
API_BASE_URL_SECONDARY=
API_HOST=localhost
API_PORT=5000
ENVIRONEMENT=development

LIBRARY_LIMIT=60

EMERGENCY_MEDICAL_PHONE=9329594882
EMERGENCY_SECURITY_PHONE=7217492629
EMERGENCY_FIRE_PHONE=8618275578
EMERGENCY_OTHER_PHONE=7909069340
```

Notes:

- `DB_MODE` should stay `sql` for the current Prisma/PostgreSQL setup.
- `DATABASE_URL` is required for Prisma.
- `JWT_SECRET` is required for auth tokens.
- `GMAIL_ID` and `GMAIL_PASSWORD` are used for OTP email delivery.
- `API_BASE_URL` values are read by the frontend config.
- `ENVIRONEMENT=development` enables the login quick-login button.

## 4. Prepare The Database

Run Prisma generate and apply migrations:

```bash
cd backend
npm run prisma:generate
npm run prisma:deploy
```

If you are actively changing the schema during development, use:

```bash
cd backend
npm run prisma:migrate -- --name <migration_name>
```

If you only want to sync the schema quickly in a disposable local database:

```bash
cd backend
npm run prisma:push
```

## 5. Start Redis

The notification queue uses Redis.

Local example:

```bash
redis-server
```

If Redis is not running, notification jobs will fail to queue or process.

## 6. Start The Backend API

From the `backend` directory:

```bash
cd backend
npm run dev
```

The backend starts on:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

## 7. Start The Notification Worker

Notification delivery is handled by a separate BullMQ worker process.

Run it from the backend directory:

```bash
cd backend
node notifications/workers/notification.worker.js
```

The worker listens to the `notifications` queue, creates notification records, then delivers pushes through direct FCM/APNs providers.

## 8. PM2 Notes

If you use pm2 on your server, run these as separate processes:

```bash
cd /path/to/Aegis/backend
pm2 start server.js --name aegis-api
pm2 start notifications/workers/notification.worker.js --name aegis-notification-worker
pm2 save
```

See `backend/PM2_SERVER_SETUP.md` for the full pm2 runbook.

## 9. Troubleshooting

### Backend returns 502

- Confirm the API process is running.
- Check the pm2 or node logs for startup errors.
- Verify PostgreSQL is reachable and `DATABASE_URL` is correct.
- Verify Redis is reachable so the notification queue can initialize.

### Notification jobs do not run

- Make sure the worker process is running.
- Check Redis connectivity.
- Confirm the queue name is still `notifications`.

### Prisma cannot connect to PostgreSQL

- Verify PostgreSQL is running.
- Check username, password, host, port, and database name in `DATABASE_URL`.
- Confirm the database exists before running Prisma commands.

### Useful Paths

- Backend schema: `backend/prisma/schema.prisma`
- Backend routes: `backend/routes/`
- Notification queue: `backend/notifications/queues/notification.queue.js`
- Notification worker: `backend/notifications/workers/notification.worker.js`
