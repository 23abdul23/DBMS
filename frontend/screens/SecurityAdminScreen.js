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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import { captureRef } from 'react-native-view-shot';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { securityAdminAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { FONTS, SIZES, SPACING, COLORS } from '../utils/constants';
import {
  CONTENT_MAX_WIDTH,
  getTwoColumnCardWidth,
} from '../utils/responsiveLayout';
import { showToast } from '../utils/toast';

const sanitizeFilePart = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const formatDateStamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
};

/**
 * Location Card Component
 */
function LocationCard({ location, colors, onPress, onEdit, onDelete }) {
  return (
    <TouchableOpacity
      style={[
        styles.locationCard,
        {
          backgroundColor: location.isActive
            ? colors.cardElevated
            : colors.cardMuted,
          borderColor: colors.border,
          opacity: location.isActive ? 1 : 0.6,
        },
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.locationCardHeader,
          { borderBottomColor: colors.border },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.locationName, { color: colors.heading }]}
            numberOfLines={1}
          >
            {location.name}
          </Text>
          <Text style={[styles.locationType, { color: colors.subText }]}>
            {location.type || 'OTHER'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => onEdit(location)}
            style={[styles.actionBtn, { backgroundColor: colors.primarySoft }]}
          >
            <Ionicons name="pencil" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(location)}
            style={[
              styles.actionBtn,
              { backgroundColor: colors.danger + '20' },
            ]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.locationStats}>
        <View style={styles.statItem}>
          <Ionicons name="qr-code-outline" size={16} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.heading }]}>
            {location.qrGenerationCount || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.subText }]}>
            Generated
          </Text>
        </View>
        <View
          style={[styles.statDivider, { backgroundColor: colors.border }]}
        />
        <View style={styles.statItem}>
          <Ionicons name="download-outline" size={16} color={colors.success} />
          <Text style={[styles.statValue, { color: colors.heading }]}>
            {location.qrDownloadCount || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.subText }]}>
            Downloaded
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.generateBtn, { backgroundColor: colors.primary }]}
        onPress={() => onPress(location)}
      >
        <Ionicons
          name="qr-code-outline"
          size={16}
          color={colors.buttonTextOnPrimary}
        />
        <Text
          style={[
            styles.generateBtnText,
            { color: colors.buttonTextOnPrimary },
          ]}
        >
          Generate QR
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/**
 * QR Preview Modal Component
 */
function QRPreviewModal({
  visible,
  location,
  qrPayload,
  colors,
  onDownload,
  onClose,
}) {
  const qrRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const capturedUri = await captureRef(qrRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const fileDate = formatDateStamp();
      const fileName = `aegis-location-qr-${sanitizeFilePart(
        location.name
      )}-${fileDate}.png`;

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

        // Record download via API
        await securityAdminAPI.recordDownload(location.id, fileName);
        onDownload();
      } else {
        const fallbackUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fallbackUri, capturedBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await securityAdminAPI.recordDownload(location.id, fileName);
        onDownload();
      }

      showToast(`QR saved as ${fileName}`);
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
            styles.modalContent,
            { backgroundColor: colors.cardElevated },
          ]}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.modalTitle, { color: colors.heading }]}>
              {location?.name}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            <View
              ref={qrRef}
              collapsable={false}
              style={[
                styles.qrPreviewContainer,
                { backgroundColor: COLORS.white },
              ]}
            >
              <QRCode
                value={qrPayload}
                size={220}
                color={COLORS.gray[800]}
                backgroundColor={COLORS.white}
                quietZone={8}
              />
              <Text
                style={[
                  styles.qrLabel,
                  { color: COLORS.gray[800], marginTop: 12 },
                ]}
              >
                {location?.name}
              </Text>
            </View>

            {location?.description && (
              <View style={styles.descriptionBox}>
                <Text style={[styles.descLabel, { color: colors.subText }]}>
                  Description
                </Text>
                <Text style={[styles.descValue, { color: colors.text }]}>
                  {location.description}
                </Text>
              </View>
            )}

            {location?.latitude && location?.longitude && (
              <View style={styles.coordsBox}>
                <Text style={[styles.coordLabel, { color: colors.subText }]}>
                  Coordinates
                </Text>
                <Text style={[styles.coordValue, { color: colors.text }]}>
                  {location.latitude.toFixed(6)},{' '}
                  {location.longitude.toFixed(6)}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.modalBtn,
                {
                  backgroundColor: colors.cardMuted,
                  borderColor: colors.border,
                },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.modalBtnText, { color: colors.text }]}>
                Close
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalBtn,
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
                      styles.modalBtnText,
                      { color: colors.buttonTextOnPrimary },
                    ]}
                  >
                    Download QR
                  </Text>
                </>
              )}
            </TouchableOpacity>
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
  const [activeTab, setActiveTab] = useState('locations'); // locations, qr-download, history
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [downloadedQRCount, setDownloadedQRCount] = useState(0);

  const filteredLocations = useMemo(
    () =>
      locations.filter(
        (loc) =>
          loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loc.type.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [locations, searchQuery]
  );

  useEffect(() => {
    loadData();
  }, []);

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

  const handleGenerateQR = (location) => {
    setSelectedLocation(location);
    setShowQRModal(true);
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

  const handleDeleteLocation = (location) => {
    Alert.alert('Archive Location', `Archive "${location.name}"?`, [
      { text: 'Cancel' },
      {
        text: 'Archive',
        onPress: async () => {
          try {
            await securityAdminAPI.deleteLocation(location.id);
            showToast(`${location.name} archived`);
            loadData();
          } catch (error) {
            Alert.alert(
              'Error',
              error?.response?.data?.message || 'Failed to archive'
            );
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleDownloadQRCompleted = () => {
    setDownloadedQRCount((prev) => prev + 1);
    setShowQRModal(false);
    loadData();
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
            Manage locations & QR codes
          </Text>
        </View>
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
              QR Generated
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

      {/* Tabs */}
      <View
        style={[
          styles.tabBar,
          { borderBottomColor: colors.border, borderBottomWidth: 1 },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'locations' && {
              borderBottomColor: colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab('locations')}
        >
          <Ionicons
            name="location"
            size={18}
            color={activeTab === 'locations' ? colors.primary : colors.subText}
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'locations' ? colors.primary : colors.subText,
              },
            ]}
          >
            Locations
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'qr-download' && {
              borderBottomColor: colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab('qr-download')}
        >
          <Ionicons
            name="qr-code"
            size={18}
            color={
              activeTab === 'qr-download' ? colors.primary : colors.subText
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'qr-download' ? colors.primary : colors.subText,
              },
            ]}
          >
            QR Download
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'history' && {
              borderBottomColor: colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons
            name="time"
            size={18}
            color={activeTab === 'history' ? colors.primary : colors.subText}
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'history' ? colors.primary : colors.subText,
              },
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'locations' && (
          <>
            {/* Search */}
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

            {/* Locations Grid */}
            <View style={styles.locationsGrid}>
              {filteredLocations.map((location) => (
                <LocationCard
                  key={location.id}
                  location={location}
                  colors={colors}
                  onPress={handleGenerateQR}
                  onEdit={handleEditLocation}
                  onDelete={handleDeleteLocation}
                />
              ))}
            </View>

            {filteredLocations.length === 0 && (
              <View
                style={[
                  styles.emptyState,
                  { backgroundColor: colors.cardMuted },
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={48}
                  color={colors.subText}
                />
                <Text
                  style={[styles.emptyStateTitle, { color: colors.heading }]}
                >
                  No locations found
                </Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'qr-download' && (
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: colors.heading }]}>
              Download Location QRs
            </Text>
            {/* Use LocationQRDownloadScreen integration */}
            <Text style={[styles.sectionSubtitle, { color: colors.subText }]}>
              Downloaded {downloadedQRCount} QR codes
            </Text>
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: colors.heading }]}>
              QR Generation & Download History
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.subText }]}>
              View detailed history of QR operations
            </Text>
          </View>
        )}
      </ScrollView>

      {/* QR Preview Modal */}
      {selectedLocation && (
        <QRPreviewModal
          visible={showQRModal}
          location={selectedLocation}
          qrPayload={JSON.stringify({
            qrId: `QR-${selectedLocation.id}`,
            locationId: selectedLocation.id,
            locationName: selectedLocation.name,
            locationType: selectedLocation.type,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            qrType: 'location',
            issuedAt: new Date().toISOString(),
          })}
          colors={colors}
          onDownload={handleDownloadQRCompleted}
          onClose={() => setShowQRModal(false)}
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
    gap: SPACING.md,
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
  },
  tabText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.lg,
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
  locationsGrid: {
    gap: SPACING.md,
  },
  locationCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  locationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  locationName: {
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  locationType: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    marginTop: 2,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationStats: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    gap: 6,
  },
  generateBtnText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  emptyState: {
    borderRadius: 12,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginTop: SPACING.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  modalBody: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  qrPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: 12,
  },
  qrLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: 'center',
  },
  descriptionBox: {
    gap: 4,
  },
  descLabel: {
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  descValue: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    lineHeight: 18,
  },
  coordsBox: {
    gap: 4,
  },
  coordLabel: {
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  coordValue: {
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalBtnText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  tabContent: {
    gap: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
});
