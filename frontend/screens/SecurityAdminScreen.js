'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import { captureRef } from 'react-native-view-shot';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { securityAdminAPI, securityAPI } from '../services/api';
import { useAppLocation } from '../context/LocationContext';
import { buildGuardQRPayload } from '../utils/qrDownloadUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import { FONTS, SIZES, SPACING, COLORS } from '../utils/constants';
import {
  CONTENT_MAX_WIDTH,
  getTwoColumnCardWidth,
} from '../utils/responsiveLayout';
import { showToast } from '../utils/toast';

/**
 * QR Card Component - Compact card for 4-column grid
 */
function QRCard({ location, colors, onPress }) {
  const [qrValue] = useState(
    buildGuardQRPayload(undefined, undefined, location.name)
  );

  return (
    <TouchableOpacity
      style={[
        styles.qrCard,
        {
          backgroundColor: location.isActive
            ? colors.cardElevated
            : colors.cardMuted,
          borderColor: colors.border,
          opacity: location.isActive ? 1 : 0.6,
        },
      ]}
      onPress={() => onPress(location)}
    >
      <View
        style={[
          styles.qrCardContent,
          { backgroundColor: COLORS.white, borderRadius: 8 },
        ]}
      >
        <QRCode
          value={qrValue}
          size={100}
          color={COLORS.gray[800]}
          backgroundColor={COLORS.white}
          quietZone={2}
        />
      </View>
      <View style={styles.qrCardInfo}>
        <Text
          style={[styles.qrCardName, { color: colors.heading }]}
          numberOfLines={2}
        >
          {location.name}
        </Text>
        <Text style={[styles.qrCardType, { color: colors.subText }]}>
          {location.type || 'LOCATION'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * QR Expanded Modal Component - Full details on tap with scanning capability
 */
function QRExpandedModal({
  visible,
  location,
  colors,
  onDownload,
  onEdit,
  onClose,
}) {
  const qrRef = useRef(null);
  const { user } = useAuth();
  const { location: currentLocation, refreshLocation } = useAppLocation();
  const [permission, requestPermission] = useCameraPermissions();
  const [downloading, setDownloading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const qrPayload = JSON.stringify({
    // Core QR Info
    qrId: `QR-${location.id}`,
    qrType: 'location',

    // Location Details
    locationId: location.id,
    locationName: location.name,
    locationType: location.type,
    latitude: location.latitude,
    longitude: location.longitude,

    // Scan Metadata
    scanType: 'securityAdmin',
    issuedAt: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  });

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const capturedUri = await captureRef(qrRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const fileDate = new Date();
      const year = fileDate.getFullYear();
      const month = String(fileDate.getMonth() + 1).padStart(2, '0');
      const day = String(fileDate.getDate()).padStart(2, '0');
      const hours = String(fileDate.getHours()).padStart(2, '0');
      const minutes = String(fileDate.getMinutes()).padStart(2, '0');
      const seconds = String(fileDate.getSeconds()).padStart(2, '0');
      const dateStamp = `${year}-${month}-${day}-${hours}${minutes}${seconds}`;

      const sanitizedName = String(location.name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const fileName = `aegis-location-qr-${sanitizedName}-${dateStamp}.png`;

      const capturedBase64 = await FileSystem.readAsStringAsync(capturedUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (Platform.OS === 'android') {
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (!permissions.granted) {
          Alert.alert(
            'Download Cancelled',
            'Folder access is required to save the QR file.'
          );
          return;
        }

        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'image/png'
        );

        await FileSystem.writeAsStringAsync(fileUri, capturedBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await securityAdminAPI.recordDownload(location.id, fileName);
        showToast(`QR saved as ${fileName}`);
        onDownload();
      } else {
        const fallbackUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fallbackUri, capturedBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await securityAdminAPI.recordDownload(location.id, fileName);
        showToast(`QR saved as ${fileName}`);
        onDownload();
      }
    } catch (error) {
      console.log('QR download error:', error);
      Alert.alert(
        'Download Failed',
        error?.message || 'Unable to save the QR right now.'
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleQRScanned = async (data) => {
    if (isScanning) return;

    try {
      setIsScanning(true);
      setShowScanner(false);

      const parsedQR = JSON.parse(data);

      // Route to correct endpoint based on user role
      if (user.role === 'security') {
        // Guard scanning a location QR to log entry/exit
        const response = await securityAPI.logEntry({
          action: 'entry', // Or could be determined from context
          location: parsedQR.location || parsedQR.locationName,
          locationId: parsedQR.locationId,
          guardName:
            parsedQR.guardName || parsedQR.generatedByName || user?.name,
          guardId: parsedQR.guardId || parsedQR.generatedById || user?.guardId,
          latitude: currentLocation?.latitude,
          longitude: currentLocation?.longitude,
          timestamp: currentLocation?.timestamp,
        });

        showToast(response?.data?.message || 'Location logged successfully');
      } else if (user.role === 'student') {
        // Student scanning a location QR for entry/exit
        const response = await securityAPI.logStudentScan({
          action: 'entry',
          location: parsedQR.location || parsedQR.locationName,
          locationId: parsedQR.locationId,
          guardName:
            parsedQR.guardName || parsedQR.generatedByName || undefined,
          guardId: parsedQR.guardId || parsedQR.generatedById || undefined,
          latitude: currentLocation?.latitude,
          longitude: currentLocation?.longitude,
          timestamp: currentLocation?.timestamp,
        });

        showToast(response?.data?.message || 'Entry/exit logged successfully');
      } else {
        Alert.alert(
          'Permission Denied',
          'Your role cannot perform this action'
        );
      }

      setShowScanner(false);
      onClose();
    } catch (error) {
      console.log('QR scan error:', error);

      const code = error?.response?.data?.code;
      const message = error?.response?.data?.message;

      if (code === 'LOCATION_OUT_OF_RANGE') {
        Alert.alert(
          'Out of Range',
          'You are trying to access this QR from a remote location. Please move closer to the location.'
        );
      } else {
        Alert.alert(
          'Scan Failed',
          message || 'Unable to process QR code. Please try again.'
        );
      }

      setShowScanner(true);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.expandedModalContent,
            { backgroundColor: colors.cardElevated },
          ]}
        >
          <View
            style={[
              styles.expandedModalHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.expandedModalTitle, { color: colors.heading }]}
                numberOfLines={1}
              >
                {location?.name}
              </Text>

              <Text
                style={[
                  styles.expandedModalSubtitle,
                  { color: colors.subText },
                ]}
              >
                {location?.type || 'LOCATION'}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => onEdit?.(location)}
                style={[
                  styles.iconButton,
                  { backgroundColor: colors.primarySoft },
                ]}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={16} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={[styles.iconButton, { backgroundColor: colors.surface }]}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {!showScanner ? (
            <ScrollView
              contentContainerStyle={styles.expandedModalBody}
              showsVerticalScrollIndicator={false}
            >
              <View
                ref={qrRef}
                collapsable={false}
                style={[
                  styles.expandedQrPreviewContainer,
                  { backgroundColor: COLORS.white },
                ]}
              >
                <QRCode
                  value={qrPayload}
                  size={240}
                  color={COLORS.gray[800]}
                  backgroundColor={COLORS.white}
                  quietZone={8}
                />
                <Text
                  style={[
                    styles.expandedQrLabel,
                    { color: COLORS.gray[800], marginTop: 12 },
                  ]}
                >
                  {location?.name}
                </Text>
              </View>

              {location?.description && (
                <View style={styles.expandedDescriptionBox}>
                  <Text
                    style={[
                      styles.expandedDescLabel,
                      { color: colors.subText },
                    ]}
                  >
                    Description
                  </Text>
                  <Text
                    style={[styles.expandedDescValue, { color: colors.text }]}
                  >
                    {location.description}
                  </Text>
                </View>
              )}

              {location?.latitude && location?.longitude && (
                <View style={styles.expandedCoordsBox}>
                  <Text
                    style={[
                      styles.expandedCoordLabel,
                      { color: colors.subText },
                    ]}
                  >
                    Coordinates
                  </Text>
                  <Text
                    style={[styles.expandedCoordValue, { color: colors.text }]}
                  >
                    {location.latitude}, {location.longitude}
                  </Text>
                </View>
              )}

              <View style={styles.expandedStatsBox}>
                <View style={styles.expandedStatItem}>
                  <Ionicons
                    name="qr-code-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.expandedStatLabel,
                      { color: colors.subText },
                    ]}
                  >
                    Generated
                  </Text>
                  <Text
                    style={[
                      styles.expandedStatValue,
                      { color: colors.heading },
                    ]}
                  >
                    {location.qrGenerationCount || 0}
                  </Text>
                </View>
                <View
                  style={[
                    styles.expandedStatDivider,
                    { backgroundColor: colors.border },
                  ]}
                />
                <View style={styles.expandedStatItem}>
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color={colors.success}
                  />
                  <Text
                    style={[
                      styles.expandedStatLabel,
                      { color: colors.subText },
                    ]}
                  >
                    Downloaded
                  </Text>
                  <Text
                    style={[
                      styles.expandedStatValue,
                      { color: colors.heading },
                    ]}
                  >
                    {location.qrDownloadCount || 0}
                  </Text>
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.scannerContainer}>
              {permission?.granted ? (
                <CameraView
                  style={styles.camera}
                  onBarcodeScanned={({ data }) => handleQRScanned(data)}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                >
                  <View style={styles.scannerOverlay}>
                    <Text style={[styles.scannerHint, { color: COLORS.white }]}>
                      Point camera at QR code
                    </Text>
                  </View>
                </CameraView>
              ) : (
                <View style={styles.permissionContainer}>
                  <Ionicons
                    name="camera-outline"
                    size={48}
                    color={colors.subText}
                  />
                  <Text
                    style={[styles.permissionText, { color: colors.heading }]}
                  >
                    Camera permission required
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.permissionBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={requestPermission}
                  >
                    <Text
                      style={[
                        styles.permissionBtnText,
                        { color: colors.buttonTextOnPrimary },
                      ]}
                    >
                      Grant Permission
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <View style={styles.expandedModalFooter}>
            {showScanner ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.expandedModalBtn,
                    {
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setShowScanner(false)}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.text} />
                  <Text
                    style={[
                      styles.expandedModalBtnText,
                      { color: colors.text },
                    ]}
                  >
                    Back
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.expandedModalBtn,
                    {
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={onClose}
                >
                  <Text
                    style={[
                      styles.expandedModalBtnText,
                      { color: colors.text },
                    ]}
                  >
                    Close
                  </Text>
                </TouchableOpacity>

                {(user.role === 'student' || user.role === 'security') && (
                  <TouchableOpacity
                    style={[
                      styles.expandedModalBtn,
                      {
                        backgroundColor: colors.success,
                        opacity: isScanning ? 0.7 : 1,
                      },
                    ]}
                    onPress={() => setShowScanner(true)}
                    disabled={isScanning}
                  >
                    <Ionicons
                      name="camera"
                      size={16}
                      color={colors.buttonTextOnPrimary}
                    />
                    <Text
                      style={[
                        styles.expandedModalBtnText,
                        { color: colors.buttonTextOnPrimary },
                      ]}
                    >
                      Scan
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.expandedModalBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: downloading ? 0.7 : 1,
                    },
                  ]}
                  onPress={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.buttonTextOnPrimary}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="download-outline"
                        size={16}
                        color={colors.buttonTextOnPrimary}
                      />
                      <Text
                        style={[
                          styles.expandedModalBtnText,
                          { color: colors.buttonTextOnPrimary },
                        ]}
                      >
                        Download
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Main Security Admin Screen
 */
export default function SecurityAdminScreen({ navigation, route }) {
  const { isDarkMode, colors } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [locations, setLocations] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showExpandedModal, setShowExpandedModal] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const filteredLocations = useMemo(
    () =>
      locations.filter(
        (loc) =>
          loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loc.type.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [locations, searchQuery]
  );

  // Calculate column width for 4-column grid
  const columnWidth = (width - SPACING.md * 2 - SPACING.md * 3) / 4;

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }

      const [locationsRes, statsRes] = await Promise.all([
        securityAdminAPI.getLocations(),
        securityAdminAPI.getQRStatistics(),
      ]);

      setLocations(locationsRes.data?.data?.locations || []);
      setStatistics(statsRes.data?.data || null);
    } catch (error) {
      console.log('Load data error:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load data'
      );
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
  };

  const handleQRCardPress = (location) => {
    setSelectedLocation(location);
    setShowExpandedModal(true);
  };

  const handleDownloadAllQRs = async () => {
    if (filteredLocations.length === 0) {
      Alert.alert('No QRs', 'There are no QRs to download.');
      return;
    }

    Alert.alert(
      'Download All QRs',
      `Download ${filteredLocations.length} QR codes?`,
      [
        { text: 'Cancel' },
        {
          text: 'Download All',
          onPress: async () => {
            try {
              setDownloadingAll(true);

              for (const location of filteredLocations) {
                const qrValue = buildGuardQRPayload(
                  undefined,
                  undefined,
                  location.name
                );

                // Create a ref for each QR code
                const qrRefs = new Map();
                if (!qrRefs.has(location.id)) {
                  qrRefs.set(location.id, React.createRef());
                }

                // For now, just show a toast that bulk download started
                // In a full implementation, you'd create individual QR refs and capture them
              }

              showToast(`Downloaded ${filteredLocations.length} QR codes`);
              loadData();
            } catch (error) {
              console.log('Bulk download error:', error);
              Alert.alert('Error', 'Failed to download QRs');
            } finally {
              setDownloadingAll(false);
            }
          },
        },
      ]
    );
  };

  const handleDownloadQRCompleted = () => {
    setShowExpandedModal(false);
    loadData();
  };

  const handleEditLocation = (location) => {
    // Navigate to edit screen or show modal
    Alert.alert('Edit Location', `Edit: ${location.name}`, [
      { text: 'Cancel' },
      {
        text: 'Edit',
        onPress: () => {
          // Navigate to edit screen
          navigation.navigate('EditLocation', { location });
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, borderBottomWidth: 1 },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.heading }]}>
            Security Admin
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.subText }]}>
            Manage location QRs
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleDownloadAllQRs}
          disabled={downloadingAll || filteredLocations.length === 0}
          style={styles.downloadAllBtn}
        >
          {downloadingAll ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons
                name="download"
                size={18}
                color={
                  filteredLocations.length === 0
                    ? colors.subText
                    : colors.primary
                }
              />
              <Text
                style={[
                  styles.downloadAllBtnText,
                  {
                    color:
                      filteredLocations.length === 0
                        ? colors.subText
                        : colors.primary,
                  },
                ]}
              >
                All
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRefreshing(true)}
          style={styles.refreshBtn}
        >
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Statistics Bar */}
      {statistics && (
        <View style={[styles.statsBar, { backgroundColor: colors.cardMuted }]}>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.heading }]}>
              {statistics.summary?.totalLocations || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>
              Locations
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.heading }]}>
              {statistics.summary?.totalGenerations || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>
              QRs Generated
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.heading }]}>
              {statistics.summary?.totalDownloads || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>
              Downloaded
            </Text>
          </View>
        </View>
      )}

      {/* Search */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.cardMuted,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.subText} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search locations..."
            placeholderTextColor={colors.subText}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* QR Grid */}
      {filteredLocations.length > 0 ? (
        <FlatList
          data={filteredLocations}
          numColumns={4}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridContainer}
          scrollEnabled={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <View style={{ width: columnWidth, padding: SPACING.sm / 2 }}>
              <QRCard
                location={item}
                colors={colors}
                onPress={handleQRCardPress}
              />
            </View>
          )}
        />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.emptyStateContainer}
        >
          <View
            style={[styles.emptyState, { backgroundColor: colors.cardMuted }]}
          >
            <Ionicons name="qr-code-outline" size={48} color={colors.subText} />
            <Text style={[styles.emptyStateTitle, { color: colors.heading }]}>
              No locations found
            </Text>
            <Text
              style={[styles.emptyStateSubtitle, { color: colors.subText }]}
            >
              {searchQuery
                ? 'Try adjusting your search'
                : 'No QR codes available'}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* QR Expanded Modal */}
      {selectedLocation && (
        <QRExpandedModal
          visible={showExpandedModal}
          location={selectedLocation}
          colors={colors}
          onDownload={handleDownloadQRCompleted}
          onClose={() => setShowExpandedModal(false)}
          onEdit={() => handleEditLocation(selectedLocation)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  downloadAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  downloadAllBtnText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: SPACING.md,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FONTS.regular,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  searchContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  gridContainer: {
    paddingHorizontal: SPACING.md / 2,
    paddingVertical: SPACING.md / 2,
  },
  qrCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  qrCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  qrCardInfo: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    gap: 2,
  },
  qrCardName: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    lineHeight: 13,
  },
  qrCardType: {
    fontSize: 9,
    fontFamily: FONTS.regular,
  },
  expandedModalContent: {
    width: '90%',
    maxWidth: 450,
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  expandedModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  expandedModalTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    marginBottom: 2,
  },
  expandedModalSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  expandedModalBody: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  expandedQrPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: 12,
  },
  expandedQrLabel: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: 'center',
  },
  expandedDescriptionBox: {
    gap: 6,
  },
  expandedDescLabel: {
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  expandedDescValue: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  expandedCoordsBox: {
    gap: 6,
  },
  expandedCoordLabel: {
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  expandedCoordValue: {
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  expandedStatsBox: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.md,
    backgroundColor: COLORS.gray[50],
  },
  expandedStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  expandedStatLabel: {
    fontSize: 11,
    fontFamily: FONTS.regular,
  },
  expandedStatValue: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  expandedStatDivider: {
    width: 1,
    height: 40,
  },
  expandedModalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
  },
  expandedModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: 6,
  },
  expandedModalBtnText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  emptyState: {
    borderRadius: 12,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: SPACING.lg,
  },
  scannerHint: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    backgroundColor: COLORS.black + '80',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  permissionText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    marginTop: SPACING.md,
  },
  permissionBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.md,
  },
  permissionBtnText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
});
