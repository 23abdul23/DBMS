const fs = require("fs")
const os = require("os")
const path = require("path")

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim()

      if (!trimmed || trimmed.startsWith("#")) {
        return env
      }

      const separatorIndex = trimmed.indexOf("=")
      if (separatorIndex === -1) {
        return env
      }

      const key = trimmed.slice(0, separatorIndex).trim()
      let value = trimmed.slice(separatorIndex + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      env[key] = value
      return env
    }, {})
}

function getLocalIPAddress() {
  const interfaces = os.networkInterfaces()

  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address
      }
    }
  }

  return "localhost"
}

const backendEnv = readEnvFile(path.resolve(__dirname, "../backend/.env"))
const getConfigValue = (key, fallback) => process.env[key] || backendEnv[key] || fallback

const apiPrimaryBaseUrl = getConfigValue(
  "API_BASE_URL_PRIMARY",
  getConfigValue("API_BASE_URL", "https://aegisbackedn-gcfefgdxa8ddcdfp.uaenorth-01.azurewebsites.net/api"),
)
const apiSecondaryBaseUrl = getConfigValue("API_BASE_URL_SECONDARY", "https://aegisbackedn-gcfefgdxa8ddcdfp.uaenorth-01.azurewebsites.net/api")
const apiHost = getConfigValue("API_HOST", "10.145.159.171")

// const apiHost = getConfigValue("API_HOST", getLocalIPAddress())
const apiPort = Number(getConfigValue("API_PORT", getConfigValue("PORT", 8080)))
const emergencyMedicalPhone = getConfigValue("EMERGENCY_MEDICAL_PHONE", "9329594882")
const emergencySecurityPhone = getConfigValue("EMERGENCY_SECURITY_PHONE", "7217492629")
const emergencyFirePhone = getConfigValue("EMERGENCY_FIRE_PHONE", "8618275578")
const emergencyOtherPhone = getConfigValue("EMERGENCY_OTHER_PHONE", "7909069340")

module.exports = {
  expo: {
    name: "Aegis ID",
    slug: "aegis-id",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff00",
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription:
          "Aegis uses your camera to scan QR codes and barcodes for entry and exit verification.",
        NSLocationWhenInUseUsageDescription:
          "Aegis uses your location to share your live position during emergency calls and alerts.",
      },
    },
    android: {
      package: "com.abdul.aegis",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      API_BASE_URL: apiPrimaryBaseUrl,
      API_BASE_URL_PRIMARY: apiPrimaryBaseUrl,
      API_BASE_URL_SECONDARY: apiSecondaryBaseUrl,
      PORT: apiPort,
      API_HOST: apiHost,
      EMERGENCY_MEDICAL_PHONE: emergencyMedicalPhone,
      EMERGENCY_SECURITY_PHONE: emergencySecurityPhone,
      EMERGENCY_FIRE_PHONE: emergencyFirePhone,
      EMERGENCY_OTHER_PHONE: emergencyOtherPhone,
      "eas": {
        "projectId": "0713ff11-c8b1-468c-93b8-c664dbf6d0f3"
      }
    },
    plugins: [
      "@react-native-community/datetimepicker",
      "expo-font",
      [
        "expo-camera",
        {
          cameraPermission:
            "Aegis uses your camera to scan QR codes and barcodes for entry and exit verification.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Aegis uses your location to share your live position during emergency calls and alerts.",
        },
      ],
    ],
  },
}
