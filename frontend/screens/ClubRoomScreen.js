import React, { useEffect, useMemo, useState } from "react"
import {
  Alert,
  ImageBackground,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../context/ThemeContext"
import { useAuth } from "../context/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import { sacAPI } from "../services/api"
import { SAC_CLUB_ROOMS } from "../constants/sacCatalog"
import { FONTS } from "../utils/constants"

const formatTime = (value) => {
  if (!value) {
    return ""
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

const getRoomActivityMeta = (activityType) => {
  return activityType === "room_opened"
    ? { icon: "key-outline", colorKey: "warning", bgKey: "warningSoft" }
    : { icon: "people-outline", colorKey: "accent", bgKey: "accentSoft" }
}

export default function ClubRoomScreen({ navigation, route }) {
  const { colors, isDarkMode, toggleTheme } = useTheme()
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submittingKey, setSubmittingKey] = useState(null)

  const entrySource = route?.params?.entrySource || "manual"
  const isStudent = user?.role === "student"

  const roomStateMap = useMemo(
    () => new Map((overview?.rooms || []).map((room) => [room.name, room])),
    [overview?.rooms],
  )

  const roomActivity = (overview?.activityFeed || []).filter(
    (item) => item.type === "room_opened" || item.type === "room_joined",
  )

  const loadOverview = async (nextLoading = false) => {
    try {
      if (nextLoading) {
        setLoading(true)
      }

      const response = await sacAPI.getOverview()
      setOverview(response?.data?.overview || null)
    } catch (error) {
      console.log("Club room overview error:", error?.response?.data || error)
      Alert.alert("SAC Error", error?.response?.data?.message || "Unable to load club room activity right now.")
    } finally {
      if (nextLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadOverview(true)
  }, [])

  const onRefresh = async () => {
    try {
      setRefreshing(true)
      await loadOverview(false)
    } finally {
      setRefreshing(false)
    }
  }

  const runAction = async (key, action, fallbackMessage) => {
    try {
      setSubmittingKey(key)
      const response = await action()
      setOverview(response?.data?.overview || null)
      Alert.alert("SAC Updated", response?.data?.message || fallbackMessage)
    } catch (error) {
      console.log("Club room action error:", error?.response?.data || error)
      Alert.alert("Action Failed", error?.response?.data?.message || fallbackMessage)
    } finally {
      setSubmittingKey(null)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.cardElevated,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>

            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 22 }}>Club Rooms</Text>

            <TouchableOpacity
              onPress={toggleTheme}
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.cardElevated,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color={colors.text} />
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
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: entrySource === "qr" ? colors.successSoft : colors.warningSoft,
                }}
              >
                <Ionicons
                  name={entrySource === "qr" ? "qr-code-outline" : "key-outline"}
                  size={26}
                  color={entrySource === "qr" ? colors.success : colors.warning}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18 }}>Club room activity</Text>
                <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 }}>
                  Open a room, join an active room, and see who is currently inside each club room.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 18 }}>
            {[
              {
                label: "Open Rooms",
                value: overview?.summary?.openRooms || 0,
                icon: "key-outline",
                toneBg: colors.warningSoft,
                toneFg: colors.warning,
              },
              {
                label: "Students Inside",
                value: overview?.summary?.studentsInRooms || 0,
                icon: "people-outline",
                toneBg: colors.accentSoft,
                toneFg: colors.accent,
              },
              {
                label: "Your Rooms",
                value: overview?.myStatus?.activeRooms?.length || 0,
                icon: "person-outline",
                toneBg: colors.primarySoft,
                toneFg: colors.primary,
              },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  width: "31%",
                  backgroundColor: colors.cardElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 24,
                  padding: 14,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: stat.toneBg,
                    marginBottom: 10,
                  }}
                >
                  <Ionicons name={stat.icon} size={18} color={stat.toneFg} />
                </View>
                <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 20 }}>{stat.value}</Text>
                <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {SAC_CLUB_ROOMS.map((room) => {
            const roomState = roomStateMap.get(room.name)
            const userInside = Boolean(roomState?.occupants?.some((occupant) => occupant.user?.id === user?.id))
            const isBusy = submittingKey === `room-select-${room.name}` || submittingKey === `room-leave-${room.name}`

            return (
              <View
                key={room.name}
                style={{
                  marginBottom: 16,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: "hidden",
                }}
              >
                <ImageBackground source={room.imageSource} style={{ height: 132 }} imageStyle={{ opacity: 0.32 }}>
                  <View style={{ flex: 1, backgroundColor: colors.overlay, padding: 18, justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: "#ffffff", fontFamily: FONTS.bold, fontSize: 22 }}>{room.name}</Text>
                        <Text style={{ color: "rgba(255,255,255,0.82)", fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 }}>
                          {room.subtitle}
                        </Text>
                      </View>
                      <View
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          backgroundColor: roomState?.isOpen ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.16)",
                          borderWidth: 1,
                          borderColor: roomState?.isOpen ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.28)",
                        }}
                      >
                        <Text style={{ color: "#ffffff", fontFamily: FONTS.bold, fontSize: 12 }}>
                          {roomState?.isOpen ? "Open Now" : "Closed"}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ color: "rgba(255,255,255,0.82)", fontFamily: FONTS.regular, fontSize: 13 }}>
                      {roomState?.isOpen
                        ? `${roomState.presentCount} inside${roomState.openedBy ? ` | opened by ${roomState.openedBy.name}` : ""}`
                        : "No active session yet"}
                    </Text>
                  </View>
                </ImageBackground>

                <View style={{ padding: 18 }}>
                  {roomState?.isOpen ? (
                    <>
                      <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13 }}>
                        Opened at {formatTime(roomState.openedAt)}
                      </Text>
                      <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 14, marginTop: 12, marginBottom: 8 }}>
                        Students inside
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {roomState.occupants.map((occupant) => (
                          <View
                            key={occupant.id}
                            style={{
                              marginRight: 8,
                              marginBottom: 8,
                              borderRadius: 999,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              backgroundColor: occupant.user?.id === roomState.openedBy?.id ? colors.warningSoft : colors.cardMuted,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 12 }}>
                              {occupant.user?.name}
                            </Text>
                            <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 11 }}>
                              {occupant.user?.id === roomState.openedBy?.id ? "Opened room" : `Joined ${formatTime(occupant.joinedAt)}`}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13 }}>
                      The first student to select this room will be marked as the opener.
                    </Text>
                  )}

                  {isStudent && (
                    <TouchableOpacity
                      disabled={isBusy}
                      onPress={() =>
                        userInside
                          ? runAction(
                              `room-leave-${room.name}`,
                              () => sacAPI.leaveRoom(room.name),
                              `Unable to leave ${room.name}.`,
                            )
                          : runAction(
                              `room-select-${room.name}`,
                              () => sacAPI.selectRoom(room.name),
                              `Unable to update ${room.name}.`,
                            )
                      }
                      style={{
                        marginTop: 16,
                        borderRadius: 18,
                        paddingVertical: 14,
                        alignItems: "center",
                        backgroundColor: userInside ? colors.cardMuted : colors.primary,
                        borderWidth: userInside ? 1 : 0,
                        borderColor: colors.border,
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: userInside ? colors.heading : colors.buttonTextOnPrimary,
                          fontFamily: FONTS.bold,
                          fontSize: 14,
                        }}
                      >
                        {userInside ? "Leave Room" : roomState?.isOpen ? "Join Room" : "Open Room"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )
          })}

          <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 20, marginBottom: 12, marginTop: 8 }}>
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
                const meta = getRoomActivityMeta(activity.type)

                return (
                  <View
                    key={`${activity.type}-${activity.timestamp}-${index}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      paddingVertical: 10,
                      borderBottomWidth: index === roomActivity.length - 1 ? 0 : 1,
                      borderBottomColor: colors.divider,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors[meta.bgKey],
                        marginRight: 12,
                      }}
                    >
                      <Ionicons name={meta.icon} size={20} color={colors[meta.colorKey]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 14 }}>{activity.title}</Text>
                      <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 }}>
                        {activity.subtitle}
                      </Text>
                    </View>
                    <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12 }}>
                      {formatTime(activity.timestamp)}
                    </Text>
                  </View>
                )
              })
            ) : (
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13 }}>
                No club room activity yet.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
