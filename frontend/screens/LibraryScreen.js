import React, { useCallback, useState } from "react"
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import Constants from "expo-constants"
import { useFocusEffect } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../context/ThemeContext"
import { FONTS } from "../utils/constants"
import LoadingSpinner from "../components/LoadingSpinner"
import { libraryAPI } from "../services/api"

const LIBRARY_LIMIT = Number(Constants.expoConfig?.extra?.LIBRARY_LIMIT || 60)

const formatTime = (value) => {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function LibraryScreen({ navigation }) {
  const { colors, isDarkMode, toggleTheme } = useTheme()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadOverview = useCallback(async (nextLoading = false) => {
    try {
      if (nextLoading) {
        setLoading(true)
      }

      const response = await libraryAPI.getOverview()
      setOverview(response?.data?.overview || null)
    } catch (error) {
      console.log("Library overview error:", error?.response?.data || error)
    } finally {
      if (nextLoading) {
        setLoading(false)
      }
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadOverview(true)
    }, [loadOverview]),
  )

  const onRefresh = async () => {
    try {
      setRefreshing(true)
      await loadOverview(false)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  const summary = overview?.summary || {}
  const activeSeat = overview?.myStatus?.activeSeat || null
  const occupants = overview?.occupants || []
  const activityFeed = overview?.activityFeed || []

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 30 }}
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

            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 22 }}>Library</Text>

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
            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 20 }}>Live Library Occupancy</Text>
            <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 6 }}>
              Current strength, available tokens, and who is inside from when.
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 18 }}>
            {[
              {
                label: "Current",
                value: summary.occupiedCount || 0,
                icon: "people-outline",
                toneBg: colors.primarySoft,
                toneFg: colors.primary,
              },
              {
                label: "Available",
                value: summary.availableCount ?? LIBRARY_LIMIT,
                icon: "albums-outline",
                toneBg: colors.successSoft,
                toneFg: colors.success,
              },
              {
                label: "Capacity",
                value: summary.capacity || LIBRARY_LIMIT,
                icon: "library-outline",
                toneBg: colors.warningSoft,
                toneFg: colors.warning,
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

          <View
            style={{
              backgroundColor: colors.cardElevated,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18 }}>Your Token</Text>
            {activeSeat ? (
              <>
                <Text style={{ color: colors.primary, fontFamily: FONTS.bold, fontSize: 34, marginTop: 10 }}>
                  #{activeSeat.seatNumber}
                </Text>
                <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 6 }}>
                  Seated from {formatTime(activeSeat.enteredAt)}
                </Text>
              </>
            ) : (
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 10 }}>
                No active library token. Scan the Library QR to take one.
              </Text>
            )}
          </View>

          <View
            style={{
              backgroundColor: colors.cardElevated,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 12 }}>
              Students Inside
            </Text>
            {occupants.length ? (
              occupants.map((entry, index) => (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    borderBottomWidth: index === occupants.length - 1 ? 0 : 1,
                    borderBottomColor: colors.divider,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.primarySoft,
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ color: colors.primary, fontFamily: FONTS.bold }}>#{entry.seatNumber}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 14 }}>{entry.user?.name}</Text>
                      <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>
                        {entry.user?.studentId || "Student"}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12 }}>
                    From {formatTime(entry.enteredAt)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13 }}>
                Nobody is currently marked inside the library.
              </Text>
            )}
          </View>

          <View
            style={{
              backgroundColor: colors.cardElevated,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 18,
            }}
          >
            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 12 }}>
              Library Activity
            </Text>
            {activityFeed.length ? (
              activityFeed.map((activity, index) => (
                <View
                  key={activity.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    paddingVertical: 10,
                    borderBottomWidth: index === activityFeed.length - 1 ? 0 : 1,
                    borderBottomColor: colors.divider,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        activity.type === "library_seat_released" ? colors.warningSoft : colors.successSoft,
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name={activity.type === "library_seat_released" ? "log-out-outline" : "log-in-outline"}
                      size={18}
                      color={activity.type === "library_seat_released" ? colors.warning : colors.success}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 14 }}>{activity.title}</Text>
                    <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>
                      {formatTime(activity.timestamp)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13 }}>
                No recent library activity yet.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
