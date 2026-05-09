'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import { captureRef } from 'react-native-view-shot';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AllLocations from '../constants/SecuityLocations.json';
import { COLORS, FONTS, SIZES, SPACING } from '../utils/constants';
import LoadingSpinner from '../components/LoadingSpinner';

// Utility functions
const sanitizeFilePart = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const formatDateStamp = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
};

// Prepare all locations
const getAllLocations = () => {
  return [
    {
      category: 'Exit Gates',
      icon: 'exit-outline',
      locations: AllLocations.exit_gates || [],
    },
    {
      category: 'Campus Buildings',
      icon: 'business-outline',
      locations: AllLocations.campus_buildings || [],
    },
    {
      category: 'Hostels',
      icon: 'bed-outline',
      locations: AllLocations.hostels || [],
    },
  ].filter((section) => section.locations.length > 0);
};

// QR Code Card Component
function QRCodeCard({ location, qrSize, colors, onDownload }) {
  const qrRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const qrPayload = JSON.stringify({
    location,
    scanType: 'location',
  });

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const capturedUri = await captureRef(qrRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const fileDate = formatDateStamp(new Date());
      const fileName = `aegis-location-qr-${sanitizeFilePart(
        location
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
          setDownloading(false);
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

        onDownload({ location, fileName, success: true });
      } else {
        const fallbackUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fallbackUri, capturedBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        onDownload({ location, fileName, success: true });
      }
    } catch (error) {
      console.log('QR download error:', error);
      onDownload({ location, fileName: '', success: false, error });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View
      style={[
        styles.qrCard,
        {
          backgroundColor: colors.cardElevated,
          borderColor: colors.border,
          borderWidth: 1,
        },
      ]}
    >
      <View
        style={[
          styles.qrCardHeader,
          { borderBottomColor: colors.border, borderBottomWidth: 1 },
        ]}
      >
        <Text
          style={[styles.qrCardTitle, { color: colors.heading }]}
          numberOfLines={1}
        >
          {location}
        </Text>
      </View>

      <View style={styles.qrContainer}>
        <View
          ref={qrRef}
          collapsable={false}
          style={[styles.qrInner, { backgroundColor: COLORS.white }]}
        >
          <QRCode
            value={qrPayload}
            size={qrSize}
            color={COLORS.gray[800]}
            backgroundColor={COLORS.white}
            quietZone={8}
          />
          <Text style={[styles.qrLabel, { color: COLORS.gray[800] }]}>
            {location}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.downloadBtn,
          {
            backgroundColor: colors.primary,
            opacity: downloading ? 0.7 : 1,
          },
        ]}
        onPress={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <ActivityIndicator size="small" color={colors.buttonTextOnPrimary} />
        ) : (
          <>
            <Ionicons
              name="download-outline"
              size={16}
              color={colors.buttonTextOnPrimary}
            />
            <Text
              style={[
                styles.downloadBtnText,
                { color: colors.buttonTextOnPrimary },
              ]}
            >
              Download
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// Category Section Component
function CategorySection({ category, locations, qrSize, colors, onDownload }) {
  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <Ionicons
          name={category.icon}
          size={24}
          color={colors.primary}
          style={{ marginRight: 12 }}
        />
        <Text style={[styles.categoryTitle, { color: colors.heading }]}>
          {category.category}
        </Text>
        <View
          style={[
            styles.locationCount,
            { backgroundColor: colors.primarySoft },
          ]}
        >
          <Text style={[styles.countText, { color: colors.primary }]}>
            {locations.length}
          </Text>
        </View>
      </View>
      <View style={styles.qrGrid}>
        {locations.map((location) => (
          <QRCodeCard
            key={location}
            location={location}
            qrSize={qrSize}
            colors={colors}
            onDownload={onDownload}
          />
        ))}
      </View>
    </View>
  );
}

export default function LocationQRDownloadScreen({ navigation }) {
  const { isDarkMode, colors } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [downloadStats, setDownloadStats] = useState([]);

  const allLocationsData = getAllLocations();
  const totalLocations = allLocationsData.reduce(
    (sum, cat) => sum + cat.locations.length,
    0
  );
  const qrSize = width < 420 ? 140 : 160;

  useEffect(() => {
    loadScreenData();
  }, []);

  const loadScreenData = async () => {
    try {
      setLoading(true);
      // Any initial data loading can be done here
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.log('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setDownloadedCount(0);
    setFailedCount(0);
    setDownloadStats([]);
    await loadScreenData();
    setRefreshing(false);
  };

  const handleDownload = ({ location, fileName, success, error }) => {
    const newStat = { location, fileName, success, error };
    setDownloadStats((prev) => [...prev, newStat]);

    if (success) {
      setDownloadedCount((prev) => prev + 1);
      Alert.alert('✓ QR Downloaded', `${location} QR saved as:\n${fileName}`);
    } else {
      setFailedCount((prev) => prev + 1);
      Alert.alert(
        '✗ Download Failed',
        `Could not save ${location} QR.\n${error?.message || 'Unknown error'}`
      );
    }
  };

  const handleBatchDownload = async () => {
    if (downloadStats.length > 0) {
      const completed = downloadStats.filter((s) => s.success).length;
      Alert.alert(
        'Download Summary',
        `Downloaded: ${completed}/${downloadStats.length}\n\nAll location QR codes have been saved to your Downloads folder.`
      );
      return;
    }

    Alert.alert(
      'Batch Download',
      'Download all location QR codes. This may take a moment.\n\nUse individual download buttons to save each location QR code.',
      [{ text: 'OK' }]
    );
  };

  const handleResetStats = () => {
    Alert.alert('Reset Stats', 'Clear download statistics?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () => {
          setDownloadedCount(0);
          setFailedCount(0);
          setDownloadStats([]);
        },
        style: 'destructive',
      },
    ]);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, borderBottomWidth: 1 },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.heading }]}>
            Location QR Codes
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.subText }]}>
            Download QR codes for all campus locations
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleResetStats}
          style={styles.headerAction}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View
        style={[
          styles.statsBar,
          {
            backgroundColor: colors.cardMuted,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.statItem}>
          <View
            style={[styles.statIcon, { backgroundColor: colors.successSoft }]}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.success}
            />
          </View>
          <View>
            <Text style={[styles.statValue, { color: colors.heading }]}>
              {downloadedCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>
              Downloaded
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.statItem}>
          <View
            style={[styles.statIcon, { backgroundColor: colors.warningSoft }]}
          >
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
          </View>
          <View>
            <Text style={[styles.statValue, { color: colors.heading }]}>
              {totalLocations - downloadedCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subText }]}>
              Remaining
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          onPress={handleBatchDownload}
          style={[styles.batchBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons
            name="cloud-download-outline"
            size={16}
            color={colors.buttonTextOnPrimary}
          />
          <Text
            style={[styles.batchBtnText, { color: colors.buttonTextOnPrimary }]}
          >
            All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {allLocationsData.map((category) => (
          <CategorySection
            key={category.category}
            category={category}
            locations={category.locations}
            qrSize={qrSize}
            colors={colors}
            onDownload={handleDownload}
          />
        ))}

        {/* Footer Info */}
        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primary,
            },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.primary}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.primary }]}>
              Tip: Download all QR codes
            </Text>
            <Text style={[styles.infoText, { color: colors.text }]}>
              Use individual download buttons to save QR codes to your device.
              All files are saved to Downloads folder.
            </Text>
          </View>
        </View>

        {/* Total Stats */}
        <View
          style={[
            styles.totalStats,
            {
              backgroundColor: colors.cardElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name="qr-code-outline"
            size={28}
            color={colors.primary}
            style={{ marginBottom: 12 }}
          />
          <Text style={[styles.totalStatsTitle, { color: colors.heading }]}>
            Total Locations
          </Text>
          <Text style={[styles.totalStatsValue, { color: colors.primary }]}>
            {totalLocations}
          </Text>
          <Text style={[styles.totalStatsSubtext, { color: colors.subText }]}>
            {downloadedCount} downloaded
          </Text>
        </View>
      </ScrollView>
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
  backBtn: {
    padding: 8,
    marginHorizontal: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  headerAction: {
    padding: 8,
    marginHorizontal: -8,
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  batchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batchBtnText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    gap: SPACING.lg,
  },
  categorySection: {
    gap: SPACING.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  categoryTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    flex: 1,
  },
  locationCount: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  qrGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  qrCard: {
    width: '48%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  qrCardHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  qrCardTitle: {
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  qrContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrInner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: 12,
  },
  qrLabel: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: 6,
    borderRadius: 12,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  downloadBtnText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  infoBox: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: SPACING.md,
  },
  infoTitle: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    lineHeight: 18,
  },
  totalStats: {
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: SPACING.md,
  },
  totalStatsTitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  totalStatsValue: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    marginVertical: 4,
  },
  totalStatsSubtext: {
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
});
