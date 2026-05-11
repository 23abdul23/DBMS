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
  if (!Device.isDevice) {
    console.log('[Notifications] Push token registration skipped on simulator');
    return null;
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

  if (finalStatus !== 'granted') {
    return;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    Constants?.manifest2?.extra?.eas?.projectId;

  if (!projectId) {
    throw new Error('Expo projectId is missing for push token generation');
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  return token;
}

export { DEFAULT_ANDROID_CHANNEL };
