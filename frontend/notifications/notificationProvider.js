import { createContext, useEffect } from 'react';

import * as Notifications from 'expo-notifications';
import { handleNotificationResponse } from './notificationNavigation';

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const notificationId = notification?.request?.identifier;
        console.log('[Notifications] Foreground notification received:', {
          notificationId,
        });
      }
    );

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response?.notification?.request?.content?.data || {};
        console.log('[Notifications] Notification tap received:', data);
        handleNotificationResponse(response);
      });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleNotificationResponse(response);
        }
      })
      .catch((error) => {
        console.log('[Notifications] Failed to read last response:', error);
      });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return children;
}
