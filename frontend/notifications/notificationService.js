import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const DEFAULT_ANDROID_CHANNEL = 'default';

export function getNotificationRuntimeInfo() {
  const executionEnvironment = Constants?.executionEnvironment || 'unknown';
  const appOwnership = Constants?.appOwnership || 'unknown';
  const isExpoGo = isRunningInExpoGo();

  return {
    isExpoGo,
    executionEnvironment,
    appOwnership,
    buildType: Constants?.expoConfig?.extra?.BUILD_TYPE || 'unknown',
    projectId:
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      Constants?.manifest2?.extra?.eas?.projectId ||
      null,
  };
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

export async function registerForPushNotifications() {
  const runtimeInfo = getNotificationRuntimeInfo();

  console.log('[Notifications] Push registration requested', {
    platform: Platform.OS,
    isDevice: Device.isDevice,
    ...runtimeInfo,
  });

  if (!Device.isDevice) {
    console.log(
      '[Notifications] Running on emulator/simulator; push token registration will still be attempted',
      {
        platform: Platform.OS,
        ...runtimeInfo,
      }
    );
  }

  if (runtimeInfo.isExpoGo) {
    console.log(
      '[Notifications] Running in Expo Go; push token registration will still be attempted',
      {
        platform: Platform.OS,
        ...runtimeInfo,
      }
    );
  }

  await configureNotificationChannels();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  console.log('[Notifications] Existing notification permission status', {
    platform: Platform.OS,
    status: existingStatus,
  });

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

    console.log('[Notifications] Permission request result', {
      platform: Platform.OS,
      status: finalStatus,
    });
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Push permissions not granted', {
      platform: Platform.OS,
      status: finalStatus,
    });
    return;
  }

  const projectId = runtimeInfo.projectId;

  if (!projectId) {
    throw new Error('Expo projectId is missing for push token generation');
  }

  console.log('[Notifications] Using Expo projectId for token generation', {
    platform: Platform.OS,
    hasProjectId: Boolean(projectId),
    executionEnvironment: runtimeInfo.executionEnvironment,
  });

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  console.log('[Notifications] Expo push token generated', {
    platform: Platform.OS,
    tokenPreview: token?.slice(0, 24),
  });

  return token;
}

export { DEFAULT_ANDROID_CHANNEL };
