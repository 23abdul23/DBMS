# SQL Migration Bootstrap

This document tracks the first implementation milestone for moving Aegis backend data from MongoDB/Mongoose to PostgreSQL/Prisma.

## What is now in place

1. Prisma schema scaffold at `prisma/schema.prisma`
2. Prisma client bootstrap at `backend/config/prisma.js`
3. Database mode selector at `backend/config/database.js`
4. Server startup now supports `DB_MODE=mongo|sql|hybrid`
5. New npm scripts for Prisma and backend startup in `package.json`
6. Prisma CLI dependency added to `devDependencies`

## Environment variables

Required for SQL mode:

- `DB_MODE=sql` or `DB_MODE=hybrid`
- `DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public`

Existing Mongo values continue to work when `DB_MODE=mongo`.

## Runbook

1. Install dependencies:
   - `npm install`
2. Generate Prisma client:
   - `npm run prisma:generate`
3. Create first migration:
   - `npm run prisma:migrate -- --name init_sql_schema`
4. Start backend in current default mode:
   - `npm run backend:dev`
5. Start backend in SQL mode after DB is ready:
   - `DB_MODE=sql npm run backend:dev`

Useful local query helpers:

- `npm run test:prisma` runs a small Prisma client playground query and prints the result table.
- `npm run sql -- "SELECT id, name, email FROM users LIMIT 5"` runs a direct SQL query against the current database.

## Notes

- This is only the bootstrap milestone. Routes still use Mongoose models.
- Next milestone is repository adapters and first route migration (auth + profile reads).
- The Prisma schema currently uses string IDs to support safer phased migration with existing ObjectId values.
- `ScanType` now includes `nfc` to preserve current log behavior.
