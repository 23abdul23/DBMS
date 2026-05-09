/**
 * Global logout event emitter
 * Allows axios interceptor to trigger logout in AuthContext
 */

let logoutCallback = null;

export const setLogoutCallback = (callback) => {
  logoutCallback = callback;
};

export const clearLogoutCallback = () => {
  logoutCallback = null;
};

export const emitLogout = async (reason = 'SESSION_REVOKED') => {
  console.log('[LogoutEventEmitter] Logout triggered:', reason);

  if (logoutCallback) {
    try {
      await logoutCallback(reason);
    } catch (error) {
      console.error('[LogoutEventEmitter] Error in logout callback:', error);
    }
  } else {
    console.warn('[LogoutEventEmitter] No logout callback registered');
  }
};
