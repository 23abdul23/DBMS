# Aegis ID

Aegis ID is a mobile-first campus management system built as a DBMS-oriented project. It digitizes student identity and movement workflows across hostels, campus gates, emergency reporting, SAC spaces, and the library. The repository contains an Expo-based frontend, a Node.js/Express backend, and a PostgreSQL database managed through Prisma.

## Project Overview

The project is designed around real campus operations instead of a single ID-card screen. Its main goal is to centralize movement, approval, and safety workflows in one system so students, wardens, guards, and admins all work against the same database-backed records.

The current implementation is centered on:

- student authentication and profile management
- hostel outpass request and approval workflows
- security gate logging and QR-based movement tracking
- emergency alert creation and response handling
- SAC room presence and equipment checkout tracking
- library seat allocation and release flows
- auditability through relational records, status history, and logs

## Tech Stack Used

- Frontend: React Native with Expo
- Navigation and mobile UI: React Navigation, React Native libraries, Expo modules
- Backend: Node.js with Express
- Database: PostgreSQL
- ORM and schema management: Prisma
- Authentication and security: JWT, bcrypt, helmet, express-rate-limit
- Email/OTP support: Nodemailer
- Containerization: Docker and Docker Compose

## Features And Functionality

### Student

- register, log in, and manage profile data
- request regular or long-visit outpasses
- track outpass status and history
- cancel eligible outpass requests
- raise emergency alerts with location and optional media
- use SAC room and equipment workflows
- claim and release library seats

### Warden

- review hostel-specific outpass requests
- approve or reject student requests
- monitor student movement states
- view dashboard counts and outpass history

### Security

- scan QR-based student movement data
- record entry and exit activity
- validate whether students have valid approved outpasses
- log attempted exits without valid authorization

### Admin And System

- manage emergency workflows and status updates
- maintain student and operational records
- keep audit trails and movement logs
- run scheduled cleanup and lifecycle jobs on the backend

## Data Model Summary

The Prisma schema in [backend/prisma/schema.prisma](backend/prisma/schema.prisma) models the core entities behind the workflows, including:

- `User`, `StudentProfile`, `WardenProfile`, `SecurityProfile`
- `Outpass`, `OutpassAuditTrail`
- `Log`
- `Emergency`, `EmergencyMedia`, `EmergencyContactCall`
- `SacRoomSession`, `SacRoomPresence`, `SacEquipmentCheckout`
- `LibrarySeatSession`
- `Location`
- `PasswordUpdateOtp`

This schema is what makes Aegis a DBMS project rather than just a frontend app. The workflows are relational, stateful, and traceable.

## Repository Structure

```text
backend/
  config/        Database, Prisma, and auth configuration
  docs/          Backend-specific notes and migration helpers
  middleware/    Auth and lifecycle middleware
  prisma/        Prisma schema and migrations
  routes/        API route modules
  scripts/       Data ingestion and maintenance scripts
  utils/         Shared workflow logic

frontend/
  assets/        App assets and static resources
  components/    Reusable UI blocks
  context/       Shared app state providers
  navigation/    Navigation stacks and tabs
  screens/       Role-based screens
  services/      API client wrappers
  styles/        Screen-level styling
```

## Steps To Run The Project

For complete setup details, see [installation.md](installation.md). The short version is:

1. Install dependencies in `backend` and `frontend`.
2. Create `backend/.env` from `backend/.env.example`.
3. Start PostgreSQL and set `DATABASE_URL`.
4. Run Prisma setup commands from `backend`.
5. Start the backend with `npm run dev`.
6. Start the frontend with `npm start`.

## Documentation

- Project setup and local run guide: [installation.md](installation.md)
- Team work split: [Work_Distribution.md](Work_Distribution.md)
- Backend SQL bootstrap note: [backend/docs/sql-migration-bootstrap.md](backend/docs/sql-migration-bootstrap.md)
- Script command reference: [backend/scripts/commands.md](backend/scripts/commands.md)
