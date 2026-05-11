import { createContext, useEffect } from 'react';

import * as Notifications from 'expo-notifications';

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        console.log(data);
      }
    );

    return () => subscription.remove();
  }, []);

  return children;
}
