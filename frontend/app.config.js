const fs = require('fs');
const path = require('path');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return env;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex === -1) {
        return env;
      }

      const key = trimmed.slice(0, separatorIndex).trim();

      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value;

      return env;
    }, {});
}

const backendEnv = readEnvFile(path.resolve(__dirname, '../backend/.env'));

const getConfigValue = (key, fallback) =>
  process.env[key] || backendEnv[key] || fallback;

const environment = String(getConfigValue('ENVIRONMENT', 'production'))
  .trim()
  .toLowerCase();

const isDevelopment = environment === 'development';
const isTesting = environment === 'testing';
const isProduction = environment === 'production';

/**
 * Dynamic App Identity
 */
const appName = isTesting ? 'Aegis Dev' : 'Aegis ID';

const appSlug = isTesting ? 'aegis-id-dev' : 'aegis-id';

const androidPackage = isTesting ? 'com.abdul.aegis.test' : 'com.abdul.aegis';

const iosBundleIdentifier = isTesting
  ? 'com.abdul.aegis.test'
  : 'com.abdul.aegis';

/**
 * API Config
 */
const apiPort = Number(
  getConfigValue('API_PORT', getConfigValue('PORT', 5000))
);

const localApiBaseUrl = getConfigValue(
  'API_BASE_URL_LOCAL',
  `http://localhost:${apiPort}/api`
);

const deployedApiBaseUrl = getConfigValue(
  'API_BASE_URL_DEPLOYED',
  'https://api.aegisid.app/api'
);

const apiPrimaryBaseUrl = isDevelopment ? localApiBaseUrl : deployedApiBaseUrl;

const apiSecondaryBaseUrl = isDevelopment
  ? deployedApiBaseUrl
  : getConfigValue('API_BASE_URL_SECONDARY', deployedApiBaseUrl);

const apiHost = getConfigValue('API_HOST', '10.145.159.171');

/**
 * Emergency Contacts
 */
const emergencyMedicalPhone = getConfigValue(
  'EMERGENCY_MEDICAL_PHONE',
  '9329594882'
);

const emergencySecurityPhone = getConfigValue(
  'EMERGENCY_SECURITY_PHONE',
  '7217492629'
);

const emergencyFirePhone = getConfigValue('EMERGENCY_FIRE_PHONE', '8618275578');

const emergencyOtherPhone = getConfigValue(
  'EMERGENCY_OTHER_PHONE',
  '7909069340'
);

/**
 * Library Limits
 */
const libraryLimit = Number(getConfigValue('LIBRARY_LIMIT', 60));

module.exports = {
  expo: {
    name: appName,

    slug: appSlug,

    version: '1.6.2',

    orientation: 'portrait',

    icon: './assets/aegisLogoWhite.png',

    userInterfaceStyle: 'light',

    newArchEnabled: false,

    splash: {
      image: './assets/aegisIdLogo.png',
      resizeMode: 'contain',
      backgroundColor: '#08111f',
    },

    ios: {
      bundleIdentifier: iosBundleIdentifier,

      supportsTablet: true,

      infoPlist: {
        NSCameraUsageDescription:
          'Aegis uses your camera to scan QR codes for entry and exit verification.',

        NSLocationWhenInUseUsageDescription:
          'Aegis uses your location to share your live position during emergency calls and alerts.',

        LSApplicationQueriesSchemes: ['tel', 'telprompt', 'sms', 'smsto'],

        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      package: androidPackage,

      adaptiveIcon: {
        foregroundImage: './assets/aegisLogoWhite.png',
        backgroundColor: '#ffffff',
      },

      edgeToEdgeEnabled: true,

      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'POST_NOTIFICATIONS',
      ],
    },

    web: {
      favicon: './assets/aegisLogoWhite.png',
    },

    extra: {
      ENVIRONMENT: environment,

      BUILD_TYPE: isTesting ? 'TEST' : isDevelopment ? 'DEV' : 'PROD',

      API_BASE_URL: apiPrimaryBaseUrl,

      API_BASE_URL_PRIMARY: apiPrimaryBaseUrl,

      API_BASE_URL_SECONDARY: apiSecondaryBaseUrl,

      PORT: apiPort,

      API_HOST: apiHost,

      LIBRARY_LIMIT: libraryLimit,

      EMERGENCY_MEDICAL_PHONE: emergencyMedicalPhone,

      EMERGENCY_SECURITY_PHONE: emergencySecurityPhone,

      EMERGENCY_FIRE_PHONE: emergencyFirePhone,

      EMERGENCY_OTHER_PHONE: emergencyOtherPhone,

      eas: {
        projectId: '0713ff11-c8b1-468c-93b8-c664dbf6d0f3',
      },
    },

    plugins: [
      '@react-native-community/datetimepicker',

      'expo-font',

      [
        'expo-notifications',
        {
          icon: './assets/aegisLogoWhite.png',
          color: '#0A84FF',
          sounds: [],
        },
      ],

      [
        'expo-camera',
        {
          cameraPermission:
            'Aegis uses your camera to scan QR codes for entry and exit verification.',
        },
      ],

      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Aegis uses your location to share your live position during emergency calls and alerts.',
        },
      ],
    ],
  },
};
