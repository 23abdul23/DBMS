# Backend Quick Setup Commands

## Fast Start

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:deploy
redis-server
npm run dev
```

## Notification Worker

Run the worker in a second terminal:

```bash
cd backend
node notifications/workers/notification.worker.js
```

## Optional Seed Commands

```bash
cd backend
npm run seed:dev-dummy
```

## Health Check

```text
http://localhost:5000/api/health
```

## If You Use PM2

```bash
cd /path/to/Aegis/backend
pm2 start server.js --name aegis-api
pm2 start notifications/workers/notification.worker.js --name aegis-notification-worker
pm2 save
```
