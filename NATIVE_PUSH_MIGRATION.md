# Native Push Migration

This repo now uses direct native push delivery:

- Android device registration: FCM device token
- iOS device registration: APNs device token
- Foreground/tap handling: `expo-notifications`
- Backend delivery: direct FCM via `firebase-admin`, direct APNs via Apple provider API
- No Expo push tokens
- No Expo relay service
- No Expo server SDK

## Files changed

- Frontend token lifecycle:
  - `frontend/notifications/notificationService.js`
  - `frontend/notifications/notificationProvider.js`
  - `frontend/context/AuthContext.js`
  - `frontend/services/api.js`
  - `frontend/screens/NotificationTestingScreen.js`
- Expo/EAS config:
  - `frontend/app.config.js`
  - `frontend/eas.json`
- Backend delivery pipeline:
  - `backend/notifications/services/push.service.js`
  - `backend/notifications/services/token.service.js`
  - `backend/notifications/services/notification.service.js`
  - `backend/notifications/controller/notification.controller.js`
  - `backend/notifications/controller/test.controller.js`
  - `backend/notifications/routes/notifications.js`
  - `backend/notifications/workers/notification.worker.js`
  - `backend/server.js`
- Database:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/20260523_native_push_migration/migration.sql`

## Packages

- Frontend keeps:
  - `expo-notifications`
  - `expo-device`
  - `expo-application`
- Backend now requires:
  - `firebase-admin`

Install backend dependencies:

```bash
cd backend
npm install
```

## Firebase Android setup

1. In Firebase Console, create or reuse the Android app matching `frontend/app.config.js` package name.
2. Download `google-services.json`.
3. Place it at `frontend/google-services.json`.
4. Ensure `frontend/eas.json` points `ANDROID_GOOGLE_SERVICES_FILE` to `./google-services.json`.
5. Add FCM credentials to `backend/.env` using `backend/.env.push.example`.

## APNs iOS setup

1. In Apple Developer, enable Push Notifications for the app bundle identifier.
2. Create an APNs Auth Key (`.p8`) and note:
   - Key ID
   - Team ID
3. Download `GoogleService-Info.plist` from Firebase iOS app setup and place it at `frontend/GoogleService-Info.plist`.
4. Set:
   - `APNS_KEY_ID`
   - `APNS_TEAM_ID`
   - `APNS_PRIVATE_KEY` or `APNS_PRIVATE_KEY_PATH`
   - `APNS_BUNDLE_ID`
   - `APNS_USE_PRODUCTION`
5. `frontend/app.config.js` already adds:
   - `aps-environment`
   - `UIBackgroundModes = ["remote-notification"]`

## Prisma migration

Run:

```bash
cd backend
npm run prisma:migrate
npm run prisma:generate
```

What changes:

- `PushToken` now tracks:
  - `tokenType`
  - `platform`
  - `deviceId`
  - `deviceName`
  - `appVersion`
  - `buildNumber`
  - `status`
  - `lastRegisteredAt`
  - `lastSeenAt`
  - `lastDeliveredAt`
  - `lastFailureAt`
- `Notification` now stores:
  - `routeName`
  - `routeParams`
  - `badgeCount`
- `NotificationDelivery` stores per-device delivery status and retry traces.

Existing Expo push tokens are migrated to inactive invalid records with reason `expo_push_token_deprecated`.

## Runtime flow

1. User logs in.
2. `NotificationProvider` requests permission and calls `getDevicePushTokenAsync()`.
3. Android sends FCM token to `/api/notifications/token`.
4. iOS sends APNs token to `/api/notifications/token`.
5. Backend enforces one active session and one active native push device per user.
6. Login rotates any previous session and deactivates earlier device registrations for that user.
7. Notification creation queues one delivery record for the active device.
8. Worker sends the notification directly to FCM or APNs with retries.
9. Logout calls `/api/notifications/token/deactivate` for the current `deviceId`.

## Admin diagnostics

`SUPER_ADMIN` routes:

- `POST /api/notifications/test-hello`
- `GET /api/notifications/admin/overview`
- `GET /api/notifications/admin/tokens`
- `GET /api/notifications/admin/deliveries`

The frontend diagnostics screen now shows:

- token status counts
- delivery status counts
- recent device registrations
- recent failed deliveries
- recent delivery logs

## Required manual verification

- Android 13+ permission prompt on first login
- iOS permission prompt on first login
- token refresh after reinstall/update
- logout deactivates current device record
- warden receives student outpass creation notification
- student receives warden approve/reject notification
- SUPER_ADMIN test notification shows delivery result in logs
- worker is running: `npm run worker`
