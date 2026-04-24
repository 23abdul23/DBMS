# Installation Guide - Aegis ID

This guide explains how to set up and run the current Aegis ID repository with the PostgreSQL + Prisma backend and the Expo mobile app.

---

## Docker Quick Start

If you want the full stack in containers, run this from the repository root:

```bash
docker compose up --build
```

This starts PostgreSQL, the backend API, and Expo web.

Expo in Docker is recommended only for the web target. For phone-based Expo Go development, run the frontend locally on your machine and point it at the backend service or your host IP.

---

## 1. Prerequisites

Install these tools first:

- Node.js 18 or newer
- npm
- Git
- PostgreSQL 15 or newer
- Expo Go on your phone if you want to test the mobile app

Optional but useful:

- `psql` or another PostgreSQL client
- Prisma Studio for browsing data after the schema is generated

---

## 2. Clone the repository

```bash
git clone https://github.com/<YOUR-USERNAME>/<YOUR-REPO>.git
cd <YOUR-REPO>
```

---

## 3. Install dependencies

Install backend and frontend dependencies separately:

```bash
cd backend
npm install
cd ..
cd frontend
npm install
cd ..
```

---

## 4. Create the PostgreSQL database

Create a database for the backend, either locally or on a hosted PostgreSQL service.

Example local setup:

```bash
createdb aegis
```

If you are using a cloud database, copy the connection string from your provider.

The Prisma schema expects a URL in this format:

```env
postgresql://USER:PASSWORD@HOST:5432/DB?schema=public
```

---

## 5. Configure environment variables

Create `backend/.env`.

You can use `backend/.env.example` as a template.

```env
DB_MODE=sql
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?schema=public
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRE=7d
PORT=3000
FRONTEND_URL=http://localhost:8081
GMAIL_ID=your-email@example.com
GMAIL_PASSWORD=your-app-password
EMERGENCY_MEDICAL_PHONE=9329594882
EMERGENCY_SECURITY_PHONE=7217492629
EMERGENCY_FIRE_PHONE=8618275578
EMERGENCY_OTHER_PHONE=7909069340
```

Notes:

- `DB_MODE` must stay `sql`
- `DATABASE_URL` is required for Prisma
- `FRONTEND_URL` is used for CORS when you run the mobile app or Expo web
- `GMAIL_ID` and `GMAIL_PASSWORD` are required for the password reset flow
- The backend Docker compose service reads `backend/.env` and overrides the database URL for the container network

---

## 6. Generate Prisma client and database tables

From the `backend` folder, run:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate -- --name init
cd ..
```

Useful Prisma commands:

```bash
npm run prisma:studio
npm run prisma:deploy
```

If you are starting the backend in Docker, the container now runs `prisma db push` automatically before `npm start`, so a fresh database gets the tables created on first boot.

---

## 7. Start the backend server

Run the backend from the repository root:

```bash
npm run backend:dev
```

If you want a one-time start without file watching:

```bash
npm run backend:start
```

Expected backend output:

```text
Aegis ID Backend running on port 3000
Database mode: sql
Health check: http://localhost:3000/api/health
```

Test the backend health endpoint:

```bash
curl http://localhost:3000/api/health
```

---

## 8. Start the mobile app

In a second terminal, from the repository root:

```bash
npm start
```

This starts Expo and shows a QR code. Open it with Expo Go on your phone, or run one of these variants:

```bash
npx expo start --android
npx expo start --ios
npx expo start --tunnel
```

---

## 9. Common setup workflow

A typical local development session looks like this:

1. Create or start PostgreSQL
2. Set `DATABASE_URL` in `.env`
3. Run `npm install`
4. Run `npm run prisma:generate`
5. Run `npm run prisma:migrate -- --name init`
6. Run `npm run backend:dev`
7. Run `npm start` for Expo

---

## 10. Troubleshooting

### Backend fails with `DATABASE_URL is required`

- Make sure the `.env` file exists at the repository root
- Confirm `DATABASE_URL` is spelled correctly
- Restart the terminal after editing `.env`

### Prisma says the client is not generated

Run:

```bash
npm run prisma:generate
```

### Prisma cannot connect to PostgreSQL

- Check the host, port, username, and password
- Confirm the database exists
- Confirm PostgreSQL is running
- Check firewall or cloud IP allow-list rules

### Docker starts the backend but registration still fails with `users does not exist`

- Rebuild the backend image so the new startup command is picked up
- Make sure the database volume is not pointing at an old incompatible schema
- If needed, run `cd backend && npm run prisma:push` once against the target database to create the tables

### Expo cannot reach the backend

- Make sure the backend is running
- Verify `FRONTEND_URL` and CORS values
- Use the same Wi-Fi network on phone and laptop
- If needed, run Expo in tunnel mode

---

## 11. Security notes

- Never commit `.env` to Git
- Use a strong `JWT_SECRET`
- Use a PostgreSQL user with only the permissions the app needs
- Use a real app password or SMTP credential for email sending

---

## 12. Current backend stack

- Node.js / Express
- PostgreSQL
- Prisma 7
- JWT authentication
- bcrypt password hashing
- SHA-256 passkey generation
- Expo mobile client
