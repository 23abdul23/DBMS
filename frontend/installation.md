# Frontend Installation And Setup

This guide covers the frontend-only setup for Aegis: Expo, React Native, navigation, and native push-notification testing.

## 1. Prerequisites

Install these tools before starting:

- Node.js 18 or newer
- npm
- Git
- Expo CLI or the Expo tooling bundled with your environment
- Android Studio or Xcode if you want a native simulator/emulator
- Expo Development Build or EAS build if you want to test native FCM/APNs push notifications

## 2. Install Dependencies

From the repository root:

```bash
cd frontend
npm install
```

## 3. Configure The Frontend Environment

The frontend reads API values from `backend/.env` through `frontend/app.config.js`.

Make sure the backend config includes values like:

```env
ENVIRONEMENT=development
API_BASE_URL=http://localhost:5000/api
API_BASE_URL_PRIMARY=http://localhost:5000/api
API_BASE_URL_SECONDARY=
API_HOST=localhost
API_PORT=5000
```

Notes:

- `ENVIRONEMENT=development` enables the quick-login flow on the login screen.
- For a physical phone, replace `localhost` with a LAN IP or server hostname.
- If you change the backend environment, restart Expo so the config is reloaded.

## 4. Start The Frontend

From the `frontend` directory:

```bash
cd frontend
npm start
```

Useful variants:

```bash
npm run web
npm run android
npm run ios
npx expo start --tunnel
```

## 5. Push Notification Testing

Expo Go is not sufficient for validating this project's native push pipeline.

Use a development build or a native run target instead of Expo Go when testing remote push notifications.

Recommended commands:

```bash
cd frontend
npx expo run:android
# or
npx expo run:ios
```

If you are building a dev client for device testing, use your usual EAS development build flow.

## 6. Frontend Dependency Notes

The app uses:

- React Navigation for screen routing
- Expo Notifications for native token access, permissions, and foreground/tap handling
- Axios for API calls
- React Native components and Expo modules for the UI

## 7. Troubleshooting

### Frontend cannot reach backend

- Check that the backend is running on port 5000.
- Confirm `API_BASE_URL` or `API_HOST` and `API_PORT` are correct in the backend environment.
- Restart the frontend after changing the backend environment.
- If using a physical device, use a reachable LAN IP or server domain instead of `localhost`.

### Push notifications do not work in Expo Go

- Use a development build.
- Verify the backend saved a native FCM/APNs token.
- Verify the notification worker is running and Redis is reachable.

### Useful Paths

- Frontend app config: `frontend/app.config.js`
- Frontend screens: `frontend/screens/`
- Frontend components: `frontend/components/`
- Frontend navigation: `frontend/navigation/`
