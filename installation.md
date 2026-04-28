# Installation And Setup

This guide explains how to run the current Aegis repository locally. Use [README.md](README.md) for the project overview, tech stack, and feature summary, and use this document for environment setup and startup commands.

## 1. Prerequisites

Install these tools before starting:

- Node.js 18 or newer
- npm
- PostgreSQL 15 or newer
- Git
- Docker Desktop if you want containerized setup
- Expo Go if you want to test the mobile app on a physical device

## 2. Clone The Repository

```bash
git clone <your-repository-url>
cd <your-repository-folder>
```

## 3. Install Dependencies

Install backend and frontend dependencies separately:

```bash
cd backend
npm install
cd ..

cd frontend
npm install
cd ..
```

## 4. Configure The Backend Environment

Create `backend/.env` by copying `backend/.env.example`.

Recommended starting values:

```env
DB_MODE=sql
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aegis?schema=public
JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRE=7d
PORT=3000
FRONTEND_URL=http://localhost:8081

GMAIL_ID=your-email@example.com
GMAIL_PASSWORD=your-app-password

API_BASE_URL=http://localhost:3000/api
API_BASE_URL_PRIMARY=http://localhost:3000/api
API_BASE_URL_SECONDARY=
API_HOST=localhost
API_PORT=3000

LIBRARY_LIMIT=60

EMERGENCY_MEDICAL_PHONE=9329594882
EMERGENCY_SECURITY_PHONE=7217492629
EMERGENCY_FIRE_PHONE=8618275578
EMERGENCY_OTHER_PHONE=7909069340
```

Notes:

- `DB_MODE` must remain `sql`
- `DATABASE_URL` is required for Prisma and PostgreSQL connectivity
- `JWT_SECRET` is required for auth tokens
- `GMAIL_ID` and `GMAIL_PASSWORD` are used for OTP mail delivery
- `frontend/app.config.js` reads API-related values from `backend/.env`, so setting them here is usually enough for local development

## 5. Prepare The Database

Create a PostgreSQL database named `aegis`, or use your own database name and update `DATABASE_URL`.

Then generate Prisma client and apply the committed migrations:

```bash
cd backend
npm run prisma:generate
npm run prisma:deploy
cd ..
```

If you are actively changing the schema during development, use:

```bash
cd backend
npm run prisma:migrate -- --name <migration_name>
cd ..
```

If you only want to sync schema quickly in a disposable local database:

```bash
cd backend
npm run prisma:push
cd ..
```

## 6. Optional Data Setup Scripts

The backend includes helper scripts for populating role data and syncing profile tables.

Examples:

```bash
node backend/scripts/ingest_to_db_students.js
node backend/scripts/ingest_to_db_wardens.js
node backend/scripts/ingest_to_db_guards.js
node backend/scripts/backfill_user_profiles.js
```

Dry-run variants are also supported for the ingest scripts.

## 7. Start The Backend

From the `backend` directory:

```bash
cd backend
npm run dev
```

The backend starts on:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

## 8. Start The Frontend

In a second terminal:

```bash
cd frontend
npm start
```

Useful Expo variants:

```bash
npm run web
npm run android
npm run ios
npx expo start --tunnel
```

## 9. Docker Setup

The root `docker-compose.yml` starts PostgreSQL, the backend, and Expo web.

Run:

```bash
docker compose up --build
```

Services exposed by default:

- PostgreSQL: `localhost:5432`
- Backend: `localhost:3000`
- Frontend Expo web: `localhost:8081`

Docker notes:

- The backend container runs `npm run prisma:push` before startup
- The compose file injects a container-safe `DATABASE_URL`
- Expo in Docker is best for the web target; native device testing is easier when Expo runs on the host machine

## 10. Quick Run Checklist

1. Start PostgreSQL
2. Copy `backend/.env.example` to `backend/.env` and fill in the values
3. Install dependencies in `backend` and `frontend`
4. Run Prisma generate and deploy commands
5. Start the backend with `npm run dev`
6. Start the frontend with `npm start`

## 11. Troubleshooting

### Prisma cannot connect to PostgreSQL

- Verify PostgreSQL is running
- Check username, password, host, port, and database name in `DATABASE_URL`
- Confirm the database exists before running Prisma commands

### Backend starts but tables are missing

Run:

```bash
cd backend
npm run prisma:generate
npm run prisma:deploy
cd ..
```

If you are using a temporary dev database, `npm run prisma:push` is also valid.

### Frontend cannot reach backend

- Check that the backend is running on port `3000`
- Confirm `API_BASE_URL` or `API_HOST` and `API_PORT` are correct in `backend/.env`
- Restart the frontend after changing `backend/.env` because Expo config is read at startup
- If using a physical phone, use a reachable LAN IP instead of `localhost`

### OTP email is not working

- Check `GMAIL_ID` and `GMAIL_PASSWORD`
- Use an app password, not the normal Gmail account password
- Restart the backend after changing environment variables

## 12. Useful Paths

- Backend schema: `backend/prisma/schema.prisma`
- Backend routes: `backend/routes/`
- Frontend screens: `frontend/screens/`
- Docker stack: `docker-compose.yml`
