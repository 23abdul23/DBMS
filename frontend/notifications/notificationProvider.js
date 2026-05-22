import { createContext, useEffect } from 'react';
import { Platform } from 'react-native';

import * as Notifications from 'expo-notifications';

import { useAuth } from '../context/AuthContext';
import { notificationAPI } from '../services/api';
import { handleNotificationResponse } from './notificationNavigation';
import { getNativePushRegistration } from './notificationService';
import { createLogger, serializeError } from '../utils/logger';

export const NotificationContext = createContext();
const notificationsLogger = createLogger('notifications', 'Notifications');

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const notificationId = notification?.request?.identifier;
        const data = notification?.request?.content?.data || {};
        notificationsLogger.info('foreground-notification-received', {
          notificationId,
          data,
        });
      }
    );

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response?.notification?.request?.content?.data || {};
        notificationsLogger.info('notification-tap-received', data);
        handleNotificationResponse(response);
      });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          notificationsLogger.debug('processing-last-notification-response');
          handleNotificationResponse(response);
        }
      })
      .catch((error) => {
        notificationsLogger.warn(
          'failed-to-read-last-notification-response',
          serializeError(error)
        );
      });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!userId || Platform.OS === 'web') {
      notificationsLogger.debug('token-sync-skipped', {
        hasUser: Boolean(userId),
        platform: Platform.OS,
      });
      return undefined;
    }

    let isCancelled = false;

    const syncNativeToken = async (overrideTokenResponse = null) => {
      try {
        const registration = await getNativePushRegistration(
          overrideTokenResponse
        );

        if (!registration || isCancelled) {
          notificationsLogger.debug('token-sync-aborted', {
            hasRegistration: Boolean(registration),
            isCancelled,
          });
          return;
        }

        notificationsLogger.info('syncing-native-token', {
          userId,
          platform: registration.platform,
          tokenType: registration.tokenType,
          deviceId: registration.deviceId,
          token: registration.token,
        });
        await notificationAPI.saveToken(registration);
        notificationsLogger.info('native-token-sync-success', {
          userId,
          tokenType: registration.tokenType,
          deviceId: registration.deviceId,
        });
      } catch (error) {
        notificationsLogger.error(
          'native-token-sync-failed',
          serializeError(error)
        );
      }
    };

    syncNativeToken();

    const tokenSubscription = Notifications.addPushTokenListener
      ? Notifications.addPushTokenListener((token) => {
          notificationsLogger.info('native-push-token-refresh-received');
          syncNativeToken(token);
        })
      : null;

    return () => {
      isCancelled = true;
      tokenSubscription?.remove?.();
    };
  }, [userId]);

  return children;
}
