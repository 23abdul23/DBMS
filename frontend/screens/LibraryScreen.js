import React, { useCallback, useMemo, useState } from "react"
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  ImageBackground,
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

const getTimeAgo = (date) => {
  if (!date) {
    return "-"
  }

  const now = new Date()
  const past = new Date(date)
  const diffMs = now - past
  const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffMins < 60) {
    return `${diffMins} min`
  }

  if (diffHours < 24) {
    return `${diffHours} hr`
  }

  return `${Math.floor(diffHours / 24)} day`
}

export default function LibraryScreen({ navigation }) {
  const { colors, isDarkMode, toggleTheme } = useTheme()
  const [overview, setOverview] = useState(null)
  const [libraryStatus, setLibraryStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadOverview = useCallback(async (nextLoading = false) => {
    try {
      if (nextLoading) {
        setLoading(true)
      }

      const [overviewResult, statusResult] = await Promise.allSettled([libraryAPI.getOverview(), libraryAPI.getStatus()])

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value?.data?.overview || null)
      } else {
        console.log("Library overview error:", overviewResult.reason?.response?.data || overviewResult.reason)
      }

      if (statusResult.status === "fulfilled") {
        setLibraryStatus(statusResult.value?.data || null)
      } else {
        console.log("Library status error:", statusResult.reason?.response?.data || statusResult.reason)
        setLibraryStatus(null)
      }
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

  const summary = overview?.summary || {}
  const activeSeat = overview?.myStatus?.activeSeat || null
  const activityFeed = overview?.activityFeed || []
  const libraryClosesAt = libraryStatus?.closesAt || overview?.meta?.closesAt || "11:30 PM"
  const isLibraryOpenNow = libraryStatus?.status ?? overview?.meta?.isOpenNow ?? false
  const occupiedPercent = useMemo(() => {
    const capacity = summary.capacity || LIBRARY_LIMIT
    if (!capacity) {
      return 0
    }

    return Math.round(((summary.occupiedCount || 0) / capacity) * 100)
  }, [summary.capacity, summary.occupiedCount])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <ImageBackground
      source={require("../assets/images/iiita2.jpeg")}
      style={{ flex: 1, width: "100%", height: "100%" }}
      blurRadius={3}
      resizeMode="cover"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
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
            paddingTop: 38,
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
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          <View
            style={{
              marginBottom: 18,
              borderRadius: 28,
              padding: 20,
              backgroundColor: colors.cardElevated,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 20 }}>Live occupancy</Text>

            <View
              style={{
                marginTop: 18,
                borderRadius: 20,
                padding: 14,
                backgroundColor: colors.cardMuted,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12 }}>Capacity used</Text>
              <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 30, marginTop: 4 }}>
                {occupiedPercent}%
              </Text>
              <View
                style={{
                  marginTop: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: colors.border,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${occupiedPercent}%`,
                    height: "100%",
                    backgroundColor: occupiedPercent >= 90 ? colors.warning : colors.primary,
                  }}
                />
              </View>
            </View>

            <View
              style={{
                marginTop: 14,
                borderRadius: 20,
                padding: 14,
                backgroundColor: colors.cardMuted,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 14 }}>
                {isLibraryOpenNow
                  ? `Library is open for new entry until ${libraryClosesAt}`
                  : `Library is closed for new entry. Closing time remains ${libraryClosesAt}`}
              </Text>
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 4 }}>
                You can still see occupancy and your current token status here.
              </Text>
            </View>
          </View>
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
                <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 6 }}>
                  Active for {getTimeAgo(activeSeat.enteredAt)}
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
            }}
          >
            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 12 }}>
              Recent Token Activity
            </Text>
            {activityFeed.length ? (
              activityFeed
              .filter((activity) => activity.type !== "library_seat_released")
              .map((activity, index) => (
                <View
                  key={`${activity.id || activity.type}-${activity.timestamp}-${index}`}
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
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        activity.type === "library_seat_released" ? colors.successSoft : colors.primarySoft,
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name={activity.type === "library_seat_released" ? "checkmark-circle-outline" : "book-outline"}
                      size={20}
                      color={activity.type === "library_seat_released" ? colors.success : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 14 }}>{activity.title}</Text>
                    <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 }}>
                      {activity.subtitle}
                    </Text>
                  </View>
                  <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12 }}>
                    From {getTimeAgo(activity.timestamp)}
                  </Text>
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
    </ImageBackground>
  )
}
