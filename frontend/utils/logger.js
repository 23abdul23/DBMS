const LOG_CONFIG = {
  enabled: true,
  allowInProduction: true,
  features: {
    notifications: true,
    api: true,
    auth: true,
    location: false,
    navigation: false,
    proximity: false,
    scanner: false,
    dashboard: false,
    library: false,
    sac: false,
    equipment: false,
    clubRoom: false,
  },
};

const SENSITIVE_KEY_MATCHERS = [
  /pass(word)?/i,
  /token/i,
  /authorization/i,
  /secret/i,
  /cookie/i,
  /otp/i,
];
const EMAIL_KEY_MATCHER = /email/i;

function maskEmail(value) {
  if (typeof value !== 'string' || !value.includes('@')) {
    return '[redacted-email]';
  }

  const [localPart, domain = ''] = value.split('@');
  if (!localPart) {
    return '[redacted-email]';
  }

  const visibleLocal =
    localPart.length <= 2
      ? `${localPart[0] || '*'}*`
      : `${localPart.slice(0, 2)}***`;

  return `${visibleLocal}@${domain}`;
}

function maskToken(value) {
  if (typeof value !== 'string') {
    return '[redacted-token]';
  }

  if (value.length <= 12) {
    return `[redacted-token len=${value.length}]`;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)} (len=${value.length})`;
}

function shouldRedactKey(key) {
  return SENSITIVE_KEY_MATCHERS.some((matcher) => matcher.test(key));
}

function sanitizeValue(value, key = '', seen = new WeakSet()) {
  if (value == null) {
    return value;
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (typeof value === 'string') {
    if (shouldRedactKey(key)) {
      return maskToken(value);
    }
    if (EMAIL_KEY_MATCHER.test(key)) {
      return maskEmail(value);
    }
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (typeof value === 'function') {
    return `[function ${value.name || 'anonymous'}]`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[circular]';
    }

    seen.add(value);

    const sanitized = {};
    Object.entries(value).forEach(([childKey, childValue]) => {
      if (shouldRedactKey(childKey)) {
        sanitized[childKey] =
          typeof childValue === 'string'
            ? maskToken(childValue)
            : '[redacted-sensitive]';
        return;
      }

      if (EMAIL_KEY_MATCHER.test(childKey)) {
        sanitized[childKey] = maskEmail(childValue);
        return;
      }

      sanitized[childKey] = sanitizeValue(childValue, childKey, seen);
    });

    seen.delete(value);
    return sanitized;
  }

  return String(value);
}

function serializePayload(payload) {
  if (payload === undefined) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  try {
    return JSON.stringify(sanitizeValue(payload));
  } catch (error) {
    return JSON.stringify({
      serializationError: error?.message || String(error),
    });
  }
}

export function serializeError(error) {
  if (!error) {
    return null;
  }

  return sanitizeValue({
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    status: error.response?.status,
    responseData: error.response?.data,
  });
}

export function sanitizeForLogs(payload) {
  return sanitizeValue(payload);
}

export function createLogger(feature, tag = feature.toUpperCase()) {
  const shouldLog = () =>
    LOG_CONFIG.enabled &&
    (LOG_CONFIG.allowInProduction || __DEV__) &&
    Boolean(LOG_CONFIG.features[feature]);

  const write = (method, message, payload) => {
    if (!shouldLog()) {
      return;
    }

    const consoleMethod = console[method] || console.log;
    const serializedPayload = serializePayload(payload);
    const line = serializedPayload
      ? `[${tag}] ${message} ${serializedPayload}`
      : `[${tag}] ${message}`;

    consoleMethod(line);
  };

  return {
    enabled: shouldLog,
    debug: (message, payload) => write('log', message, payload),
    info: (message, payload) => write('info', message, payload),
    warn: (message, payload) => write('warn', message, payload),
    error: (message, payload) => write('error', message, payload),
  };
}

export { LOG_CONFIG };
