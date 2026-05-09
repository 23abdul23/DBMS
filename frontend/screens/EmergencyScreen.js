'use client';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  AppState,
  Platform,
} from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';
import { useAppLocation } from '../context/LocationContext';
import { emergencyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  COLORS,
  FONTS,
  SIZES,
  SPACING,
  EMERGENCY_TYPES,
} from '../utils/constants';
import EmergencyButton from '../components/EmergencyButton';
import LocationCard from '../components/LocationCard';

export default function EmergencyScreen() {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { user } = useAuth();
  const { location, locationLoading, permissionStatus, refreshLocation } =
    useAppLocation();
  const appState = useRef(AppState.currentState);
  const pendingSmsRef = useRef(null);
  const normalizePhoneNumber = (value) =>
    String(value || '').replace(/[^\d+]/g, '');
  const getEmergencyPhone = (key, fallback) => {
    const configuredValue = Constants.expoConfig?.extra?.[key] || fallback;

    return {
      raw: normalizePhoneNumber(configuredValue),
      display: String(configuredValue),
    };
  };

  const callEmergencyno = async (phoneNo) => {
    try {
      const phone = `tel:${String(phoneNo).trim()}`;
      await Linking.openURL(phone);
    } catch (err) {
      console.log('Call Error:', err);
    }
  };

  const handleEmergencyContact = (details) => {
    const value = String(details || '').trim();

    // If already just a phone number
    if (/^\d+$/.test(value)) {
      return value;
    }

    // Extract phone after " - "
    if (value.includes(' - ')) {
      return value.split(' - ')[1].trim();
    }

    return value;
  };

  const emergencyTypes = useMemo(() => {
    const medicalPhone = getEmergencyPhone(
      'EMERGENCY_MEDICAL_PHONE',
      '9329594882'
    );
    const securityPhone = getEmergencyPhone(
      'EMERGENCY_SECURITY_PHONE',
      '7217492629'
    );
    const firePhone = getEmergencyPhone('EMERGENCY_FIRE_PHONE', '86182 75578');
    const otherPhone = getEmergencyPhone(
      'NULL',
      handleEmergencyContact(user.emergencyContact)
    );

    return [
      {
        type: EMERGENCY_TYPES.MEDICAL,
        title: 'Medical Emergency',
        icon: 'medical',
        color: COLORS.success,
        backgroundColor: COLORS.success + '20',
        phone: medicalPhone.raw,
        formattedPhone: medicalPhone.display,
        description: medicalPhone.display,
      },
      {
        type: EMERGENCY_TYPES.SECURITY,
        title: 'Security Emergency',
        icon: 'shield',
        color: COLORS.warning,
        backgroundColor: COLORS.warning + '20',
        phone: securityPhone.raw,
        formattedPhone: securityPhone.display,
        description: securityPhone.display,
      },
      {
        type: EMERGENCY_TYPES.FIRE,
        title: 'Fire Emergency',
        icon: 'flame',
        color: COLORS.error,
        backgroundColor: COLORS.error + '20',
        phone: firePhone.raw,
        formattedPhone: firePhone.display,
        description: firePhone.display,
      },
      {
        type: EMERGENCY_TYPES.OTHER,
        title: 'Other Emergency',
        icon: 'call',
        color: COLORS.primary,
        backgroundColor: COLORS.primary + '20',
        phone: otherPhone.raw,
        formattedPhone: otherPhone.display,
        description: `College: ${otherPhone.display}`,
      },
    ];
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasInBackground =
        appState.current === 'background' || appState.current === 'inactive';

      appState.current = nextAppState;

      if (
        wasInBackground &&
        nextAppState === 'active' &&
        pendingSmsRef.current
      ) {
        const pendingSms = pendingSmsRef.current;
        pendingSmsRef.current = null;
        openSmsComposer(pendingSms);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Auto-refresh location every 15 minutes
  useEffect(() => {
    // Initial fetch on screen mount
    refreshLocation();

    const locationInterval = setInterval(() => {
      refreshLocation();
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(locationInterval);
  }, []);

  // Refresh location whenever app comes to foreground
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        const wasInBackground =
          appState.current === 'background' || appState.current === 'inactive';

        appState.current = nextAppState;

        // Existing SMS resume logic
        if (
          wasInBackground &&
          nextAppState === 'active' &&
          pendingSmsRef.current
        ) {
          const pendingSms = pendingSmsRef.current;
          pendingSmsRef.current = null;
          openSmsComposer(pendingSms);
        }

        // NEW: Refresh location when app becomes active
        if (wasInBackground && nextAppState === 'active') {
          refreshLocation();
        }
      }
    );

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  const buildMapsLink = (currentLocation) => {
    if (!currentLocation) {
      return 'Location unavailable';
    }
    return `https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`;
  };

  const buildSmsBody = (emergency, currentLocation) => {
    return [
      `${emergency.title} reported by ${user?.name || 'a student'}.`,
      user?.studentId ? `Student ID: ${user.studentId}` : null,
      user?.hostel ? `Hostel: ${user.hostel}` : null,
      user?.roomNumber ? `Room: ${user.roomNumber}` : null,
      currentLocation
        ? `Current location: ${currentLocation.latitude}, ${currentLocation.longitude}`
        : 'Current location unavailable.',
      `Map: ${buildMapsLink(currentLocation)}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const openSmsComposer = async ({ emergency, location: currentLocation }) => {
    const smsBody = encodeURIComponent(
      buildSmsBody(emergency, currentLocation)
    );
    const smsUrls = Platform.select({
      ios: [`sms:${emergency.phone}&body=${smsBody}`, `sms:${emergency.phone}`],
      android: [
        `sms:${emergency.phone}?body=${smsBody}`,
        `smsto:${emergency.phone}?body=${smsBody}`,
        `sms:${emergency.phone}`,
      ],
      default: [`sms:${emergency.phone}`],
    }) || [`sms:${emergency.phone}`];

    try {
      for (const smsUrl of smsUrls) {
        try {
          await Linking.openURL(smsUrl);
          return true;
        } catch (error) {
          console.log(
            'SMS compose attempt failed:',
            smsUrl,
            error?.message || error
          );
        }
      }
    } catch (error) {
      console.log('SMS compose error:', error);
    }

    Alert.alert(
      'Message Failed',
      `Unable to open the SMS app for ${emergency.formattedPhone}.`
    );
    return false;
  };

  const sendEmergencyAlert = async (emergency, currentLocation) => {
    try {
      const alertData = {
        type: emergency.type,
        description: `Emergency assistance requested via ${emergency.formattedPhone}`,
        location: currentLocation || null,
        timestamp: new Date().toISOString(),
        emergencyContactCalled: true,
        studentInfo: {
          name: user?.name,
          studentId: user?.studentId,
          phone: user?.phoneNumber,
          hostel: user?.hostel,
          roomNumber: user?.roomNumber,
        },
      };

      if (currentLocation) {
        await emergencyAPI.createAlert(alertData);
      }
    } catch (error) {
      console.log('Emergency alert send error:', error);
    }
  };

  const placeCall = async (emergency, currentLocation) => {
    const callUrls = Platform.select({
      ios: [`telprompt:${emergency.phone}`, `tel:${emergency.phone}`],
      android: [`tel:${emergency.phone}`],
      default: [`tel:${emergency.phone}`],
    }) || [`tel:${emergency.phone}`];

    try {
      pendingSmsRef.current = { emergency, location: currentLocation };

      for (const callUrl of callUrls) {
        try {
          await callEmergencyno(emergency.phone);
          return true;
        } catch (error) {
          console.log('Call attempt failed:', callUrl, error?.message || error);
        }
      }

      pendingSmsRef.current = null;
      Alert.alert(
        'Call Unavailable',
        `This device cannot place a call to ${emergency.formattedPhone}.`
      );
      await openSmsComposer({ emergency, location: currentLocation });
      return false;
    } catch (error) {
      pendingSmsRef.current = null;
      console.log('Call error:', error);
      Alert.alert(
        'Call Failed',
        `Unable to start the call to ${emergency.formattedPhone}.`
      );
      return false;
    }
  };

  const handleEmergencyPress = async (emergency) => {
    // Use cached/pre-fetched location instantly
    const currentLocation = location;

    await placeCall(emergency, currentLocation);
    await sendEmergencyAlert(emergency, currentLocation);

    // Refresh silently in background after emergency trigger
    // refreshLocation();

    if (!currentLocation) {
      const permissionMessage =
        permissionStatus === 'denied'
          ? 'Location permission is denied, so the emergency alert was sent without live coordinates.'
          : 'Live coordinates were unavailable, so the emergency alert used call and message only.';

      Alert.alert('Location Unavailable', permissionMessage);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            width: '100%',
          }}
        >
          <TouchableOpacity
            onPress={toggleTheme}
            style={{ padding: 8, alignSelf: 'flex-end' }}
          >
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.headerContent}>
          <Ionicons name="warning" size={32} color="#f44336" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Emergency Services
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.text }]}>
            Tap once to call and share your live location
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <LocationCard
          location={location}
          loading={locationLoading}
          onRefresh={refreshLocation}
        />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Emergency Alerts
          </Text>
          <Text style={[styles.sectionDescription, { color: colors.text }]}>
            Each button is mapped to a direct number and includes your current
            location in the SMS draft.
          </Text>

          <View style={styles.emergencyGrid}>
            {emergencyTypes.map((emergency, index) => (
              <EmergencyButton
                key={index}
                emergency={emergency}
                onPress={() => handleEmergencyPress(emergency)}
                disabled={false}
                disabledText="Getting location..."
              />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.error + '10',
    paddingTop: 12,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
    color: COLORS.error,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    color: COLORS.gray[600],
    textAlign: 'center',
  },
  content: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: COLORS.gray[800],
    marginBottom: SPACING.xs,
  },
  sectionDescription: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: COLORS.gray[600],
    marginBottom: SPACING.md,
  },
  emergencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
