# Aegis ID

Aegis ID is a mobile-first campus management system built as a DBMS-oriented project for digitizing student movement, hostel outpass handling, security logging, library seating, SAC activity, and emergency support. The repository contains a React Native Expo client, a Node.js/Express backend, and a PostgreSQL database managed through Prisma.

## What The Project Covers

The current codebase is organized around real campus workflows instead of a single ID-card module. It supports:

- Role-based access for `student`, `warden`, `security`, and `admin`
- Student registration, login, profile updates, and password change flows
- Hostel outpass requests with approval, rejection, cancellation, expiry, and audit trails
- Warden dashboards for request handling and hostel-level student monitoring
- Security gate logging with QR-based entry and exit tracking
- Detection and recording of exit attempts without an approved outpass
- Emergency alert creation with location, media attachments, and admin response tracking
- SAC club room occupancy and equipment checkout management
- Library token and seat allocation with occupancy overview
- Central logging and activity history for DB-backed traceability

## Why It Is A DBMS Project

This project is not only a frontend app. Its core design depends on database modeling and relational workflows:

- Users are normalized into a shared `users` table with role-specific profile tables
- Outpasses, emergencies, security logs, SAC sessions, equipment checkouts, and library seats are stored as separate relational entities
- Prisma schema enums encode role, status, action, and workflow constraints
- Audit trail tables preserve state changes for accountability
- Indexed queries support dashboards, monitoring views, filtering, and history screens
- Transactions are used in critical workflows such as outpass state changes, SAC activity, and library seat assignment

## Main Features

### Student Features

- Sign up and log in with role-aware authentication
- Maintain personal profile, hostel, room, department, and contact details
- Request regular or long-visit outpasses
- Track current outpass status and full history
- Cancel valid requests before departure
- View personal movement and workflow logs
- Raise emergency alerts with location and optional media
- Join SAC rooms, leave rooms, take equipment, and return equipment
- Claim and release library seats
- Scan guard/location QR flows where enabled by the security workflow

### Warden Features

- Hostel-specific dashboard with pending, approved, expired, and returned counts
- Request approval, rejection, and cancellation actions
- View detailed outpass records and audit remarks
- Monitor which hostel students are inside or outside campus
- Detect yellow-alert, danger, overdue, and ongoing outpass states

### Security Features

- Scan student QR data and create entry/exit movement logs
- Validate whether an approved outpass exists before allowing exit
- Record warning logs for students attempting exit without a valid outpass
- Fetch searchable, filterable security logs by date range and location

### Admin And System Features

- Emergency administration endpoints for active alerts, history, status updates, and statistics
- Student listing and status management endpoints
- Health check endpoint and database-mode aware backend startup
- Optional ingestion and backfill scripts for role/profile data
- Docker-based local deployment for database, backend, and Expo web

## Data Model Overview

The Prisma schema currently models these major entities:

- `User`, `StudentProfile`, `WardenProfile`, `SecurityProfile`
- `Outpass`, `OutpassAuditTrail`
- `Log`
- `Emergency`, `EmergencyMedia`, `EmergencyContactCall`
- `SacRoomSession`, `SacRoomPresence`, `SacEquipmentCheckout`
- `LibrarySeatSession`
- `Location`
- `PasswordUpdateOtp`

This schema is the backbone of the project and is what makes the workflow traceable and reportable as a DBMS system.

## Tech Stack

- Frontend: React Native, Expo, React Navigation
- Backend: Node.js, Express
- Database: PostgreSQL
- ORM and schema management: Prisma
- Authentication: JWT, bcrypt
- DevOps: Docker Compose

## Repository Structure

```text
backend/
  config/        Database, Prisma, JWT configuration
  middleware/    Auth and outpass expiry middleware
  prisma/        Prisma schema and migrations
  routes/        API route modules
  scripts/       Data ingestion and maintenance helpers
  utils/         Shared workflow and business logic

frontend/
  screens/       Student, warden, and guard-facing screens
  navigation/    Main navigation stacks and tabs
  components/    Reusable UI blocks
  context/       Auth, location, screenshot, and theme state
  services/      API client wrappers
  styles/        Screen-level styling
```

## Key Backend Modules

- `backend/routes/authRoutes.js`: registration, login, shared profile endpoints
- `backend/routes/outpassRoutes.js`: student outpass creation, history, and cancellation
- `backend/routes/wardenRoutes.js`: warden dashboard, approvals, and monitoring
- `backend/routes/securityRoutes.js`: gate logging and log retrieval
- `backend/routes/emergencyRoutes.js`: emergency alert creation and admin handling
- `backend/routes/sacRoutes.js`: SAC room and equipment workflows
- `backend/routes/libraryRoutes.js`: library seat assignment and release
- `backend/prisma/schema.prisma`: complete relational schema and enums

## Documentation

- Setup guide: [INSTALLATION.md](INSTALLATION.md)
- Team contribution breakdown: [Work_Distribution.md](Work_Distribution.md)
- Refactoring notes: [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md)

## Current Status

The project already contains an operational backend route structure, Prisma migrations, Docker support, and a multi-role Expo frontend. The strongest implemented modules at present are outpass management, gate/security logging, SAC tracking, library seating, profile handling, and emergency workflows.
