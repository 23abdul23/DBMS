import * as Notifications from 'expo-notifications';
import { DEFAULT_ANDROID_CHANNEL } from './notificationService';

export async function sendLocalTestNotification({
  title = 'Aegis Test Notification',
  body = 'Local notification is working.',
  data = {},
} = {}) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: {
      seconds: 1,
      channelId: DEFAULT_ANDROID_CHANNEL,
    },
  });
}
