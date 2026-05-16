import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
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
import { SAC_CLUB_ROOMS } from '../constants/sacCatalog';
import { FONTS } from '../utils/constants';
import {
  CONTENT_MAX_WIDTH,
  getThreeColumnCardWidth,
} from '../utils/responsiveLayout';

const formatTime = (value) => {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getRoomActivityMeta = (activityType) => {
  if (activityType === 'room_opened') {
    return { icon: 'key-outline', colorKey: 'warning', bgKey: 'warningSoft' };
  }

  if (activityType === 'room_left') {
    return { icon: 'exit-outline', colorKey: 'danger', bgKey: 'dangerSoft' };
  }

  return { icon: 'people-outline', colorKey: 'accent', bgKey: 'accentSoft' };
};

export default function ClubRoomScreen({ navigation, route }) {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { location: currentLocation } = useAppLocation();
  const { validateAndExecute } = useLocationGuard();
  const { hideLocationAccessDenied } = useLocationAccessDenied();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingKey, setSubmittingKey] = useState(null);

  const DEBUG_CLUB = __DEV__;
  const clubLog = useCallback(
    (event, payload = {}) => {
      if (!DEBUG_CLUB) {
        return;
      }

      console.log('[CLUB_ROOM]', JSON.stringify({ event, ...payload }));
    },
    [DEBUG_CLUB]
  );

  const isCompact = width < 520;

  useFocusEffect(
    useCallback(() => {
      clubLog('screen-focus');

      return () => {
        clubLog('screen-blur-cleanup');
        hideLocationAccessDenied();
        setSubmittingKey(null);
      };
    }, [clubLog, hideLocationAccessDenied])
  );

  const myActiveRoomIds = useMemo(
    () =>
      new Set((overview?.myStatus?.activeRooms || []).map((room) => room.name)),
    [overview?.myStatus?.activeRooms]
  );
  const roomStateMap = useMemo(
    () => new Map((overview?.rooms || []).map((room) => [room.name, room])),
    [overview?.rooms]
  );
  const roomActivity = (overview?.activityFeed || []).filter(
    (item) =>
      item.type === 'room_opened' ||
      item.type === 'room_joined' ||
      item.type === 'room_left'
  );

  const loadOverview = async (nextLoading = false) => {
    try {
      if (nextLoading) {
        setLoading(true);
      }

      const response = await sacAPI.getOverview();
      setOverview(response?.data?.overview || null);
    } catch (error) {
      console.log('Club room overview error:', error?.response?.data || error);
      Alert.alert(
        'SAC Error',
        error?.response?.data?.message ||
          'Unable to load club room activity right now.'
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
      console.log('Club room action error:', error?.response?.data || error);
      Alert.alert(
        'Action Failed',
        error?.response?.data?.message || fallbackMessage
      );
    } finally {
      setSubmittingKey(null);
    }
  };

  /**
   * Wrapper for selectRoom action with proximity validation
   * Validates user is within range of SAC before allowing room selection
   */
  const handleSelectRoom = async (roomName) => {
    // Structured log for room selection
    clubLog('validation-trigger', { roomName });
    const result = await validateAndExecute(
      'SAC', // Location name for proximity validation
      async () => {
        // API call payload with current location
        const coordsPayload = {
          latitude: currentLocation?.latitude || null,
          longitude: currentLocation?.longitude || null,
          locationTimestamp: currentLocation?.timestamp || null,
        };

        return await sacAPI.selectRoom(roomName, coordsPayload);
      },
      {
        actionName: `Join Room: ${roomName}`,
        onDeniedConfirm: () => {
          clubLog('navigation-start', { roomName });
          setSubmittingKey(null);
          navigation.navigate('Main', { screen: 'Dashboard' });
        },
      }
    );

    if (!result.success) {
      clubLog('validation-failed', {
        roomName,
        reason: result.reason,
        error: result.error,
      });
      // Error already shown by validateAndExecute
      return;
    }

    // Success - update UI
    setOverview(result.apiResult?.data?.overview || null);
    clubLog('validation-success', { roomName });
    Alert.alert(
      'SAC Updated',
      result.apiResult?.data?.message || `Successfully joined ${roomName}`
    );
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
                Club Rooms
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
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            {[
              {
                label: 'Open Rooms',
                value: overview?.summary?.openRooms || 0,
                icon: 'key-outline',
                toneBg: colors.warningSoft,
                toneFg: colors.warning,
              },
              {
                label: 'Students Inside',
                value: overview?.summary?.studentsInRooms || 0,
                icon: 'people-outline',
                toneBg: colors.accentSoft,
                toneFg: colors.accent,
              },
              {
                label: 'Your Rooms',
                value: overview?.myStatus?.activeRooms?.length || 0,
                icon: 'person-outline',
                toneBg: colors.primarySoft,
                toneFg: colors.primary,
              },
            ].map((stat, index) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  marginRight: index < 2 ? 8 : 0,
                  backgroundColor: colors.cardElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 24,
                  padding: 14,
                  marginBottom: 12,
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

          {SAC_CLUB_ROOMS.map((room) => {
            const roomState = roomStateMap.get(room.name);
            const userInside =
              roomState?.isCurrentUserInside ||
              myActiveRoomIds.has(room.name) ||
              false;
            const isBusy =
              submittingKey === `room-select-${room.name}` ||
              submittingKey === `room-leave-${room.name}`;

            return (
              <View
                key={room.name}
                style={{
                  marginBottom: 16,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    padding: 18,
                    backgroundColor: colors.cardMuted,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isCompact ? 'column' : 'row',
                      justifyContent: 'space-between',
                      alignItems: isCompact ? 'stretch' : 'flex-start',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        flex: 1,
                        paddingRight: isCompact ? 0 : 10,
                        marginBottom: isCompact ? 12 : 0,
                      }}
                    >
                      <View
                        style={{
                          width: 68,
                          height: 68,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                          overflow: 'hidden',
                          marginRight: 14,
                        }}
                      >
                        <Image
                          source={room.imageSource}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 999,
                          }}
                          resizeMode="cover"
                        />
                      </View>
                      <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text
                          style={{
                            color: colors.heading,
                            fontFamily: FONTS.bold,
                            fontSize: 22,
                          }}
                        >
                          {room.name}
                        </Text>
                        <Text
                          style={{
                            color: colors.subText,
                            fontFamily: FONTS.regular,
                            fontSize: 13,
                            marginTop: 4,
                          }}
                        >
                          {room.subtitle}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        alignSelf: isCompact ? 'flex-start' : 'auto',
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: roomState?.isOpen
                          ? colors.successSoft
                          : colors.cardElevated,
                        borderWidth: 1,
                        borderColor: roomState?.isOpen
                          ? colors.success
                          : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: roomState?.isOpen
                            ? colors.success
                            : colors.heading,
                          fontFamily: FONTS.bold,
                          fontSize: 12,
                        }}
                      >
                        {roomState?.isOpen ? 'Open Now' : 'Closed'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ padding: 18 }}>
                  <View
                    style={{
                      flexDirection: isCompact ? 'column' : 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ marginBottom: isCompact ? 14 : 0 }}>
                      <Text
                        style={{
                          color: colors.subText,
                          fontFamily: FONTS.regular,
                          fontSize: 12,
                        }}
                      >
                        Inside now
                      </Text>
                      <Text
                        style={{
                          color: colors.heading,
                          fontFamily: FONTS.bold,
                          fontSize: 28,
                          marginTop: 6,
                        }}
                      >
                        {roomState?.presentCount || 0}
                      </Text>
                    </View>
                    <View
                      style={{
                        alignItems: isCompact ? 'flex-start' : 'flex-end',
                      }}
                    >
                      <Text
                        style={{
                          color: colors.subText,
                          fontFamily: FONTS.bold,
                          fontSize: 16,
                          marginTop: 8,
                        }}
                      >
                        {roomState?.openedAt
                          ? formatTime(roomState.openedAt)
                          : '-'}
                      </Text>
                    </View>
                  </View>

                  {user?.role === 'student' ? (
                    <TouchableOpacity
                      disabled={isBusy}
                      onPress={() =>
                        userInside
                          ? runAction(
                              `room-leave-${room.name}`,
                              () => sacAPI.leaveRoom(room.name),
                              `Unable to leave ${room.name}.`
                            )
                          : handleSelectRoom(room.name)
                      }
                      style={{
                        marginTop: 16,
                        borderRadius: 18,
                        paddingVertical: 14,
                        alignItems: 'center',
                        backgroundColor: userInside
                          ? colors.cardMuted
                          : colors.primary,
                        borderWidth: userInside ? 1 : 0,
                        borderColor: colors.border,
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: userInside
                            ? colors.heading
                            : colors.buttonTextOnPrimary,
                          fontFamily: FONTS.bold,
                          fontSize: 14,
                        }}
                      >
                        {userInside
                          ? 'Leave Room'
                          : roomState?.isOpen
                          ? 'Join Room'
                          : 'Open Room'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
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
            Club Room Activity
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
            {roomActivity.length ? (
              roomActivity.map((activity, index) => {
                const meta = getRoomActivityMeta(activity.type);

                return (
                  <View
                    key={`${activity.id || activity.type}-${
                      activity.timestamp
                    }-${index}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      paddingVertical: 10,
                      borderBottomWidth:
                        index === roomActivity.length - 1 ? 0 : 1,
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
                        backgroundColor: colors[meta.bgKey],
                        marginRight: 12,
                      }}
                    >
                      <Ionicons
                        name={meta.icon}
                        size={20}
                        color={colors[meta.colorKey]}
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
                );
              })
            ) : (
              <Text
                style={{
                  color: colors.subText,
                  fontFamily: FONTS.regular,
                  fontSize: 13,
                }}
              >
                No club room activity yet.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
