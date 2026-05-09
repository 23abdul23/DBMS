# Security Admin Module - Quick Setup Commands

## ⚡ Fast Track Deployment (Copy & Paste)

### Step 1: Backend Database Setup
```bash
# Navigate to backend directory
cd backend

# Apply database migration
npx prisma migrate dev --name add_location_models_and_tracking

# Seed initial 20 locations
node scripts/seed_locations.js

# Verify database setup (optional - opens visual explorer)
npx prisma studio
```

### Step 2: Backend Server
```bash
# Still in backend directory
npm start

# Expected output:
# Server running on port 5000
# Aegis ID Backend is running
# [Routes registered including /api/security-admin/*]
```

### Step 3: Frontend Setup
```bash
# Open new terminal
cd frontend

# Install dependencies (if needed)
npm install

# Start development server
expo start

# Press:
# 'i' for iOS simulator
# 'a' for Android emulator
# 'w' for web preview
```

### Step 4: Test the System
1. Open mobile app or web preview
2. Login with credentials where role = "admin"
3. You should be redirected to SecurityAdminTabNavigator
4. Tap "Security Admin" tab (shield icon)
5. Verify 20 locations load
6. Select any location and tap "Generate QR"
7. Verify QR modal appears
8. Tap "Download QR"
9. Verify file is saved to device

---

## 🔧 Manual Database Setup (If Migration Fails)

### Option A: Reset Entire Database
```bash
cd backend

# CAUTION: Deletes all data
npx prisma migrate reset

# Follow prompts to recreate schema and seed
# This automatically runs seed scripts
```

### Option B: Check Migration Status
```bash
cd backend

# Show migration history
npx prisma migrate status

# Show pending migrations
npx prisma migrate deploy

# Rollback last migration (if needed)
npx prisma migrate resolve --rolled-back add_location_models_and_tracking
```

### Option C: Manual SQL Execution
```bash
cd backend

# Execute raw SQL (if Prisma has issues)
npx prisma db execute < path/to/migration.sql

# Or via PostgreSQL directly:
psql -U postgres -d aegis_db -c "
CREATE TYPE \"LocationType\" AS ENUM (
  'CAMPUS_BUILDING', 'HOSTEL', 'EXIT_GATE', 
  'FIXED_LOCATION', 'SECURITY_POINT', 'OTHER'
);
-- ... rest of schema
"
```

---

## 📱 Frontend Development

### Test Admin Login Flow
```javascript
// In LoginScreen or during testing:
// Username: admin@aegis.com
// Password: admin123
// Expected: Redirect to SecurityAdminTabNavigator

// Or directly set auth context:
const { setUser, setToken } = useAuth();
setUser({ 
  id: 'admin-1',
  name: 'Security Admin',
  role: 'admin',  // MUST BE EXACT
  email: 'admin@aegis.com'
});
setToken('valid-jwt-token');
```

### Access Screen Directly (Dev Only)
```javascript
// In App.js, temporarily force screen for testing:
import SecurityAdminScreen from './screens/SecurityAdminScreen';

// In RootNavigator, replace role check with:
<Stack.Navigator>
  <Stack.Screen name="SecurityAdmin" component={SecurityAdminScreen} />
</Stack.Navigator>
```

### Clear Cache & Reinstall
```bash
cd frontend

# Clear Expo cache
expo start --reset-cache

# Or manual cleanup:
rm -rf node_modules package-lock.json
npm install
expo start
```

---

## 🧪 API Testing Commands

### Test with cURL
```bash
# Variables (replace with your values):
# TOKEN="your-jwt-token"
# BASE_URL="http://localhost:5000"
# LOCATION_ID="actual-location-id"

# 1. Get all locations
curl -X GET \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/security-admin/locations

# 2. Get single location
curl -X GET \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/security-admin/locations/LOCATION_ID

# 3. Create location
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Location",
    "code": "NEW-LOC",
    "type": "CAMPUS_BUILDING",
    "description": "Test location",
    "latitude": 28.5355,
    "longitude": 77.1905
  }' \
  http://localhost:5000/api/security-admin/locations

# 4. Update location
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "description": "Updated description"
  }' \
  http://localhost:5000/api/security-admin/locations/LOCATION_ID

# 5. Delete (archive) location
curl -X DELETE \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/security-admin/locations/LOCATION_ID

# 6. Generate QR code
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"format": "PNG"}' \
  http://localhost:5000/api/security-admin/qr/location/LOCATION_ID/generate

# 7. Get latest QR
curl -X GET \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/security-admin/qr/location/LOCATION_ID

# 8. Record QR download
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "aegis-qr-main-gate.png",
    "fileSize": 2048
  }' \
  http://localhost:5000/api/security-admin/qr/location/LOCATION_ID/download

# 9. Get download history
curl -X GET \
  -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/security-admin/qr/download-history?limit=20&offset=0"

# 10. Get generation history
curl -X GET \
  -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/security-admin/qr/generation-history?limit=20&offset=0"

# 11. Get statistics
curl -X GET \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/security-admin/statistics/qr

# 12. Test health endpoint
curl -X GET \
  http://localhost:5000/api/health
```

### Test with Postman
```json
{
  "info": {
    "name": "Security Admin API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get All Locations",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{TOKEN}}"
          }
        ],
        "url": {
          "raw": "{{BASE_URL}}/api/security-admin/locations",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "security-admin", "locations"]
        }
      }
    },
    {
      "name": "Create Location",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{TOKEN}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"Test Building\",\n  \"code\": \"TEST-BLDG\",\n  \"type\": \"CAMPUS_BUILDING\",\n  \"latitude\": 28.5355,\n  \"longitude\": 77.1905\n}"
        },
        "url": {
          "raw": "{{BASE_URL}}/api/security-admin/locations",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "security-admin", "locations"]
        }
      }
    }
  ]
}
```

---

## 🐛 Debugging Commands

### Check Backend Logs
```bash
# Backend should show route registration
npm start 2>&1 | grep security-admin

# Should output:
# Route: /api/security-admin/locations
# Route: /api/security-admin/qr/location/:id/generate
# etc.
```

### Check Database Connection
```bash
cd backend

# Test Prisma connection
npx prisma db execute --stdin < /dev/null && echo "Database connected!"

# Or
npx prisma db push --skip-generate
```

### Verify Locations Were Seeded
```bash
cd backend

# Using Prisma CLI
npx prisma db execute << EOF
SELECT COUNT(*) as location_count FROM "Location";
EOF

# Or use Prisma Studio
npx prisma studio
# Navigate to Location table - should show 20 records
```

### Check API Endpoint Status
```bash
# In terminal
curl -i http://localhost:5000/api/health

# Expected:
# HTTP/1.1 200 OK
# {"status":"OK","message":"Aegis ID Backend is running",...}
```

### View Frontend Logs
```bash
# In Expo console
expo start --verbose

# Or check React Native debugger
# Cmd+M (Android) or Cmd+D (iOS) to open developer menu
```

---

## 🚀 Common Scenarios

### Scenario 1: Fresh Start from Scratch
```bash
# Terminal 1: Backend
cd backend
npx prisma migrate dev --name add_location_models_and_tracking
node scripts/seed_locations.js
npm start

# Terminal 2: Frontend
cd frontend
npm install
expo start
# Press 'a' for Android or 'i' for iOS
```

### Scenario 2: Update Existing Codebase
```bash
# No database changes needed, just code updates
cd frontend
git pull
npm install
expo start --reset-cache
```

### Scenario 3: Add a New Location Manually
```bash
# Method 1: Via Postman/curl (see API Testing section above)

# Method 2: Via Prisma Studio
cd backend
npx prisma studio
# Go to Location table
# Click "Add record"
# Fill in fields
# Click "Save"

# Method 3: Via JavaScript
# In a script or Node REPL:
const { getPrismaClient } = require('./config/prisma.js');
const prisma = getPrismaClient();
const loc = await prisma.location.create({
  data: {
    id: 'some-id',
    name: 'New Place',
    code: 'NEW-CODE',
    type: 'CAMPUS_BUILDING',
    hash: 'hash-value',
    latitude: 28.5355,
    longitude: 77.1905
  }
});
console.log(loc);
```

### Scenario 4: Test QR Generation End-to-End
```bash
# Get a location ID
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/security-admin/locations | jq '.data.locations[0].id'

# Generate QR (replace LOCATION_ID)
curl -X POST -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/security-admin/qr/location/LOCATION_ID/generate | jq '.data.qr.payload'

# Download QR (frontend already handles this)
# Just tap "Download QR" in the app
```

### Scenario 5: Troubleshoot Failed Download
```javascript
// In SecurityAdminScreen.js, add debugging:
const handleDownload = async () => {
  try {
    console.log('1. Starting download...');
    const capturedUri = await captureRef(qrRef.current, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
    console.log('2. QR captured:', capturedUri);

    const fileDate = formatDateStamp();
    const fileName = `aegis-location-qr-${location.name}-${fileDate}.png`;
    console.log('3. Filename:', fileName);

    const capturedBase64 = await FileSystem.readAsStringAsync(capturedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('4. File read as base64, length:', capturedBase64.length);

    if (Platform.OS === 'android') {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      console.log('5. Permissions granted:', permissions.granted);
      
      if (!permissions.granted) {
        throw new Error('Permissions denied');
      }

      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileName,
        'image/png'
      );
      console.log('6. File created:', fileUri);

      await FileSystem.writeAsStringAsync(fileUri, capturedBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('7. File written successfully');
    }

    console.log('8. Recording download via API...');
    await securityAdminAPI.recordDownload(location.id, fileName);
    console.log('9. Download recorded!');
    
    showToast(`QR saved as ${fileName}`);
  } catch (error) {
    console.error('Download error:', error);
    console.error('Stack:', error.stack);
  }
};
```

---

## 📋 Environment Configuration

### Backend .env (if needed)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/aegis_db
JWT_SECRET=your-secret-key-here
PORT=5000
NODE_ENV=development
API_BASE_URL=http://localhost:5000
```

### Frontend expo.config.js (already set)
```javascript
module.exports = {
  extra: {
    API_BASE_URL: 'http://your-api-domain.com/api',
    API_BASE_URL_SECONDARY: 'http://fallback-domain.com/api',
  }
}
```

---

## ✅ Deployment Checklist

- [ ] Database migration successful
- [ ] All 20 locations seeded
- [ ] Backend running on port 5000
- [ ] Frontend connected to correct API
- [ ] Admin user can login
- [ ] SecurityAdminScreen displays
- [ ] All 20 locations visible in list
- [ ] Search functionality works
- [ ] QR generation completes
- [ ] QR download saves file
- [ ] Statistics update after operations
- [ ] Dark mode toggle works
- [ ] Pull-to-refresh works
- [ ] History tabs populated
- [ ] No console errors
- [ ] No network errors

---

## 🆘 Emergency Fixes

### Everything broken? Nuclear reset:
```bash
# Backend
cd backend
rm -rf node_modules prisma/migrations
npm install
npx prisma migrate reset  # This resets AND seeds

# Frontend
cd frontend
rm -rf node_modules .expo
npm install
expo start --reset-cache
```

### Just database broken?
```bash
cd backend
npx prisma db push --skip-generate --skip-validate
npx prisma migrate deploy
node scripts/seed_locations.js
```

### Just frontend broken?
```bash
cd frontend
expo start --reset-cache
# If still broken:
rm -rf node_modules
npm install
expo start
```

### Server won't start?
```bash
# Check port is free
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill process on port 5000
kill -9 $(lsof -t -i :5000)  # macOS/Linux
taskkill /PID 1234 /F  # Windows (replace 1234)

# Try starting again
npm start
```

---

## 📞 Quick Support

**Error**: "Cannot find module 'securityAdminRoutes'"
**Fix**: Ensure file is at `backend/routes/securityAdminRoutes.js` (exact path)

**Error**: "Authentication required"
**Fix**: Add `Authorization: Bearer YOUR_TOKEN` header to requests

**Error**: "Forbidden access"
**Fix**: Ensure user role is exactly "admin" (case-sensitive)

**Error**: "Location not found"
**Fix**: Copy actual location ID from database

**Error**: "QR download failed"
**Fix**: Check file permissions, grant storage access on Android

**Error**: "SecurityAdminScreen not showing"
**Fix**: Verify admin role, check App.js imports, restart app

---

**Updated**: 2024  
**Status**: Ready to Deploy
