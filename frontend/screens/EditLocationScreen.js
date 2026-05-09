'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { useAppLocation } from '../context/LocationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { securityAdminAPI } from '../services/api';

const LOCATION_TYPES = [
  { label: 'Campus Building', value: 'CAMPUS_BUILDING' },
  { label: 'Hostel', value: 'HOSTEL' },
  { label: 'Exit Gate', value: 'EXIT_GATE' },
  { label: 'Fixed Location', value: 'FIXED_LOCATION' },
  { label: 'Security Point', value: 'SECURITY_POINT' },
  { label: 'Other', value: 'OTHER' },
];

const DEFAULT_COORDS = {
  latitude: 25.4307,
  longitude: 81.7688,
};

const normalizeField = (value) => String(value ?? '').trim();

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getCoordinatesFromLocation = (value) => {
  const latitude = toFiniteNumber(value?.latitude);
  const longitude = toFiniteNumber(value?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
};

const buildMapHtml = (latitude, longitude) => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #0f172a;
      }
      .leaflet-control-attribution,
      .leaflet-control-zoom {
        display: none !important;
      }
      .crosshair {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 34px;
        height: 34px;
        margin-left: -17px;
        margin-top: -34px;
        pointer-events: none;
        z-index: 999;
        filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.35));
      }
      .crosshair::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50% 50% 50% 0;
        background: #ef4444;
        transform: rotate(-45deg);
      }
      .crosshair::after {
        content: '';
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: white;
        top: 8px;
        left: 8px;
      }
      .hint {
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: 14px;
        z-index: 999;
        padding: 10px 12px;
        border-radius: 12px;
        color: #e2e8f0;
        background: rgba(15, 23, 42, 0.78);
        backdrop-filter: blur(12px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        line-height: 16px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div class="crosshair"></div>
    <div class="hint">Tap the map or drag the pin to the exact QR location, then save.</div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script>
      (function () {
        var initial = [${latitude}, ${longitude}];
        var map = L.map('map', { zoomControl: false }).setView(initial, 18);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 22,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        var marker = L.marker(initial, { draggable: true }).addTo(map);

        function sendCoords(latlng) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'coords',
              latitude: latlng.lat,
              longitude: latlng.lng,
            }));
          }
        }

        marker.on('dragend', function (event) {
          sendCoords(event.target.getLatLng());
        });

        map.on('click', function (event) {
          marker.setLatLng(event.latlng);
          sendCoords(event.latlng);
        });

        setTimeout(function () {
          sendCoords(marker.getLatLng());
        }, 250);
      })();
    </script>
  </body>
</html>`;

export default function EditLocationScreen({ navigation, route }) {
  const { colors, isDarkMode } = useTheme();
  const { location: deviceLocation, refreshLocation } = useAppLocation();
  const location = route?.params?.location || null;

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('OTHER');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const initialCoords = useMemo(() => {
    return (
      getCoordinatesFromLocation(location) ||
      getCoordinatesFromLocation(deviceLocation) ||
      DEFAULT_COORDS
    );
  }, [location, deviceLocation]);

  useEffect(() => {
    if (!location) {
      return;
    }

    setName(location.name || '');
    setType(location.type || 'OTHER');
    setCode(location.code || '');
    setDescription(location.description || '');
    setIsActive(Boolean(location.isActive));

    const existingCoords = getCoordinatesFromLocation(location);
    setSelectedCoords(existingCoords || initialCoords);
  }, [location, initialCoords]);

  const openMapPicker = useCallback(async () => {
    try {
      setMapLoading(true);

      let nextCoords = selectedCoords || initialCoords;

      const latestDeviceLocation =
        deviceLocation || (await refreshLocation?.());
      const deviceCoords = getCoordinatesFromLocation(latestDeviceLocation);

      if (deviceCoords) {
        nextCoords = deviceCoords;
      }

      setSelectedCoords(nextCoords);
      setMapReady(false);
      setMapVisible(true);
    } catch (error) {
      Alert.alert(
        'Location Error',
        error?.message || 'Could not get the current location.'
      );
    } finally {
      setMapLoading(false);
    }
  }, [deviceLocation, initialCoords, refreshLocation, selectedCoords]);

  const handleMapMessage = useCallback((event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);

      if (payload?.type === 'coords') {
        const latitude = Number(payload.latitude);
        const longitude = Number(payload.longitude);

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setSelectedCoords({ latitude, longitude });
        }
      }
    } catch (error) {
      console.log('Map message parse error:', error);
    }
  }, []);

  const handleConfirmCoords = useCallback(() => {
    if (!selectedCoords) {
      Alert.alert('Pick a point', 'Tap the map or drag the pin first.');
      return;
    }

    setMapVisible(false);
  }, [selectedCoords]);

  const handleSave = async () => {
    const trimmedName = normalizeField(name);
    const trimmedCode = normalizeField(code);
    const trimmedDescription = normalizeField(description);

    if (!trimmedName || !trimmedCode) {
      Alert.alert('Validation Error', 'Name and code are required.');
      return;
    }

    if (!selectedCoords) {
      Alert.alert(
        'Validation Error',
        'Please choose the final location on the map.'
      );
      return;
    }

    if (!location?.id) {
      Alert.alert('Error', 'Missing location details.');
      return;
    }

    try {
      setSaving(true);
      await securityAdminAPI.updateLocation(location.id, {
        name: trimmedName,
        type,
        code: trimmedCode,
        description: trimmedDescription,
        latitude: String(selectedCoords.latitude),
        longitude: String(selectedCoords.longitude),
        isActive,
      });

      Alert.alert('Saved', 'Location updated successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Update Failed',
        error?.response?.data?.message || 'Could not update location.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (saving && !location) {
    return <LoadingSpinner />;
  }

  const mapHtml = buildMapHtml(
    selectedCoords?.latitude ?? initialCoords.latitude,
    selectedCoords?.longitude ?? initialCoords.longitude
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.heading }]}>
            Edit Location
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.subText }]}
            numberOfLines={1}
          >
            {location?.name || 'Location details'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>
            Location Details
          </Text>

          <Text style={[styles.label, { color: colors.subText }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Location name"
            placeholderTextColor={colors.placeholder}
            style={[
              styles.input,
              {
                color: colors.inputText,
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.subText }]}>Code</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Location code"
            placeholderTextColor={colors.placeholder}
            style={[
              styles.input,
              {
                color: colors.inputText,
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.subText }]}>Type</Text>
          <View
            style={[
              styles.pickerWrap,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
          >
            <Picker
              selectedValue={type}
              onValueChange={setType}
              dropdownIconColor={colors.subText}
            >
              {LOCATION_TYPES.map((option) => (
                <Picker.Item
                  key={option.value}
                  label={option.label}
                  value={option.value}
                />
              ))}
            </Picker>
          </View>

          <Text style={[styles.label, { color: colors.subText }]}>
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            placeholderTextColor={colors.placeholder}
            multiline
            style={[
              styles.textArea,
              {
                color: colors.inputText,
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.subText }]}>
            QR Location Pin
          </Text>
          <View style={[styles.coordsCard, { borderColor: colors.border }]}>
            <View style={styles.coordsRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.coordsLabel, { color: colors.textMuted }]}>
                  Latitude
                </Text>
                <Text style={[styles.coordsValue, { color: colors.heading }]}>
                  {selectedCoords?.latitude?.toFixed(6) ?? 'Select on map'}
                </Text>
              </View>
              <View style={styles.coordsDivider} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.coordsLabel, { color: colors.textMuted }]}>
                  Longitude
                </Text>
                <Text style={[styles.coordsValue, { color: colors.heading }]}>
                  {selectedCoords?.longitude?.toFixed(6) ?? 'Select on map'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={openMapPicker}
              style={[styles.mapBtn, { backgroundColor: colors.primarySoft }]}
            >
              <Ionicons name="map-outline" size={18} color={colors.primary} />
              <Text style={[styles.mapBtnText, { color: colors.primary }]}>
                Open Map
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.switchRow, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.subText }]}>
                Active
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Inactive locations stay archived but remain editable.
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={isActive ? colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 },
          ]}
        >
          <Text
            style={[styles.saveText, { color: colors.buttonTextOnPrimary }]}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={mapVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapVisible(false)}
      >
        <SafeAreaView
          style={[styles.mapScreen, { backgroundColor: colors.background }]}
        >
          <View
            style={[styles.mapHeader, { borderBottomColor: colors.border }]}
          >
            <TouchableOpacity
              onPress={() => setMapVisible(false)}
              style={styles.backBtn}
            >
              <Ionicons name="close" size={24} color={colors.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mapTitle, { color: colors.heading }]}>
                Choose QR Location
              </Text>
              <Text style={[styles.mapSubtitle, { color: colors.subText }]}>
                Use your current location as a start point, then tap or drag the
                pin.
              </Text>
            </View>
          </View>

          <View style={styles.mapMetaRow}>
            <View
              style={[styles.metaChip, { backgroundColor: colors.cardMuted }]}
            >
              <Ionicons
                name="locate-outline"
                size={16}
                color={colors.primary}
              />
              <Text style={[styles.metaChipText, { color: colors.heading }]}>
                {selectedCoords
                  ? `${selectedCoords.latitude.toFixed(
                      4
                    )}, ${selectedCoords.longitude.toFixed(4)}`
                  : 'Position unknown'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                setMapLoading(true);
                try {
                  const latest =
                    deviceLocation ||
                    (await Location.getCurrentPositionAsync({
                      accuracy: Location.Accuracy.High,
                    }));
                  const latestCoords = getCoordinatesFromLocation(
                    latest?.coords
                      ? {
                          latitude: latest.coords.latitude,
                          longitude: latest.coords.longitude,
                        }
                      : latest
                  );

                  if (latestCoords) {
                    setSelectedCoords(latestCoords);
                  }
                } catch (error) {
                  Alert.alert(
                    'Location Error',
                    error?.message || 'Could not refresh current location.'
                  );
                } finally {
                  setMapLoading(false);
                }
              }}
              style={[styles.refreshBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={[styles.refreshBtnText, { color: colors.primary }]}>
                Current
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mapContainer}>
            {mapLoading ? (
              <View style={styles.mapLoadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.mapLoadingText, { color: colors.text }]}>
                  Loading map...
                </Text>
              </View>
            ) : null}
            <WebView
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              onMessage={handleMapMessage}
              onLoadEnd={() => setMapReady(true)}
              javaScriptEnabled
              domStorageEnabled
              style={styles.webView}
            />
            {!mapReady ? (
              <View
                style={[
                  styles.mapLoadingOverlay,
                  { backgroundColor: 'transparent' },
                ]}
              >
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : null}
          </View>

          <View style={[styles.mapFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setMapVisible(false)}
              style={[styles.footerBtn, { backgroundColor: colors.cardMuted }]}
            >
              <Text style={[styles.footerBtnText, { color: colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirmCoords}
              style={[styles.footerBtn, { backgroundColor: colors.primary }]}
            >
              <Text
                style={[
                  styles.footerBtnText,
                  { color: colors.buttonTextOnPrimary },
                ]}
              >
                Use Pin
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  content: { padding: 18, paddingBottom: 28 },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coordsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 2,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordsDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 12,
  },
  coordsLabel: { fontSize: 12, marginBottom: 4 },
  coordsValue: { fontSize: 15, fontWeight: '700' },
  mapBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  mapBtnText: { fontSize: 14, fontWeight: '700' },
  switchRow: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveBtn: {
    marginTop: 18,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: { fontSize: 16, fontWeight: '700' },
  mapScreen: { flex: 1 },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mapTitle: { fontSize: 20, fontWeight: '700' },
  mapSubtitle: { fontSize: 12, marginTop: 2 },
  mapMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 12,
  },
  metaChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  metaChipText: { fontSize: 12, fontWeight: '700' },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshBtnText: { fontSize: 12, fontWeight: '700' },
  mapContainer: {
    flex: 1,
    marginTop: 14,
    marginHorizontal: 18,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  webView: { flex: 1, backgroundColor: '#0f172a' },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    zIndex: 2,
  },
  mapLoadingText: { marginTop: 10, fontSize: 13, fontWeight: '600' },
  mapFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  footerBtnText: { fontSize: 15, fontWeight: '700' },
});
