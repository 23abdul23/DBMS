import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const DEFAULT_ANDROID_CHANNEL = 'default';
const PUSH_DEVICE_ID_KEY = 'nativePushDeviceId';
const notificationsLogger = createLogger('notifications', 'Notifications');

function buildLocalDeviceId() {
  return `aegis-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function getOrCreatePushDeviceId() {
  const existing = await AsyncStorage.getItem(PUSH_DEVICE_ID_KEY);

  if (existing) {
    notificationsLogger.debug('reusing-push-device-id', { deviceId: existing });
    return existing;
  }

  const deviceId = buildLocalDeviceId();
  await AsyncStorage.setItem(PUSH_DEVICE_ID_KEY, deviceId);
  notificationsLogger.info('created-push-device-id', { deviceId });
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

  notificationsLogger.debug('android-channel-configured', {
    channelId: DEFAULT_ANDROID_CHANNEL,
  });
}

export async function ensureNotificationPermission() {
  if (Platform.OS === 'web') {
    notificationsLogger.warn('permission-check-skipped-web');
    return {
      granted: false,
      status: 'web_unsupported',
    };
  }

  if (!Device.isDevice) {
    notificationsLogger.warn('permission-check-skipped-simulator');
    return {
      granted: false,
      status: 'emulator_or_simulator_unsupported',
    };
  }

  await configureNotificationChannels();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  notificationsLogger.debug('permission-status-read', {
    existingStatus,
  });

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    finalStatus = status;
    notificationsLogger.info('permission-request-result', { status });
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
  notificationsLogger.info('native-push-registration-start', {
    platform: Platform.OS,
    appOwnership: Constants.appOwnership || 'unknown',
    isDevice: Device.isDevice,
  });

  const permission = await ensureNotificationPermission();

  if (!permission.granted) {
    notificationsLogger.warn('native-push-registration-skipped', permission);
    return null;
  }

  if (Constants.appOwnership === 'expo') {
    notificationsLogger.warn('running-inside-expo-go');
  }

  notificationsLogger.debug('requesting-native-device-push-token');
  const tokenResponse =
    tokenResponseOverride || (await Notifications.getDevicePushTokenAsync());
  const token = normalizeTokenData(tokenResponse);

  if (!token) {
    notificationsLogger.error('native-push-token-missing', {
      tokenResponseType: typeof tokenResponse,
      tokenResponse,
    });
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

  notificationsLogger.info('native-token-ready', {
    platform: registration.platform,
    tokenType: registration.tokenType,
    deviceId: registration.deviceId,
    deviceName: registration.deviceName,
    appVersion: registration.appVersion,
    buildNumber: registration.buildNumber,
    token,
  });

  return registration;
}

export async function deactivateCurrentDevicePushRegistration() {
  const deviceId = await getOrCreatePushDeviceId();

  notificationsLogger.debug('deactivate-current-device-push-registration', {
    deviceId,
    platform: Platform.OS,
  });

  return {
    deviceId,
    platform: Platform.OS,
  };
}

export { DEFAULT_ANDROID_CHANNEL };
