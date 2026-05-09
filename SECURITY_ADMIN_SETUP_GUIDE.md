# Security Admin Module - Complete Implementation Guide

## Overview
This document provides comprehensive setup and deployment instructions for the new Security Admin Module with advanced QR code management capabilities for the Aegis ID system.

## What's New

### Backend Changes
- **New Database Models**: Location, QRGenerationHistory, QRDownloadHistory
- **New API Routes**: `/api/security-admin/*` endpoints for location and QR management
- **Database Schema**: Enhanced with LocationType enum and location tracking fields

### Frontend Changes
- **New Screen**: SecurityAdminScreen with 3 main tabs (Locations, QR Download, History)
- **New Navigator**: SecurityAdminTabNavigator for role-based navigation
- **New API Services**: securityAdminAPI client with location and QR methods

## Prerequisites

- Node.js 18+ (Backend)
- npm/yarn (Package manager)
- PostgreSQL 14+ (Database)
- Android Studio / Xcode (For mobile testing)
- Expo CLI (For React Native development)

## Installation Steps

### Step 1: Install Backend Dependencies (if needed)
```bash
cd backend
npm install
```

All required packages are already present in package.json.

### Step 2: Update Prisma Schema
The schema has already been updated with:
- LocationType enum
- Location model with coordinates and tracking
- QRGenerationHistory model
- QRDownloadHistory model

### Step 3: Create Database Migration

```bash
cd backend

# Create and apply the migration
npx prisma migrate dev --name add_location_models_and_tracking

# Follow the prompts to create the migration
```

**Expected Output:**
```
✔ Enter a name for this migration … add_location_models_and_tracking
✔ Created migration folder for new migration in ./prisma/migrations/[timestamp]_add_location_models_and_tracking

✔ Generated Prisma Client (v5.x.x)

✔ Ran 1 migration:

migrations/
  └─ [timestamp]_add_location_models_and_tracking/
    └─ migration.sql

Your database has been successfully migrated!
```

### Step 4: Seed Initial Location Data

```bash
cd backend

# Seed 20 default campus locations
node scripts/seed_locations.js
```

**Expected Output:**
```
🌱 Starting location seeding...
✓ Created: Main Gate (EXIT_GATE)
✓ Created: West Gate (EXIT_GATE)
... (20 total locations)

✅ Successfully seeded 20 locations

Summary:
  EXIT_GATE: 4
  CAMPUS_BUILDING: 8
  HOSTEL: 8
```

### Step 5: Verify Backend Routes

```bash
cd backend

# Start the server
npm start

# Check logs for route registration
# Look for: "GET /api/security-admin/locations"
# And other security-admin routes
```

### Step 6: Update Frontend Dependencies (if needed)

```bash
cd frontend
npm install

# Verify react-native-qrcode-svg is installed
npm list react-native-qrcode-svg
```

### Step 7: Test the Implementation

#### Backend API Test
```bash
# Get all locations
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/security-admin/locations

# Generate QR for a location
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/security-admin/qr/location/{locationId}/generate \
  -H "Content-Type: application/json" \
  -d '{"format":"PNG"}'

# Get statistics
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/security-admin/statistics/qr
```

#### Frontend Navigation Test
1. Login with an admin account (role = "admin")
2. You should be redirected to SecurityAdminTabNavigator
3. Navigate to the "Security Admin" tab
4. Verify location list loads and displays all 20 locations
5. Try generating a QR code for any location
6. Verify QR download works

## File Structure

### Backend Files Created/Modified

**New Files:**
- `backend/routes/securityAdminRoutes.js` - All security admin endpoints
- `backend/scripts/seed_locations.js` - Database seeding script

**Modified Files:**
- `backend/prisma/schema.prisma` - Added Location models and enums
- `backend/server.js` - Added security admin route registration

**Existing Dependencies Used:**
- Express.js (routing)
- Prisma (database ORM)
- JWT middleware (authentication)

### Frontend Files Created/Modified

**New Files:**
- `frontend/screens/SecurityAdminScreen.js` - Main security admin interface
- `frontend/navigation/SecurityAdminTabNavigator.js` - Tab navigation

**Modified Files:**
- `frontend/services/api.js` - Added securityAdminAPI object
- `frontend/App.js` - Added SecurityAdminTabNavigator to role-based navigation

**Existing Components Used:**
- React Native components (FlatList, Modal, etc.)
- Ionicons (from @expo/vector-icons)
- react-native-qrcode-svg (QR generation)
- expo-file-system (file operations)

## API Endpoints Reference

### Location Management

```
GET    /api/security-admin/locations
       - Fetch all locations with pagination
       - Query params: type, isActive

GET    /api/security-admin/locations/:id
       - Fetch single location with history

POST   /api/security-admin/locations
       - Create new location
       - Body: { name, code, type, description, latitude, longitude }

PUT    /api/security-admin/locations/:id
       - Update location
       - Body: { name, code, type, description, latitude, longitude, isActive }

DELETE /api/security-admin/locations/:id
       - Archive location (soft delete)
```

### QR Code Management

```
POST   /api/security-admin/qr/location/:id/generate
       - Generate QR for location
       - Body: { format: "PNG" }
       - Returns: QR payload with metadata

GET    /api/security-admin/qr/location/:id
       - Get latest QR for location

POST   /api/security-admin/qr/location/:id/download
       - Track QR download
       - Body: { fileName, fileSize }

GET    /api/security-admin/qr/download-history
       - Get QR download history
       - Query params: locationId, limit, offset

GET    /api/security-admin/qr/generation-history
       - Get QR generation history
       - Query params: locationId, limit, offset

GET    /api/security-admin/statistics/qr
       - Get QR usage statistics
       - Returns: summary and top downloaded locations
```

## Key Features

### 1. Location Management
- **Create/Read/Update/Delete locations** with full CRUD support
- **Location Types**: EXIT_GATE, CAMPUS_BUILDING, HOSTEL, SECURITY_POINT, FIXED_LOCATION, OTHER
- **Soft Delete**: Locations archived instead of permanently deleted
- **Location Coordinates**: Optional latitude/longitude for map integration

### 2. QR Code Generation
- **Dynamic QR Generation**: Each location generates unique QR with metadata
- **Payload Includes**:
  - Location ID and name
  - Location type
  - Coordinates (if available)
  - Timestamp
  - Hash for verification

### 3. Download Tracking
- **Download History**: Tracks who downloaded QR codes and when
- **Generation History**: Tracks who generated QR codes
- **Statistics**: Total QR generated/downloaded per location
- **Audit Trail**: Complete history for compliance

### 4. User Interface
- **Location List View**: Search and filter locations
- **Statistics Dashboard**: Real-time QR usage metrics
- **QR Preview Modal**: Full-screen QR preview with metadata
- **Dark Mode Support**: Full theme support via ThemeContext

### 5. File Management
- **Cross-Platform**: Works on Android and iOS
- **Automatic Naming**: QR files named with location name and timestamp
- **Download Confirmation**: Visual feedback on successful downloads

## Database Schema

### Location Table
```prisma
model Location {
  id                   String    @id @default(cuid())
  name                 String    @unique
  type                 LocationType
  code                 String    @unique
  description          String?
  hash                 String    @unique
  
  // Coordinates for map integration
  latitude             Decimal?  @db.Decimal(9, 6)
  longitude            Decimal?  @db.Decimal(9, 6)
  
  // Status and tracking
  isActive             Boolean   @default(true)
  qrGenerationCount    Int       @default(0)
  qrDownloadCount      Int       @default(0)
  lastQrGeneratedAt    DateTime?
  
  // Relations
  qrGenerationHistory  QRGenerationHistory[]
  qrDownloadHistory    QRDownloadHistory[]
  
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  
  @@index([type])
  @@index([isActive])
}

enum LocationType {
  CAMPUS_BUILDING
  HOSTEL
  EXIT_GATE
  FIXED_LOCATION
  SECURITY_POINT
  OTHER
}

model QRGenerationHistory {
  id              String    @id @default(cuid())
  locationId      String
  location        Location  @relation(fields: [locationId], references: [id], onDelete: Cascade)
  
  generatedById   String
  generatedBy     User      @relation("QRGenerationHistory", fields: [generatedById], references: [id], onDelete: Cascade)
  
  qrPayload       String    // JSON string
  qrFormat        String    @default("PNG")
  generatedAt     DateTime  @default(now())
  
  @@index([locationId, generatedAt(sort: Desc)])
}

model QRDownloadHistory {
  id              String    @id @default(cuid())
  locationId      String
  location        Location  @relation(fields: [locationId], references: [id], onDelete: Cascade)
  
  downloadedById  String
  downloadedBy    User      @relation("QRDownloadHistory", fields: [downloadedById], references: [id], onDelete: Cascade)
  
  fileName        String
  fileSize        Int       @default(0)
  downloadedAt    DateTime  @default(now())
  
  @@index([locationId, downloadedAt(sort: Desc)])
}
```

## Configuration

### Environment Variables
No new environment variables required. Uses existing:
- `DATABASE_URL` (PostgreSQL connection)
- `JWT_SECRET` (Token signing)
- `PORT` (Server port)

### API Configuration
Endpoints are configured in:
- Backend: `server.js` (route mounting)
- Frontend: `services/api.js` (API client initialization)

## Troubleshooting

### Migration Issues
```bash
# If migration fails, check:
npx prisma migrate status

# Reset database (development only):
npx prisma migrate reset

# Or rollback last migration:
npx prisma migrate resolve --rolled-back add_location_models_and_tracking
```

### Seeding Issues
```bash
# Check if locations already exist:
npx prisma db seed

# Or run seed script directly:
node backend/scripts/seed_locations.js

# If seed fails, delete existing locations:
npx prisma db execute < backup/delete_locations.sql
```

### Frontend Navigation Issues
- Ensure user role is exactly "admin" (case-sensitive)
- Check `useAuth()` hook returns correct role
- Verify SecurityAdminTabNavigator is imported in App.js
- Clear cache: `npm start -- --reset-cache`

### QR Download Issues
- Verify file system permissions (Android 11+)
- Check `expo-file-system` package is installed
- Ensure capture ref is working: `react-native-view-shot`

### API Connection Issues
- Verify backend is running: `curl http://localhost:5000/api/health`
- Check API base URL in frontend config
- Verify JWT token is included in requests
- Check CORS configuration in server.js

## Performance Optimizations

### Database Queries
- Indexes on `type`, `isActive`, `generatedAt` for fast filtering
- Relation loading limited to last 10 records
- Pagination support (limit/offset) for history endpoints

### Frontend Rendering
- FlatList for location display (not ScrollView)
- Modal for QR preview (lazy loading)
- Pull-to-refresh for data updates
- Memoized filtered locations list

### File Operations
- Async file operations don't block UI
- Large QR files (< 500KB typically)
- Temporary file cleanup after download

## Security Considerations

### Authentication & Authorization
- All endpoints require JWT authentication
- Only admin role users can access security admin features
- User ID tracked for audit trail

### Data Privacy
- Download history includes user email for tracking
- QR payloads stored in database for audit
- Soft delete preserves historical data

### Input Validation
- Location name/code uniqueness enforced
- Coordinates validated as decimal numbers
- Description length limits enforced

## Future Enhancements

### Phase 2 Features
1. **Map Integration**: Display locations on interactive map
2. **Bulk QR Generation**: Export multiple QR codes at once
3. **QR Scanning Interface**: Scan location QR codes
4. **Location Analytics**: Advanced statistics and charts
5. **Export Functionality**: Export location data and history
6. **Multi-location Assignment**: Assign users to specific locations

### Phase 3 Features
1. **Geofencing**: Automatic location detection via GPS
2. **Temperature Alerts**: Alert on entering specific zones
3. **Visitor Tracking**: Track guest access to campus
4. **Compliance Reports**: Auto-generate audit reports
5. **Role-Based Access Control**: Fine-grained location permissions

## Support & Maintenance

### Backup and Recovery
```bash
# Backup location data
npx prisma db execute < backup/export_locations.sql

# View migration history
npx prisma migrate status

# Check schema version
npx prisma migrate resolve --preview
```

### Monitoring
- Monitor QR generation/download rates
- Track failed authentication attempts
- Check disk space for file downloads
- Review error logs in server console

### Updates & Patches
- Regular dependency updates: `npm outdated`
- Security patches: `npm audit`
- Database schema: `npx prisma migrate`

## Testing Checklist

- [ ] Backend migration runs successfully
- [ ] Location seed creates 20 locations
- [ ] SecurityAdminScreen loads without errors
- [ ] Location search/filter works
- [ ] QR generation completes
- [ ] QR download saves file
- [ ] Statistics update after operations
- [ ] Dark mode toggles correctly
- [ ] Pull-to-refresh reloads data
- [ ] Navigation works for admin users
- [ ] History tabs display correctly
- [ ] API endpoints respond with proper status codes

## Contact & Documentation

For detailed API documentation, see:
- `backend/routes/securityAdminRoutes.js` - Endpoint implementations
- `frontend/screens/SecurityAdminScreen.js` - Component documentation
- `backend/prisma/schema.prisma` - Database schema

For troubleshooting and support:
1. Check console logs for error messages
2. Verify all prerequisites are installed
3. Ensure database migrations are applied
4. Check user role is "admin"
5. Review API endpoint status codes

---

**Version**: 1.0  
**Last Updated**: 2024  
**Status**: Production Ready
