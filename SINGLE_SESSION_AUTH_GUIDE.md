# Single-Session Authentication Implementation - Complete Guide

## ✅ What Has Been Implemented

### 1. **Backend Authentication Middleware (auth.js)**

- Verifies JWT tokens
- Checks session existence in database
- **Returns specific error codes:**
  - `SESSION_REVOKED` - User logged in on another device
  - `TOKEN_EXPIRED` - Token has expired
  - `USER_NOT_FOUND` - User was deleted
  - `USER_DISABLED` - Account has been disabled
  - `INVALID_TOKEN` - Malformed or invalid JWT
  - `AUTH_ERROR` - Generic authentication error

### 2. **Backend Token Refresh (authRoutes.js - /auth/refresh)**

- Validates refresh token hash against database
- Generates new access token
- **Implements token rotation:** Old refresh token invalidated, new one issued
- **Returns specific error codes:**
  - `SESSION_REVOKED` - No session found (user logged in elsewhere)
  - `TOKEN_EXPIRED` - Refresh token expired
  - `USER_DISABLED` - Account disabled
  - `REFRESH_ERROR` - Server error

### 3. **Backend Logout Route (authRoutes.js - POST /auth/logout)**

- Properly deletes session from database
- Returns `LOGGED_OUT` code on success
- Protected by `authenticate` middleware

### 4. **Frontend Logout Event System (logoutEventEmitter.js)**

- Global event emitter for forced logouts
- Allows axios interceptor to trigger logout in AuthContext
- Prevents async timing issues

### 5. **Frontend Axios Interceptor (api.js)**

- **Request Interceptor:** Automatically attaches access token
- **Response Interceptor:**
  - Detects `SESSION_REVOKED` error → Forces immediate logout
  - Detects `TOKEN_EXPIRED` → Attempts token refresh
  - Prevents infinite refresh loops with `_retry` flag
  - Uses axios (not api instance) for refresh to avoid interceptor recursion
  - Emits logout event via event emitter

### 6. **Frontend AuthContext**

- Registers logout callback with event emitter on mount
- `logout()` function accepts reason parameter:
  - `USER_REQUESTED` - User clicked logout (notify backend)
  - `SESSION_REVOKED` - System detected session revoked (don't notify backend)
  - Other reasons - Forced logout without backend notification
- Clears both SecureStore tokens and AsyncStorage user data

---

## 🔄 Expected Flow: Phone A vs Phone B

### **Scenario: Phone A logged in, then Phone B logs in**

#### **Phone B (New Login)**

```
1. User logs in with email/password
2. Backend:
   - Deletes all existing sessions for this user
   - Creates new UserSession with new refresh token hash
   - Returns new accessToken + refreshToken
3. Frontend:
   - Stores tokens in SecureStore
   - Stores user data in AsyncStorage
   - Sets AuthContext.user & AuthContext.token
4. Phone B now shows full user profile and can make API calls
```

#### **Phone A (Old Device - What Should Happen Now)**

```
1. Phone A still has old accessToken in SecureStore
2. Phone A makes API request (e.g., GET /auth/profile)
3. Backend receives old accessToken
   - Middleware verifies token
   - Looks up session by sessionId in JWT
   - Session is NOT found (was deleted when Phone B logged in)
   - Returns 401 with code: "SESSION_REVOKED"
4. Frontend Axios interceptor receives 401 + SESSION_REVOKED
   - Recognizes this is session revoked (not just expired)
   - Does NOT attempt token refresh
   - Calls emitLogout("SESSION_REVOKED")
5. Event emitter triggers logout callback in AuthContext
6. AuthContext.logout() is called
   - Deletes accessToken from SecureStore
   - Deletes refreshToken from SecureStore
   - Deletes user data from AsyncStorage
   - Sets AuthContext.user = null
   - Sets AuthContext.token = null
7. App re-renders
   - All screens see user = null
   - Navigation redirects to LoginScreen
   - Phone A is now properly logged out
```

---

## 🛡️ Security Features

### **Token Security**

- ✅ Refresh tokens only stored as hashes in database
- ✅ Access token is short-lived (15 minutes by default)
- ✅ Refresh token is long-lived (7 days by default)
- ✅ Token rotation on every refresh (old token invalidated)
- ✅ JWT contains only: userId, role, sessionId (no sensitive data)

### **Infinite Refresh Loop Prevention**

- ✅ `_retry` flag prevents same request from retrying multiple times
- ✅ SESSION_REVOKED errors don't trigger refresh attempts
- ✅ Uses raw axios for refresh (not intercepted instance)
- ✅ Refresh errors trigger logout instead of retry

### **Session Revocation**

- ✅ Previous sessions deleted on new login
- ✅ Session lookup by sessionId in JWT
- ✅ Session must exist AND not be expired
- ✅ USER_DISABLED or deleted users are detected

### **Logout Synchronization**

- ✅ Async logout callback prevents race conditions
- ✅ All async storage operations use Promise.all
- ✅ Catch errors on delete to prevent failures if already deleted

---

## 🧪 Testing the Implementation

### **Test Case 1: Phone B Logs In While Phone A Is Idle**

```
1. Open app on Phone A (logged in as user@example.com)
2. Open app on Phone B (same user@example.com)
3. Login on Phone B with correct password
4. On Phone A: Try to navigate to any protected screen
5. Expected: Automatic logout, redirect to login
6. Actual behavior should now show: "Your session is no longer valid..."
```

### **Test Case 2: Phone B Logs In Then Phone A Refreshes API**

```
1. Phone A logged in, idle
2. Phone B logs in
3. On Phone A: Pull-to-refresh on profile screen
4. Expected:
   - Shows loading spinner briefly
   - Receives SESSION_REVOKED error
   - Shows alert or banner: "Logged out from another device"
   - Redirects to login
```

### **Test Case 3: Normal Token Expiration**

```
1. Access token expires naturally (15 minutes)
2. User tries to make API request
3. Expected:
   - Middleware returns TOKEN_EXPIRED
   - Axios interceptor attempts refresh
   - New tokens are issued
   - Original request retried with new token
   - User continues without disruption
```

### **Test Case 4: Refresh Token Rotation**

```
1. User makes request, access token expires
2. Axios calls /auth/refresh with old refresh token
3. Backend:
   - Validates old refresh token hash
   - Generates new refresh token
   - Updates session with new refresh token hash
   - Returns new access + refresh tokens
4. Frontend stores new tokens
5. Expected: Old refresh token is now invalid (cannot use again)
```

---

## 🐛 Debugging Tips

### **Add logging to identify issues:**

#### **In api.js interceptor:**

```javascript
console.log('[API Error]', {
  code: errorCode,
  message: errorMessage,
  status: error.response?.status,
  retried: !!originalRequest._retry,
});
```

#### **In AuthContext:**

```javascript
console.log('[AuthContext] Logging out - Reason:', reason);
console.log('[AuthContext] Logout complete');
```

#### **In backend middleware:**

```javascript
console.log('Session check:', {
  sessionExists: !!session,
  isExpired: session?.expiresAt < new Date(),
  userId: session?.userId,
});
```

### **Common Issues & Solutions:**

| Issue                       | Cause                          | Solution                                          |
| --------------------------- | ------------------------------ | ------------------------------------------------- |
| Phone A partially logged in | AuthContext not notified       | Ensure logout callback is registered in useEffect |
| Infinite refresh loop       | Using api instance for refresh | Use raw axios for /auth/refresh call              |
| TOKEN_EXPIRED not caught    | Wrong error code               | Check backend returns correct code                |
| User data still showing     | AsyncStorage not cleared       | Verify Promise.all clears all storage             |
| Session revoked not working | Middleware returns wrong code  | Check auth.js returns SESSION_REVOKED             |

---

## 📋 Remaining Tasks (Optional Enhancements)

1. **Add session cleanup cron job** - Delete expired sessions every hour
2. **Add device identification** - Store device name/IP for user awareness
3. **Add "Log out from all devices" feature** - Delete all sessions except current
4. **Add session history UI** - Show user list of active sessions
5. **Add re-authentication flow** - For sensitive operations (password change)
6. **Add refresh token versioning** - Prevent use of old rotation chain
7. **Add rate limiting** - Prevent brute force on refresh endpoint

---

## 📝 Key Files Modified

- `backend/middleware/auth.js` - Added error codes
- `backend/routes/authRoutes.js` - Updated /login, /refresh, /logout
- `frontend/services/api.js` - Improved axios interceptors
- `frontend/context/AuthContext.js` - Added logout callback registration
- `frontend/utils/logoutEventEmitter.js` - NEW: Event system

---

## ✨ Summary

The single-session authentication system now properly prevents multiple concurrent logins. When a user logs in on Phone B, Phone A will:

1. ✅ Detect SESSION_REVOKED on next API call
2. ✅ Immediately delete tokens (no refresh attempt)
3. ✅ Notify AuthContext via event emitter
4. ✅ Clear all user data from storage
5. ✅ Redirect to login screen

This provides a seamless, secure logout experience without requiring the user to manually logout.
