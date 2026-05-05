import React, { useCallback, useState } from "react"
import {
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Constants from "expo-constants"
import { useFocusEffect } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../context/ThemeContext"
import { useAuth } from "../context/AuthContext"
import { FONTS } from "../utils/constants"
import LoadingSpinner from "../components/LoadingSpinner"
import { libraryAPI } from "../services/api"
import { isLibraryAdministrator } from "../utils/adminScopes"

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
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submittingKey, setSubmittingKey] = useState(null)
  const canReleaseSeats = isLibraryAdministrator(user)

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

  const runAction = async (key, action, fallbackMessage) => {
    try {
      setSubmittingKey(key)
      const response = await action()
      setOverview(response?.data?.overview || null)
      Alert.alert("Library Updated", response?.data?.message || fallbackMessage)
    } catch (error) {
      console.log("Library admin action error:", error?.response?.data || error)
      Alert.alert("Action Failed", error?.response?.data?.message || fallbackMessage)
    } finally {
      setSubmittingKey(null)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  const getTimeAgo = (date) => {
    const now = new Date();
    const past = new Date(date);

    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins} Min${diffMins > 1 ? "s" : ""}`;
    }

    if (diffHours < 24) {
      return `${diffHours} Hr${diffHours > 1 ? "s" : ""}`;
    }

    return `${diffDays} Day${diffDays > 1 ? "s" : ""}`;
  };

  const summary = overview?.summary || {}
  const occupants = overview?.occupants || []

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
              {canReleaseSeats
                ? "Current strength, available tokens, and one-tap seat release for any active student."
                : "Current strength, available tokens, and who is inside from when."}
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
            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 12 }}>
              Students Inside
            </Text>
            {occupants.length ? (
              occupants.map((entry, index) => (
                <View
                  key={entry.id}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: index === occupants.length - 1 ? 0 : 1,
                    borderBottomColor: colors.divider,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
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
                        <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 14 }}>
                          {entry.user?.name}
                        </Text>
                        <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>
                          {entry.user?.studentId || "Student"}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12 }}>
                      From {getTimeAgo(entry.enteredAt)}
                    </Text>
                  </View>
                  {canReleaseSeats ? (
                    <TouchableOpacity
                      disabled={submittingKey === `seat-release-${entry.id}`}
                      onPress={() =>
                        runAction(
                          `seat-release-${entry.id}`,
                          () => libraryAPI.adminReleaseSeat({ sessionId: entry.id }),
                          `Unable to release Token Number ${entry.seatNumber}.`,
                        )
                      }
                      style={{
                        marginTop: 10,
                        borderRadius: 16,
                        paddingVertical: 12,
                        alignItems: "center",
                        backgroundColor: colors.successSoft,
                        opacity: submittingKey === `seat-release-${entry.id}` ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ color: colors.success, fontFamily: FONTS.bold, fontSize: 13 }}>
                        {submittingKey === `seat-release-${entry.id}` ? "Releasing..." : "Release Seat"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13 }}>
                Nobody is currently marked inside the library.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
