import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Sanitize a string to be safe for file names
 */
export const sanitizeFilePart = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Format timestamp for file naming
 */
export const formatDateStamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
};

/**
 * Download a single QR code image
 * @param {React.MutableRefObject} qrRef - Reference to QR code component
 * @param {string} fileName - Name of the file to save
 * @returns {Promise<{success: boolean, path?: string, error?: Error}>}
 */
export const downloadQRCodeImage = async (qrRef, fileName) => {
  try {
    if (!qrRef?.current) {
      throw new Error('QR Code reference not found');
    }

    const capturedUri = await captureRef(qrRef.current, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });

    const capturedBase64 = await FileSystem.readAsStringAsync(capturedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (Platform.OS === 'android') {
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (!permissions.granted) {
        throw new Error('Storage permission denied');
      }

      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileName,
        'image/png'
      );

      await FileSystem.writeAsStringAsync(fileUri, capturedBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return { success: true, path: fileUri };
    }

    // iOS fallback
    const fallbackUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fallbackUri, capturedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { success: true, path: fallbackUri };
  } catch (error) {
    console.log('QR Code download error:', error);
    return { success: false, error };
  }
};

/**
 * Build QR code payload for a location
 * @param {string} location - Location name
 * @param {object} additionalData - Additional data to include in QR
 * @returns {string} JSON stringified payload
 */
export const buildLocationQRPayload = (location, additionalData = {}) => {
  return JSON.stringify({
    location,
    scanType: 'location',
    timestamp: new Date().toISOString(),
    ...additionalData,
  });
};

/**
 * Build QR code payload for a guard
 * @param {string} guardName - Guard's name
 * @param {string} guardId - Guard's ID
 * @param {string} location - Location name
 * @returns {string} JSON stringified payload
 */
export const buildGuardQRPayload = (guardName, guardId, location = '') => {
  return JSON.stringify({
    guardName,
    guardId,
    location: location || undefined,
    scanType: 'guard',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Build QR code payload for a student
 * @param {string} studentId - Student's ID
 * @param {string} userId - User's ID
 * @returns {string} JSON stringified payload
 */
export const buildStudentQRPayload = (studentId, userId) => {
  return JSON.stringify({
    studentId,
    userId,
    scanType: 'student',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Request directory access for file downloads
 * @returns {Promise<string>} Directory URI
 */
export const requestDownloadDirectory = async () => {
  try {
    if (Platform.OS === 'android') {
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (!permissions.granted) {
        throw new Error('Storage permission denied');
      }

      return permissions.directoryUri;
    }

    return FileSystem.documentDirectory;
  } catch (error) {
    console.log('Directory request error:', error);
    throw error;
  }
};

/**
 * Save base64 image to file
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} fileName - File name to save as
 * @param {string} directoryUri - Directory URI (optional for Android)
 * @returns {Promise<{success: boolean, path?: string, error?: Error}>}
 */
export const saveBase64Image = async (
  base64Data,
  fileName,
  directoryUri = null
) => {
  try {
    if (Platform.OS === 'android') {
      if (!directoryUri) {
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (!permissions.granted) {
          throw new Error('Storage permission denied');
        }

        directoryUri = permissions.directoryUri;
      }

      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        directoryUri,
        fileName,
        'image/png'
      );

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return { success: true, path: fileUri };
    }

    // iOS fallback
    const fallbackUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fallbackUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { success: true, path: fallbackUri };
  } catch (error) {
    console.log('Save base64 image error:', error);
    return { success: false, error };
  }
};

/**
 * Generate batch file name for multiple QR downloads
 * @param {string} prefix - Optional prefix
 * @returns {string} File name with timestamp
 */
export const generateBatchFileName = (prefix = 'qr-batch') => {
  const timestamp = formatDateStamp();
  return `${prefix}-${timestamp}.zip`;
};

/**
 * Create a manifest of downloaded QR codes
 * @param {Array} downloads - Array of download records
 * @returns {string} JSON manifest
 */
export const createDownloadManifest = (downloads = []) => {
  return JSON.stringify(
    {
      downloadedAt: new Date().toISOString(),
      totalCount: downloads.length,
      successCount: downloads.filter((d) => d.success).length,
      downloads,
    },
    null,
    2
  );
};

/**
 * Save download manifest to file
 * @param {Array} downloads - Array of download records
 * @param {string} directoryUri - Directory URI (optional for Android)
 * @returns {Promise<{success: boolean, path?: string, error?: Error}>}
 */
// export const saveDownloadManifest = async (downloads, directoryUri = null) => {
//   try {
//     const manifest = createDownloadManifest(downloads);
//     const fileName = `qr-downloads-manifest-${formatDateStamp()}.json`;

//     const manifestBase64 = Buffer.from(manifest).toString('base64');

//     return saveBase64Image(manifestBase64, fileName, directoryUri);
//   } catch (error) {
//     console.log('Save manifest error:', error);
//     return { success: false, error };
//   }
// };

/**
 * Get all files in a directory
 * @returns {Promise<Array>} Array of file info objects
 */
export const getDownloadedFiles = async () => {
  try {
    if (Platform.OS === 'android') {
      // Note: This requires additional permissions and directory access
      // Typically returns files from the Downloads directory
      const documentsUri = FileSystem.documentDirectory;
      const files = await FileSystem.readDirectoryAsync(documentsUri);
      return files.filter((f) => f.startsWith('aegis'));
    }

    const documentsUri = FileSystem.documentDirectory;
    const files = await FileSystem.readDirectoryAsync(documentsUri);
    return files.filter((f) => f.startsWith('aegis'));
  } catch (error) {
    console.log('Get files error:', error);
    return [];
  }
};

/**
 * Delete a downloaded file
 * @param {string} filePath - Full path to file
 * @returns {Promise<{success: boolean, error?: Error}>}
 */
export const deleteDownloadedFile = async (filePath) => {
  try {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
    return { success: true };
  } catch (error) {
    console.log('Delete file error:', error);
    return { success: false, error };
  }
};

/**
 * Share a downloaded QR code file
 * @param {string} filePath - Path to the file
 * @param {string} fileName - Name to display when sharing
 */
export const shareDownloadedFile = async (filePath, fileName) => {
  try {
    // This would require expo-sharing or similar
    // Placeholder for sharing functionality
    console.log(`Share file: ${filePath} as ${fileName}`);
  } catch (error) {
    console.log('Share file error:', error);
  }
};
