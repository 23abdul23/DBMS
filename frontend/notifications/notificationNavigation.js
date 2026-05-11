import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

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
      console.log('[Notifications] Failed to parse navigation params:', e);
    }
  }

  if (!navigationRef.isReady()) {
    pendingResponses.push(response);
    return;
  }

  try {
    navigationRef.navigate(targetRoute, params);
  } catch (error) {
    console.log('[Notifications] Navigation from response failed:', error);
  }
}

export function handleNotificationResponse(response) {
  if (!navigationReady || !navigationRef.isReady()) {
    pendingResponses.push(response);
    return;
  }

  navigateFromResponse(response);
}

export function setNavigationReady(isReady) {
  navigationReady = Boolean(isReady);

  if (!navigationReady || !navigationRef.isReady()) {
    return;
  }

  while (pendingResponses.length > 0) {
    const response = pendingResponses.shift();
    navigateFromResponse(response);
  }
}
