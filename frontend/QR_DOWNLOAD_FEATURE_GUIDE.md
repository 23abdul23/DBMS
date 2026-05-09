# Location QR Code Download Feature Guide

## Overview

The Location QR Code Download feature allows users to generate and download QR codes for all campus locations including gates, buildings, and hostels. This guide covers how to use the feature and integrate it into your app navigation.

## Files Created

### 1. **LocationQRDownloadScreen.js**

Main screen component that displays all location QR codes with download functionality.

**Location:** `frontend/screens/LocationQRDownloadScreen.js`

**Features:**

- Displays all locations organized by category (Exit Gates, Campus Buildings, Hostels)
- Shows location count for each category
- Individual download button for each location QR code
- Batch download stats tracker
- Real-time download progress
- Responsive grid layout
- Dark mode support

**Props:**

- `navigation` - React Navigation object

**Usage:**

```javascript
import LocationQRDownloadScreen from '../screens/LocationQRDownloadScreen';

// Add to stack navigator
<Stack.Screen
  name="LocationQRDownload"
  component={LocationQRDownloadScreen}
  options={{ headerShown: false }}
/>;
```

### 2. **qrDownloadUtils.js**

Utility functions for QR code generation, payload building, and file management.

**Location:** `frontend/utils/qrDownloadUtils.js`

**Key Functions:**

#### File Operations

```javascript
// Download a QR code image
downloadQRCodeImage(qrRef, fileName);
// Returns: { success: boolean, path?: string, error?: Error }

// Save base64 image to file
saveBase64Image(base64Data, fileName, directoryUri);
// Returns: { success: boolean, path?: string, error?: Error }

// Request download directory access
requestDownloadDirectory();
// Returns: Promise<string> (directory URI)

// Get all downloaded files
getDownloadedFiles();
// Returns: Promise<Array> (file names)

// Delete a file
deleteDownloadedFile(filePath);
// Returns: Promise<{success: boolean, error?: Error}>
```

#### Payload Building

```javascript
// Build location QR payload
buildLocationQRPayload(location, additionalData);
// Returns: JSON string

// Build guard QR payload
buildGuardQRPayload(guardName, guardId, location);
// Returns: JSON string

// Build student QR payload
buildStudentQRPayload(studentId, userId);
// Returns: JSON string
```

#### Utility Functions

```javascript
// Sanitize file names
sanitizeFilePart(value);
// Returns: string

// Format timestamp
formatDateStamp(date);
// Returns: string (YYYY-MM-DD-HHMMSS)

// Create download manifest
createDownloadManifest(downloads);
// Returns: JSON string

// Save download manifest
saveDownloadManifest(downloads, directoryUri);
// Returns: Promise<{success: boolean, path?: string, error?: Error}>

// Generate batch file name
generateBatchFileName(prefix);
// Returns: string
```

### 3. **QRDownloadHistory.js**

Component for displaying and managing downloaded QR code files.

**Location:** `frontend/components/QRDownloadHistory.js`

**Features:**

- Lists all downloaded QR code files
- Shows file type indicators
- Delete functionality with confirmation
- Expandable file items
- Empty state when no files downloaded
- Loading state
- Dark mode support

**Props:**

- `onRefresh` (optional) - Callback function when files change

**Usage:**

```javascript
import QRDownloadHistory from '../components/QRDownloadHistory';

<QRDownloadHistory onRefresh={() => console.log('Files updated')} />;
```

## Integration Steps

### Step 1: Update Navigation Stack

Add the new screen to your navigation stack:

```javascript
// In your navigation file (e.g., AppNavigator.js or RootNavigator.js)
import LocationQRDownloadScreen from '../screens/LocationQRDownloadScreen';

// Inside your Stack.Navigator
<Stack.Screen
  name="LocationQRDownload"
  component={LocationQRDownloadScreen}
  options={{
    headerShown: false,
    animationEnabled: true,
    cardStyle: { backgroundColor: 'transparent' },
  }}
/>;
```

### Step 2: Add Navigation Button

Add a button to navigate to the new screen from existing screens:

```javascript
import { useNavigation } from '@react-navigation/native';

// In your component
const navigation = useNavigation();

<TouchableOpacity
  onPress={() => navigation.navigate('LocationQRDownload')}
  style={styles.button}
>
  <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
  <Text>Download QR Codes</Text>
</TouchableOpacity>;
```

### Step 3: Use in Multiple Locations

The feature can be accessed from:

- **Admin Dashboard** - For security admins to download location QRs
- **Guard Screen** - Alternative to individual location selection
- **Settings/Tools Screen** - For QR code management
- **Bottom Tab Navigation** - As a dedicated tab for QR management

## How to Use the Feature

### Downloading Individual QR Codes

1. Open the Location QR Download screen
2. Browse locations organized by category:
   - Exit Gates
   - Campus Buildings
   - Hostels
3. Each location displays a preview of its QR code
4. Tap the **Download** button on any location
5. Grant storage permission when prompted (Android)
6. File is saved to your Downloads folder with format: `aegis-location-qr-{location}-{timestamp}.png`

### Tracking Downloads

The stats bar at the top shows:

- **Downloaded**: Number of QR codes successfully downloaded
- **Remaining**: Number of QR codes not yet downloaded
- **All**: Quick access button for batch operations

### Managing Downloaded Files

Use the QRDownloadHistory component to:

- View all downloaded QR code files
- Delete files you no longer need
- See file type and status

## File Naming Convention

Downloaded files follow this naming pattern:

```
aegis-location-qr-{sanitized-location}-{timestamp}.png
```

**Examples:**

- `aegis-location-qr-gate-1-2024-01-15-143025.png`
- `aegis-location-qr-library-2024-01-15-143025.png`
- `aegis-location-qr-bh-1-2024-01-15-143025.png`

**Manifest files:**

```
qr-downloads-manifest-{timestamp}.json
```

## QR Code Payload Format

### Location QR Payload

```json
{
  "location": "Library",
  "scanType": "location",
  "timestamp": "2024-01-15T14:30:25.000Z"
}
```

### Guard QR Payload (from GuardScreen)

```json
{
  "guardName": "John Doe",
  "guardId": "G123",
  "location": "Gate 1",
  "scanType": "guard",
  "timestamp": "2024-01-15T14:30:25.000Z"
}
```

## Features and Capabilities

### ✅ Current Features

- [x] Display all campus locations
- [x] Organize by category (gates, buildings, hostels)
- [x] Generate QR codes on demand
- [x] Download individual QR codes
- [x] Track download statistics
- [x] File management with delete option
- [x] Dark mode support
- [x] Responsive grid layout
- [x] Loading and empty states
- [x] Error handling with user feedback

### 🔄 Potential Enhancements

- [ ] Batch download all QR codes as ZIP file
- [ ] Share QR codes via messaging/email
- [ ] Print QR codes
- [ ] Custom QR code branding
- [ ] Export manifest of all locations
- [ ] QR code preview with zoom
- [ ] Search and filter locations
- [ ] Custom naming for downloads
- [ ] Scheduled batch downloads

## Troubleshooting

### Issue: "Folder access is required to save the QR file"

**Solution:** Grant storage permission to the app. On Android, go to Settings > Apps > Aegis > Permissions > Files and media.

### Issue: QR codes not downloading

**Solution:**

1. Check storage space on your device
2. Verify app has storage permissions
3. Try again with a single location first

### Issue: Files not showing in download history

**Solution:**

1. Refresh the download history component
2. Check if files were saved to a different location
3. Clear app cache and try again

## Performance Considerations

- QR code generation is fast (typically <100ms per code)
- File operations are async to prevent UI blocking
- Large batch downloads may take time depending on device speed
- Images are optimized to ~50-100KB per file

## Platform-Specific Notes

### Android

- Files saved to selected Downloads folder
- Requires storage permissions (runtime)
- SAF (Storage Access Framework) used for file access

### iOS

- Files saved to app's Documents directory
- No explicit permissions needed (Sandbox access)
- Files accessible via Files app if configured

## Security Considerations

- QR codes contain only public location information
- No sensitive data embedded in payloads
- Files stored locally on device only
- Timestamps included for audit trails

## API Integration

To integrate with backend scanning:

1. QR codes are scanned by security devices
2. Payload is parsed and location verified
3. Movement logs created with scanned location
4. See `frontend/screens/ScannerScreen.js` for scan handling

## Support and Maintenance

For issues or enhancement requests:

1. Check the troubleshooting section
2. Review log output in console
3. Ensure all dependencies are installed
4. Verify Android/iOS version compatibility

## Related Files

- `frontend/screens/GuardScreen.js` - Guard QR generation
- `frontend/screens/ScannerScreen.js` - QR code scanning
- `frontend/constants/SecuityLocations.json` - Location data
- `frontend/utils/screenshot.js` - Screenshot utilities
- `frontend/services/api.js` - API calls
