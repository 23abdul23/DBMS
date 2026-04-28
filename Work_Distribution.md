# Work Distribution

## 1. Kavyan

### Primary Ownership

- Student-facing UI and shared frontend experience
- Guard workflow and security movement logging flow
- Frontend integration of dashboard navigation and scan-based interactions

### Main Features Covered

- Student dashboard and navigation flow
- Login and register screen integration
- Guard-facing scan workflow and logbook experience
- QR-based gate activity flow between student and security modules
- General reusable UI components and screen-level flow consistency

### Main Code Areas

- `frontend/App.js`
- `frontend/navigation/MainTabNavigator.js`
- `frontend/screens/DashboardScreen.js`
- `frontend/screens/ScannerScreen.js`
- `frontend/screens/GuardScreen.js`
- `frontend/screens/LogBookScreen.js`
- `frontend/components/`
- `frontend/services/api.js` for security-facing integration
- `backend/routes/securityRoutes.js` for guard scan and log flow coordination

### What This Work Does

- Gives students and security staff a usable mobile workflow
- Connects QR scanning actions to backend logging APIs
- Presents movement history in a readable way
- Keeps the UI aligned with actual backend roles and actions

### DBMS Contribution

- Worked with the `logs` table and `LogAction` / `ScanType` enums
- Helped define how entry, exit, outpass-warning, and security scan records are stored
- Used filtered log queries for date ranges, search, pagination, and guard-level reporting
- Ensured the security workflow is not just UI-driven but backed by persistent database records

## 2. Adith

### Primary Ownership

- Library section end to end
- Library seat allocation workflow
- Capacity tracking and token-based occupancy management

### Main Features Covered

- Library overview screen
- Seat claim and release actions
- Live occupancy summary
- Activity feed for seat usage
- Capacity control based on configured library limits

### Main Code Areas

- `frontend/screens/LibraryScreen.js`
- `frontend/styles/LibraryStyles.js`
- `frontend/services/api.js` for library API usage
- `backend/routes/libraryRoutes.js`
- `backend/utils/libraryActivity.js`
- `backend/utils/campusActivityRules.js`
- Prisma models related to `LibrarySeatSession`

### What This Work Does

- Allows a student to take a library token or seat
- Prevents duplicate or conflicting seat occupation
- Releases the seat correctly when the student leaves
- Shows occupancy, available seats, and recent activity in a DB-backed way

### DBMS Contribution

- Designed and used the `library_seat_sessions` table
- Enforced one active seat session per student and one active student per seat
- Used transactional writes for seat claim and release operations
- Added DB-backed occupancy reporting and seat history logging
- Contributed to `library_seat_taken` and `library_seat_released` event storage in the logs table

## 3. Anubhav

### Primary Ownership

- SAC implementation
- Club room presence tracking
- Equipment issue and return management

### Main Features Covered

- SAC overview and status display
- Opening a room, joining a room, and leaving a room
- Tracking current occupants of each room
- Tracking which student has taken which equipment
- SAC activity feed based on real-time database state

### Main Code Areas

- `frontend/screens/SACScreen.js`
- `frontend/screens/ClubRoomScreen.js`
- `frontend/screens/EquipmentScreen.js`
- `frontend/styles/SACStyles.js`
- `frontend/services/api.js` for SAC calls
- `backend/routes/sacRoutes.js`
- `backend/utils/sacCatalog.js`
- Prisma models for `SacRoomSession`, `SacRoomPresence`, and `SacEquipmentCheckout`

### What This Work Does

- Creates a digital record of club room usage
- Keeps room occupancy accurate as students enter and leave
- Tracks equipment currently in use
- Prevents inconsistent room states and duplicate equipment possession

### DBMS Contribution

- Designed the SAC relational flow using session and presence tables
- Used foreign-key-linked tables for room sessions, occupants, and equipment checkout history
- Added DB-backed rules for active versus closed room sessions
- Logged SAC events such as room opened, joined, left, equipment taken, and equipment returned
- Used transaction-safe updates so room/session state stays consistent

## 4. Khushi

### Primary Ownership

- Outpass management workflow
- Student request lifecycle
- Warden approval and hostel monitoring flow

### Main Features Covered

- Student outpass creation form
- Regular and long-visit request handling
- Outpass history and current-status tracking
- Warden dashboard for hostel requests
- Approval, rejection, and cancellation actions
- Monitoring of students who are outside campus

### Main Code Areas

- `frontend/screens/CreateOutpassScreen.js`
- `frontend/screens/OutpassScreen.js`
- `frontend/screens/WardenDashboardScreen.js`
- `frontend/screens/WardenOutpassScreen.js`
- `frontend/screens/WardenMonitoringScreen.js`
- `frontend/styles/CreateOutpassStyles.js`
- `frontend/styles/OutpassStyles.js`
- `backend/routes/outpassRoutes.js`
- `backend/routes/wardenRoutes.js`
- `backend/middleware/outpassExpiry.js`
- `backend/utils/outpassLifecycle.js`
- Prisma models for `Outpass` and `OutpassAuditTrail`

### What This Work Does

- Lets students submit outpass requests digitally
- Sends requests into a hostel-specific approval queue
- Allows wardens to approve, reject, or cancel requests
- Tracks request state changes and return status
- Supports hostel monitoring with yellow-alert, danger, overdue, and ongoing categories

### DBMS Contribution

- Structured the outpass lifecycle using normalized status fields and audit trails
- Used the `outpasses` table for request storage and the `outpass_audit_trail` table for every workflow state change
- Added query logic for active, pending, expired, and hostel-filtered records
- Used database-backed monitoring derived from movement logs plus outpass data
- Ensured time-window validation, expiry handling, and return tracking are reflected in persisted data

## 5. Abdul

### Primary Ownership

- Core backend foundation
- Database schema, Prisma integration, and backend connectivity
- Authentication, role model, emergency module, and administrative support APIs

### Main Features Covered

- Express server setup and route composition
- PostgreSQL and Prisma configuration
- User registration, login, JWT auth, and profile management
- Role-specific profile tables for student, warden, and security users
- Password update and OTP-based verification support
- Emergency alert handling and emergency contact APIs
- Admin-level statistics and management support
- Docker and environment-level backend setup

### Main Code Areas

- `backend/server.js`
- `backend/config/database.js`
- `backend/config/prisma.js`
- `backend/config/jwt.js`
- `backend/routes/authRoutes.js`
- `backend/routes/studentRoutes.js`
- `backend/routes/emergencyRoutes.js`
- `backend/routes/adminRoutes.js`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/`
- `backend/scripts/`
- `docker-compose.yml`
- `backend/Dockerfile`

### What This Work Does

- Provides the backend base on which every other module runs
- Connects the application to PostgreSQL through Prisma
- Defines role-based authentication and authorization
- Manages persistent user identity, profile, and emergency records
- Supports project deployment, migrations, and initial database population

### DBMS Contribution

- Owned the primary relational schema design
- Created or maintained core entities such as `users`, role profile tables, `emergencies`, `logs`, and supporting enums
- Managed Prisma migrations, schema synchronization, and database startup flow
- Built ingestion and backfill scripts for structured database population
- Ensured the backend modules share a consistent DB layer, constraints, and table relationships

## Coverage Summary

The project is fully covered by this distribution:

- profiles, OTP, admin, schema, migrations, and backend setup: Abdul
- Student UI, shared frontend flow, security scan workflow, and log presentation: Kavyan
- Library module and seat database workflow, emergency: Adith
- SAC rooms and equipment workflow, Authentication: Anubhav
- Outpass, warden approval, and hostel monitoring workflow: Khushi