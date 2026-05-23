import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const DEFAULT_ANDROID_CHANNEL = 'default';
const PUSH_DEVICE_ID_KEY = 'nativePushDeviceId';

function buildLocalDeviceId() {
  return `aegis-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function getOrCreatePushDeviceId() {
  const existing = await AsyncStorage.getItem(PUSH_DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const deviceId = buildLocalDeviceId();
  await AsyncStorage.setItem(PUSH_DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export async function configureNotificationChannels() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(DEFAULT_ANDROID_CHANNEL, {
    name: 'General',
    description: 'General notifications for Aegis',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0A84FF',
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
  });
}

export async function ensureNotificationPermission() {
  if (Platform.OS === 'web') {
    return {
      granted: false,
      status: 'web_unsupported',
    };
  }

  if (!Device.isDevice) {
    return {
      granted: false,
      status: 'emulator_or_simulator_unsupported',
    };
  }

  await configureNotificationChannels();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    finalStatus = status;
  }

  return {
    granted: finalStatus === 'granted',
    status: finalStatus,
  };
}

function normalizeTokenData(tokenResponse) {
  if (typeof tokenResponse === 'string') {
    return tokenResponse;
  }

  return tokenResponse?.data || null;
}

function getTokenTypeForPlatform() {
  return Platform.OS === 'ios' ? 'APNS' : 'FCM';
}

function getDeviceName() {
  if (Device.deviceName) {
    return Device.deviceName;
  }

  const parts = [Device.brand, Device.modelName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : `${Platform.OS} device`;
}

export async function getNativePushRegistration(tokenResponseOverride = null) {
  const permission = await ensureNotificationPermission();

  if (!permission.granted) {
    console.log(
      `[Notifications] Native push registration skipped: ${permission.status}`
    );
    return null;
  }

  if (Constants.appOwnership === 'expo') {
    console.log(
      '[Notifications] Running inside Expo Go. Native push delivery must be validated with a development build or production build.'
    );
  }

  const tokenResponse =
    tokenResponseOverride || (await Notifications.getDevicePushTokenAsync());
  const token = normalizeTokenData(tokenResponse);

  if (!token) {
    throw new Error('Native push token was not returned by the device');
  }

  const deviceId = await getOrCreatePushDeviceId();
  const registration = {
    token,
    tokenType: getTokenTypeForPlatform(),
    platform: Platform.OS,
    deviceId,
    deviceName: getDeviceName(),
    appVersion:
      Application.nativeApplicationVersion || Application.applicationId,
    buildNumber: Application.nativeBuildVersion || null,
  };

  console.log(
    `[Notifications] Native token ready platform=${registration.platform} type=${registration.tokenType} deviceId=${registration.deviceId}`
  );

  return registration;
}

export async function deactivateCurrentDevicePushRegistration() {
  const deviceId = await getOrCreatePushDeviceId();

  return {
    deviceId,
    platform: Platform.OS,
  };
}

export { DEFAULT_ANDROID_CHANNEL };
