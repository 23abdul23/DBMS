import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { sacAPI } from '../services/api';
import { useAppLocation } from '../context/LocationContext';
import { useLocationGuard } from '../hooks/useLocationGuard';
import { useLocationAccessDenied } from '../context/LocationAccessDeniedContext';
import { SAC_EQUIPMENT } from '../constants/sacCatalog';
import { FONTS } from '../utils/constants';
import { CONTENT_MAX_WIDTH } from '../utils/responsiveLayout';

const formatTime = (value) => {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function EquipmentScreen({ navigation, route }) {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { location: currentLocation } = useAppLocation();
  const { validateAndExecute } = useLocationGuard();
  const { hideLocationAccessDenied } = useLocationAccessDenied();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingKey, setSubmittingKey] = useState(null);

  const DEBUG_EQUIP = __DEV__;
  const equipLog = useCallback(
    (event, payload = {}) => {
      if (!DEBUG_EQUIP) {
        return;
      }

      console.log('[EQUIPMENT]', JSON.stringify({ event, ...payload }));
    },
    [DEBUG_EQUIP]
  );

  const entrySource = route?.params?.entrySource || 'manual';

  useFocusEffect(
    useCallback(() => {
      equipLog('screen-focus');

      return () => {
        equipLog('screen-blur-cleanup');
        hideLocationAccessDenied();
        setSubmittingKey(null);
      };
    }, [equipLog, hideLocationAccessDenied])
  );

  const activeEquipment = overview?.myStatus?.activeEquipment || [];
  const currentEquipment = activeEquipment[0] || null;
  const myEquipmentSet = useMemo(
    () => new Set(activeEquipment.map((item) => item.name)),
    [activeEquipment]
  );
  const hasAnyActiveEquipment = activeEquipment.length > 0;
  const equipmentActivity = (overview?.activityFeed || []).filter(
    (item) =>
      item.type === 'equipment_checked_out' ||
      item.type === 'equipment_returned'
  );
  const equipmentStateMap = new Map(
    (overview?.equipment || []).map((equipment) => [equipment.name, equipment])
  );

  const loadOverview = async (nextLoading = false) => {
    try {
      if (nextLoading) {
        setLoading(true);
      }

      const response = await sacAPI.getOverview();
      setOverview(response?.data?.overview || null);
    } catch (error) {
      console.log('Equipment overview error:', error?.response?.data || error);
      Alert.alert(
        'SAC Error',
        error?.response?.data?.message ||
          'Unable to load equipment activity right now.'
      );
    } finally {
      if (nextLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadOverview(true);
  }, []);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadOverview(false);
    } finally {
      setRefreshing(false);
    }
  };

  const runAction = async (key, action, fallbackMessage) => {
    try {
      setSubmittingKey(key);
      const response = await action();
      setOverview(response?.data?.overview || null);
      Alert.alert('SAC Updated', response?.data?.message || fallbackMessage);
    } catch (error) {
      console.log('Equipment action error:', error?.response?.data || error);
      Alert.alert(
        'Action Failed',
        error?.response?.data?.message || fallbackMessage
      );
    } finally {
      setSubmittingKey(null);
    }
  };

  /**
   * Wrapper for selectEquipment action with proximity validation
   * Validates user is within range of SAC before allowing equipment selection
   */
  const handleSelectEquipment = async (equipmentName) => {
    const submissionKey = `equipment-select-${equipmentName}`;

    try {
      setSubmittingKey(submissionKey);
      equipLog('validation-trigger', { equipmentName });

      const result = await validateAndExecute(
        'SAC', // Location name for proximity validation
        async () => {
          // API call payload with current location
          const coordsPayload = {
            latitude: currentLocation?.latitude || null,
            longitude: currentLocation?.longitude || null,
            locationTimestamp: currentLocation?.timestamp || null,
          };

          return await sacAPI.selectEquipment(equipmentName, coordsPayload);
        },
        {
          actionName: `Borrow Equipment: ${equipmentName}`,
          onDeniedConfirm: () => {
            equipLog('navigation-start', { equipmentName });
            navigation.navigate('Main', { screen: 'Dashboard' });
          },
        }
      );

      if (!result.success) {
        equipLog('validation-failed', {
          equipmentName,
          reason: result.reason,
          error: result.error,
        });
        return;
      }

      // Success - update UI
      setOverview(result.apiResult?.data?.overview || null);
      equipLog('validation-success', { equipmentName });
      Alert.alert(
        'SAC Updated',
        result.apiResult?.data?.message ||
          `Successfully borrowed ${equipmentName}`
      );
    } finally {
      setSubmittingKey(null);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 22,
            backgroundColor: colors.header,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              width: '100%',
              alignSelf: 'center',
              maxWidth: CONTENT_MAX_WIDTH,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.cardElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>

              <Text
                style={{
                  color: colors.heading,
                  fontFamily: FONTS.bold,
                  fontSize: 22,
                }}
              >
                Equipments
              </Text>

              <TouchableOpacity
                onPress={toggleTheme}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.cardElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons
                  name={isDarkMode ? 'sunny' : 'moon'}
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <View
              style={{
                marginTop: 18,
                borderRadius: 28,
                padding: 20,
                backgroundColor: colors.cardElevated,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      entrySource === 'qr'
                        ? colors.successSoft
                        : colors.primarySoft,
                  }}
                >
                  <Ionicons
                    name={
                      entrySource === 'qr'
                        ? 'qr-code-outline'
                        : 'football-outline'
                    }
                    size={26}
                    color={
                      entrySource === 'qr' ? colors.success : colors.primary
                    }
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text
                    style={{
                      color: colors.heading,
                      fontFamily: FONTS.bold,
                      fontSize: 18,
                      marginTop: 15,
                      marginLeft: 20,
                    }}
                  >
                    Shared Equipment
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View
          style={{
            width: '100%',
            alignSelf: 'center',
            maxWidth: CONTENT_MAX_WIDTH,
            paddingHorizontal: 18,
            paddingTop: 18,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'nowrap',
              marginBottom: 4,
            }}
          >
            {[
              {
                label: 'In Use',
                value: overview?.summary?.equipmentInUse || 0,
                icon: 'football-outline',
                toneBg: colors.primarySoft,
                toneFg: colors.primary,
              },
              {
                label: 'Equipment Types',
                value: overview?.summary?.activeEquipmentTypes || 0,
                icon: 'apps-outline',
                toneBg: colors.accentSoft,
                toneFg: colors.accent,
              },
              {
                label: 'Your Items',
                value: overview?.myStatus?.activeEquipment?.length || 0,
                icon: 'person-outline',
                toneBg: colors.warningSoft,
                toneFg: colors.warning,
              },
            ].map((stat, index) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  backgroundColor: colors.cardElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 24,
                  padding: 14,
                  marginBottom: 12,
                  marginRight: index < 2 ? 12 : 0,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: stat.toneBg,
                    marginBottom: 10,
                  }}
                >
                  <Ionicons name={stat.icon} size={18} color={stat.toneFg} />
                </View>
                <Text
                  style={{
                    color: colors.heading,
                    fontFamily: FONTS.bold,
                    fontSize: 20,
                  }}
                >
                  {stat.value}
                </Text>
                <Text
                  style={{
                    color: colors.subText,
                    fontFamily: FONTS.regular,
                    fontSize: 12,
                    marginTop: 3,
                  }}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {SAC_EQUIPMENT.map((item) => {
            const equipmentState = equipmentStateMap.get(item.name);
            const userHasItem =
              equipmentState?.isCheckedOutByCurrentUser ||
              myEquipmentSet.has(item.name) ||
              false;
            const hasAnotherItem = hasAnyActiveEquipment && !userHasItem;
            const isBusy =
              submittingKey === `equipment-select-${item.name}` ||
              submittingKey === `equipment-return-${item.name}`;

            return (
              <View
                key={item.name}
                style={{
                  marginBottom: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: userHasItem
                        ? colors.successSoft
                        : colors.primarySoft,
                      marginRight: 14,
                    }}
                  >
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={userHasItem ? colors.success : colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.heading,
                        fontFamily: FONTS.bold,
                        fontSize: 16,
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        color: colors.subText,
                        fontFamily: FONTS.regular,
                        fontSize: 13,
                        marginTop: 3,
                      }}
                    >
                      {equipmentState?.activeCount || 0} active checkout
                      {equipmentState?.activeCount === 1 ? '' : 's'}
                    </Text>
                  </View>

                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: colors.cardMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.heading,
                        fontFamily: FONTS.bold,
                        fontSize: 12,
                      }}
                    >
                      Count {equipmentState?.activeCount || 0}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    marginTop: 14,
                    borderRadius: 18,
                    padding: 16,
                    backgroundColor: userHasItem
                      ? colors.successSoft
                      : colors.cardMuted,
                  }}
                >
                  <Text
                    style={{
                      color: colors.subText,
                      fontFamily: FONTS.regular,
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {userHasItem
                      ? `Assigned since ${formatTime(
                          activeEquipment.find(
                            (entry) => entry.name === item.name
                          )?.checkedOutAt
                        )}`
                      : hasAnotherItem
                      ? `You already have ${currentEquipment?.name}. SAC admin must mark it returned first.`
                      : 'No one has taken this Equipment.'}
                  </Text>
                </View>

                {user?.role === 'student' ? (
                  <TouchableOpacity
                    disabled={isBusy || hasAnyActiveEquipment}
                    onPress={() =>
                      !hasAnyActiveEquipment && handleSelectEquipment(item.name)
                    }
                    style={{
                      marginTop: 14,
                      borderRadius: 18,
                      paddingVertical: 14,
                      alignItems: 'center',
                      backgroundColor: hasAnyActiveEquipment
                        ? colors.cardMuted
                        : colors.accent,
                      borderWidth: hasAnyActiveEquipment ? 1 : 0,
                      borderColor: colors.border,
                      opacity: isBusy || hasAnyActiveEquipment ? 0.6 : 1,
                    }}
                  >
                    <Text
                      style={{
                        color: hasAnyActiveEquipment
                          ? colors.subText
                          : colors.buttonTextOnSolid,
                        fontFamily: FONTS.bold,
                        fontSize: 14,
                      }}
                    >
                      {userHasItem
                        ? 'Awaiting SAC admin return'
                        : hasAnotherItem
                        ? `Return ${
                            currentEquipment?.name || 'current item'
                          } first`
                        : 'Take Equipment'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}

          <Text
            style={{
              color: colors.heading,
              fontFamily: FONTS.bold,
              fontSize: 20,
              marginBottom: 12,
              marginTop: 8,
            }}
          >
            Equipment Activity
          </Text>
          <View
            style={{
              backgroundColor: colors.cardElevated,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
            }}
          >
            {equipmentActivity.length ? (
              equipmentActivity.map((activity, index) => (
                <View
                  key={`${activity.id || activity.type}-${
                    activity.timestamp
                  }-${index}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    paddingVertical: 10,
                    borderBottomWidth:
                      index === equipmentActivity.length - 1 ? 0 : 1,
                    borderBottomColor: colors.divider,
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        activity.type === 'equipment_returned'
                          ? colors.successSoft
                          : colors.primarySoft,
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name={
                        activity.type === 'equipment_returned'
                          ? 'checkmark-circle-outline'
                          : 'football-outline'
                      }
                      size={20}
                      color={
                        activity.type === 'equipment_returned'
                          ? colors.success
                          : colors.primary
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.heading,
                        fontFamily: FONTS.bold,
                        fontSize: 14,
                      }}
                    >
                      {activity.title}
                    </Text>
                    <Text
                      style={{
                        color: colors.subText,
                        fontFamily: FONTS.regular,
                        fontSize: 12,
                        marginTop: 3,
                      }}
                    >
                      {activity.subtitle}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.subText,
                      fontFamily: FONTS.regular,
                      fontSize: 12,
                      marginLeft: 12,
                    }}
                  >
                    {formatTime(activity.timestamp)}
                  </Text>
                </View>
              ))
            ) : (
              <Text
                style={{
                  color: colors.subText,
                  fontFamily: FONTS.regular,
                  fontSize: 13,
                }}
              >
                No equipment activity yet.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
