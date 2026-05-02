import React, { useEffect, useState } from "react"
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../context/ThemeContext"
import { sacAPI } from "../services/api"
import LoadingSpinner from "../components/LoadingSpinner"
import { FONTS } from "../utils/constants"
import { CONTENT_MAX_WIDTH, getThreeColumnCardWidth, getTwoColumnCardWidth } from "../utils/responsiveLayout"

export default function SACAdminScreen({ navigation, route }) {
  const { colors, isDarkMode, toggleTheme } = useTheme()
  const { width } = useWindowDimensions()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const entrySource = route?.params?.entrySource || "manual"
  const statCardWidth = getThreeColumnCardWidth(width)
  const actionCardWidth = getTwoColumnCardWidth(width)

  const loadOverview = async (nextLoading = false) => {
    try {
      if (nextLoading) {
        setLoading(true)
      }

      const response = await sacAPI.getOverview()
      setOverview(response?.data?.overview || null)
    } catch (error) {
      console.log("SAC overview error:", error?.response?.data || error)
      Alert.alert("SAC Error", error?.response?.data?.message || "Unable to load SAC activity right now.")
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

  const resolveRouteName = (preferredName, fallbackName) => {
    const routeNames = navigation?.getState?.()?.routeNames || []
    if (routeNames.includes(preferredName)) {
      return preferredName
    }

    if (routeNames.includes(fallbackName)) {
      return fallbackName
    }

    return preferredName
  }

  if (loading) {
    return <LoadingSpinner />
  }

  const tiles = [
    {
      key: "club-rooms",
      title: "CLUB ROOMS",
      subtitle: "Open a room, see who opened it, and track who is inside.",
      routeName: resolveRouteName("Club Rooms", "ClubRooms"),
      icon: "key-outline",
      value: overview?.summary?.openRooms || 0,
      valueLabel: "Open now",
      accentBg: colors.warningSoft,
      accentFg: colors.warning,
    },
    {
      key: "equipments",
      title: "EQUIPMENTS",
      subtitle: "Mark sports equipment as taken and view current active counts.",
      routeName: resolveRouteName("Equipment", "Equipments"),
      icon: "football-outline",
      value: overview?.summary?.equipmentInUse || 0,
      valueLabel: "In use",
      accentBg: colors.primarySoft,
      accentFg: colors.primary,
    },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 28 }}
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
          <View style={{ width: "100%", alignSelf: "center", maxWidth: CONTENT_MAX_WIDTH }}>
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

              <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 22 }}>SAC</Text>

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
                    backgroundColor: entrySource === "qr" ? colors.successSoft : colors.accentSoft,
                  }}
                >
                  <Ionicons
                    name={entrySource === "qr" ? "qr-code-outline" : "grid-outline"}
                    size={26}
                    color={entrySource === "qr" ? colors.success : colors.accent}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18 }}>
                    {entrySource === "qr" ? "SAC QR scanned" : "Choose a SAC section"}
                  </Text>
                  <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
                    Start with club rooms or equipments. Each section opens its own screen with the full SAC guard view.
                  </Text>
                  <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 6 }}>
                    {overview?.meta?.isOpenNow
                      ? `Open now. Closes at ${overview?.meta?.closesAt || "10:30 PM"}.`
                      : `Closed now. Opens again tomorrow. Closing time is ${overview?.meta?.closesAt || "10:30 PM"}.`}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View
          style={{
            width: "100%",
            alignSelf: "center",
            maxWidth: CONTENT_MAX_WIDTH,
            paddingHorizontal: 18,
            paddingTop: 20,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 4 }}>
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
                label: "Equipments",
                value: overview?.summary?.equipmentInUse || 0,
                icon: "football-outline",
                toneBg: colors.primarySoft,
                toneFg: colors.primary,
              },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  width: statCardWidth,
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

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 4 }}>
            {tiles.map((tile) => (
              <TouchableOpacity
                key={tile.key}
                onPress={() => navigation.navigate(tile.routeName, { entrySource, location: route?.params?.location || "SAC" })}
                style={{
                  width: actionCardWidth,
                  marginBottom: 16,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 20,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tile.accentBg,
                    }}
                  >
                    <Ionicons name={tile.icon} size={28} color={tile.accentFg} />
                  </View>

                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      backgroundColor: colors.cardMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 12 }}>
                      {tile.value} {tile.valueLabel}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 22, marginTop: 18 }}>
                  {tile.title}
                </Text>
                <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
                  {tile.subtitle}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 18 }}>
                  <Text style={{ color: colors.primary, fontFamily: FONTS.bold, fontSize: 14 }}>Open section</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
