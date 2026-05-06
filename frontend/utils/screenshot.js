import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const SCREENSHOT_DIRECTORY_URI_KEY = 'debugScreenshotDirectoryUri';
const ANDROID_DOWNLOADS_PATH = 'file:///storage/emulated/0/Download';

export const sanitizeFilePart = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const formatTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
};

export const buildScreenshotFileName = ({
  routeName,
  label,
  prefix = 'aegis',
} = {}) => {
  const routePart = sanitizeFilePart(routeName) || 'screen';
  const labelPart = sanitizeFilePart(label);
  const suffix = labelPart ? `-${labelPart}` : '';

  return `${prefix}-${routePart}${suffix}-${formatTimestamp()}.png`;
};

const writeBase64ToDirectDownloads = async (base64, fileName) => {
  const destination = `${ANDROID_DOWNLOADS_PATH}/${fileName}`;

  await FileSystem.writeAsStringAsync(destination, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    savedUri: destination,
    usedDirectoryAccess: false,
  };
};

const requestScreenshotDirectory = async () => {
  Alert.alert(
    'Choose Screenshot Folder',
    'Select the Android Downloads folder to save screenshots there.'
  );

  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

  if (!permission.granted || !permission.directoryUri) {
    throw new Error('Folder access was not granted.');
  }

  await AsyncStorage.setItem(
    SCREENSHOT_DIRECTORY_URI_KEY,
    permission.directoryUri
  );
  return permission.directoryUri;
};

const writeBase64WithStorageAccessFramework = async (base64, fileName) => {
  const storedDirectoryUri = await AsyncStorage.getItem(
    SCREENSHOT_DIRECTORY_URI_KEY
  );

  const writeToDirectory = async (directoryUri) => {
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      directoryUri,
      fileName,
      'image/png'
    );

    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      savedUri: fileUri,
      usedDirectoryAccess: true,
    };
  };

  if (storedDirectoryUri) {
    try {
      return await writeToDirectory(storedDirectoryUri);
    } catch (error) {
      await AsyncStorage.removeItem(SCREENSHOT_DIRECTORY_URI_KEY);
      console.log(error);
    }
  }

  const directoryUri = await requestScreenshotDirectory();
  return writeToDirectory(directoryUri);
};

export const saveCapturedPng = async ({ capturedUri, fileName }) => {
  if (!capturedUri) {
    throw new Error('No screenshot image is available to save.');
  }

  const capturedBase64 = await FileSystem.readAsStringAsync(capturedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    if (Platform.OS === 'android') {
      try {
        return await writeBase64ToDirectDownloads(capturedBase64, fileName);
      } catch {
        return await writeBase64WithStorageAccessFramework(
          capturedBase64,
          fileName
        );
      }
    }

    const fallbackUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fallbackUri, capturedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      savedUri: fallbackUri,
      usedDirectoryAccess: false,
    };
  } finally {
    await FileSystem.deleteAsync(capturedUri, { idempotent: true }).catch(
      () => undefined
    );
  }
};
