/**
 * Global logout event emitter
 * Allows axios interceptor to trigger logout in AuthContext
 */

import { createLogger, serializeError } from './logger';

let logoutCallback = null;
const authLogger = createLogger('auth', 'Auth');

export const setLogoutCallback = (callback) => {
  logoutCallback = callback;
};

export const clearLogoutCallback = () => {
  logoutCallback = null;
};

export const emitLogout = async (reason = 'SESSION_REVOKED') => {
  authLogger.info('logout-emitted', { reason });

  if (logoutCallback) {
    try {
      await logoutCallback(reason);
    } catch (error) {
      authLogger.error('logout-callback-failed', serializeError(error));
    }
  } else {
    authLogger.warn('logout-callback-missing');
  }
};
