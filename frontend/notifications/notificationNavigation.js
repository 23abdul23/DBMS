import { createNavigationContainerRef } from '@react-navigation/native';
import { createLogger, serializeError } from '../utils/logger';

export const navigationRef = createNavigationContainerRef();
const navigationLogger = createLogger('notifications', 'Notifications');

let navigationReady = false;
const pendingResponses = [];

function navigateFromResponse(response) {
  if (!response?.notification?.request?.content) {
    return;
  }

  const data = response.notification.request.content.data || {};
  const explicitRoute =
    typeof data.routeName === 'string' && data.routeName.trim().length > 0
      ? data.routeName.trim()
      : null;

  const targetRoute = explicitRoute || 'Notifications';

  let params = undefined;
  if (data.params) {
    try {
      params =
        typeof data.params === 'string' ? JSON.parse(data.params) : data.params;
    } catch (e) {
      navigationLogger.warn(
        'failed-to-parse-notification-navigation-params',
        serializeError(e)
      );
    }
  }

  if (!navigationRef.isReady()) {
    navigationLogger.debug(
      'queueing-notification-response-until-navigation-ready'
    );
    pendingResponses.push(response);
    return;
  }

  try {
    navigationLogger.info('navigating-from-notification-response', {
      targetRoute,
      params,
    });
    navigationRef.navigate(targetRoute, params);
  } catch (error) {
    navigationLogger.error(
      'notification-navigation-failed',
      serializeError(error)
    );
  }
}

export function handleNotificationResponse(response) {
  if (!navigationReady || !navigationRef.isReady()) {
    navigationLogger.debug(
      'notification-response-received-before-navigation-ready'
    );
    pendingResponses.push(response);
    return;
  }

  navigateFromResponse(response);
}

export function setNavigationReady(isReady) {
  navigationReady = Boolean(isReady);
  navigationLogger.debug('navigation-ready-state-updated', {
    navigationReady,
    queuedResponses: pendingResponses.length,
  });

  if (!navigationReady || !navigationRef.isReady()) {
    return;
  }

  while (pendingResponses.length > 0) {
    const response = pendingResponses.shift();
    navigateFromResponse(response);
  }
}
