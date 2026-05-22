import { createContext, useEffect } from 'react';
import { Platform } from 'react-native';

import * as Notifications from 'expo-notifications';

import { useAuth } from '../context/AuthContext';
import { notificationAPI } from '../services/api';
import { handleNotificationResponse } from './notificationNavigation';
import { getNativePushRegistration } from './notificationService';

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const notificationId = notification?.request?.identifier;
        const data = notification?.request?.content?.data || {};
        console.log('[Notifications] Foreground notification received:', {
          notificationId,
          data,
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

  useEffect(() => {
    if (!user || Platform.OS === 'web') {
      return undefined;
    }

    let isCancelled = false;

    const syncNativeToken = async (overrideTokenResponse = null) => {
      try {
        const registration = await getNativePushRegistration(
          overrideTokenResponse
        );

        if (!registration || isCancelled) {
          return;
        }

        await notificationAPI.saveToken(registration);
        console.log(
          `[Notifications] Synced native ${registration.tokenType} token for device ${registration.deviceId}`
        );
      } catch (error) {
        console.log(
          '[Notifications] Native token sync failed:',
          error?.message || error
        );
      }
    };

    syncNativeToken();

    const tokenSubscription = Notifications.addPushTokenListener
      ? Notifications.addPushTokenListener((token) => {
          console.log('[Notifications] Native push token refresh received');
          syncNativeToken(token);
        })
      : null;

    return () => {
      isCancelled = true;
      tokenSubscription?.remove?.();
    };
  }, [user?.id]);

  return children;
}
