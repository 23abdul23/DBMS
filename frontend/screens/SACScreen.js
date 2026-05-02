import React, { useCallback, useMemo, useState } from "react"
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
import { useFocusEffect } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../context/ThemeContext"
import { sacAPI } from "../services/api"
import LoadingSpinner from "../components/LoadingSpinner"
import { FONTS } from "../utils/constants"
import { CONTENT_MAX_WIDTH, getTwoColumnCardWidth } from "../utils/responsiveLayout"

export default function SACScreen({ navigation, route }) {
  const { colors, isDarkMode, toggleTheme } = useTheme()
  const { width } = useWindowDimensions()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sacStatus, setSacStatus] = useState(null)

  const entrySource = route?.params?.entrySource || "manual"
  const actionCardWidth = getTwoColumnCardWidth(width)
  const isCompact = width < 520

  const loadSacData = useCallback(async (nextLoading = false) => {
    try {
      if (nextLoading) {
        setLoading(true)
      }

      const [overviewResult, statusResult] = await Promise.allSettled([sacAPI.getOverview(), sacAPI.getSacStatus()])

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value?.data?.overview || null)
      } else {
        console.log("SAC overview error:", overviewResult.reason?.response?.data || overviewResult.reason)
        Alert.alert(
          "SAC Error",
          overviewResult.reason?.response?.data?.message || "Unable to load SAC activity right now.",
        )
      }

      if (statusResult.status === "fulfilled") {
        setSacStatus(statusResult.value?.data || null)
      } else {
        console.log("SAC status error:", statusResult.reason?.response?.data || statusResult.reason)
        setSacStatus(null)
      }
    } catch (error) {
      console.log("SAC screen error:", error?.response?.data || error)
      Alert.alert("SAC Error", error?.response?.data?.message || "Unable to load SAC activity right now.")
    } finally {
      if (nextLoading) {
        setLoading(false)
      }
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadSacData(true)
    }, [loadSacData]),
  )

  const onRefresh = async () => {
    try {
      setRefreshing(true)
      await loadSacData(false)
    } finally {
      setRefreshing(false)
    }
  }

  const sacClosesAt = sacStatus?.closesAt || overview?.meta?.closesAt || "10:30 PM"
  const isSacOpenNow = sacStatus?.status ?? overview?.meta?.isOpenNow ?? false

  const handleNavigateToRooms = () => {
    if (!isSacOpenNow) {
      Alert.alert(
        "SAC Closed",
        sacStatus?.message || `SAC is closed right now. It remains open till ${sacClosesAt}.`,
        [{ text: "OK" }],
      )
      return
    }
    navigation.navigate("ClubRooms", { entrySource, location: route?.params?.location || "SAC" })
  }

  const handleNavigateToEquipments = () => {
    if (!isSacOpenNow) {
      Alert.alert(
        "SAC Closed",
        sacStatus?.message || `SAC is closed right now. It remains open till ${sacClosesAt}.`,
        [{ text: "OK" }],
      )
      return
    }
    navigation.navigate("Equipments", { entrySource, location: route?.params?.location || "SAC" })
  }

  const summary = overview?.summary || {}
  const myStatus = overview?.myStatus || {}
  const rooms = overview?.rooms || []
  const equipment = overview?.equipment || []

  const roomOccupancy = useMemo(() => {
    if (!rooms.length) {
      return 0
    }

    return rooms.filter((room) => room.isOpen).length
  }, [rooms])

  const equipmentActivity = useMemo(() => {
    if (!equipment.length) {
      return 0
    }

    return equipment.filter((item) => item.activeCount > 0).length
  }, [equipment])

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
            paddingBottom: 24,
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
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: entrySource === "qr" ? colors.successSoft : colors.warningSoft,
                  }}
                >
                  <Ionicons
                    name={entrySource === "qr" ? "qr-code-outline" : "color-wand-outline"}
                    size={28}
                    color={entrySource === "qr" ? colors.success : colors.warning}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 20, marginTop: 15 , marginLeft : 30}}>Shared Spaces</Text>
                </View>
              </View>

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
                <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 14 }}>
                  {isSacOpenNow
                    ? `SAC is open now until ${sacClosesAt}`
                    : `SAC is closed right now. Closing time remains ${sacClosesAt}`}
                </Text>
                <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 4 }}>
                  Open the club room and equipment sections to manage only your own participation.
                </Text>
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
            paddingTop: 18,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "nowrap", marginBottom: 4 }}>
            {[
              {
                label: "Open Rooms",
                value: summary.openRooms || 0,
                icon: "key-outline",
                toneBg: colors.warningSoft,
                toneFg: colors.warning,
              },
              {
                label: "Students Inside",
                value: summary.studentsInRooms || 0,
                icon: "people-outline",
                toneBg: colors.accentSoft,
                toneFg: colors.accent,
              },
              {
                label: "Equipments In Use",
                value: summary.equipmentInUse || 0,
                icon: "football-outline",
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
              borderRadius: 28,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18 }}>Your SAC status</Text>
            <View
              style={{
                flexDirection: "row",
                marginTop: 14,
              }}
            >
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12 }}>Rooms joined</Text>
                <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 28, marginTop: 6 }}>
                  {myStatus.activeRooms?.length || 0}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12 }}>Equipment with you</Text>
                <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 28, marginTop: 6 }}>
                  {myStatus.activeEquipment?.length || 0}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 4 }}>
            <TouchableOpacity
              onPress={handleNavigateToRooms}
              style={{
                width: actionCardWidth,
                backgroundColor: colors.cardElevated,
                borderRadius: 28,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 18,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.warningSoft,
                }}
              >
                <Ionicons name="key-outline" size={24} color={colors.warning} />
              </View>
              <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18, marginTop: 16 }}>Club Rooms</Text>
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
                Open rooms, see live occupancy counts, and manage your own room membership.
              </Text>
              <Text style={{ color: colors.warning, fontFamily: FONTS.bold, fontSize: 13, marginTop: 16 }}>
                {roomOccupancy} rooms active
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNavigateToEquipments}
              style={{
                width: actionCardWidth,
                backgroundColor: colors.cardElevated,
                borderRadius: 28,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 18,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primarySoft,
                }}
              >
                <Ionicons name="football-outline" size={24} color={colors.primary} />
              </View>
              <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18, marginTop: 16 }}>Equipments</Text>
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
                Check live checkout counts and update only the equipment currently assigned to you.
              </Text>
              <Text style={{ color: colors.primary, fontFamily: FONTS.bold, fontSize: 13, marginTop: 16 }}>
                {equipmentActivity} types active
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
