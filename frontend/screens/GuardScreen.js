"use client"

import {
  Alert,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { Picker } from "@react-native-picker/picker"
import { Ionicons } from "@expo/vector-icons"
import QRCode from "react-native-qrcode-svg"
import * as FileSystem from "expo-file-system/legacy"
import { captureRef } from "react-native-view-shot"
import { useTheme } from "../context/ThemeContext"
import { useAuth } from "../context/AuthContext"
import AllLocations from "../constants/SecuityLocations.json"
import api from "../services/api"
import LoadingSpinner from "../components/LoadingSpinner"
import { COLORS, FONTS, SIZES, SPACING } from "../utils/constants"
import { CONTENT_MAX_WIDTH, getTwoColumnCardWidth } from "../utils/responsiveLayout"

const locationOptions = [
  ...(Array.isArray(AllLocations.exit_gates) ? AllLocations.exit_gates : []),
  ...(Array.isArray(AllLocations.campus_buildings) ? AllLocations.campus_buildings : []),
  ...(Array.isArray(AllLocations.hostels) ? AllLocations.hostels : []),
]

const defaultLocation = locationOptions[0] || ""

const sanitizeFilePart = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const formatDateStamp = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Morning"
  if (hour < 17) return "Afternoon"
  return "Evening"
}

export default function GuardDashboardScreen({ navigation }) {
  const { isDarkMode, toggleTheme, colors } = useTheme()
  const { user, token, logout } = useAuth()
  const { width } = useWindowDimensions()

  const qrCardRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [loc, setLoc] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingQr, setSavingQr] = useState(false)

  const infoCardWidth = getTwoColumnCardWidth(width)
  const isCompact = width < 520
  const qrSize = width < 420 ? 180 : 210

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (!loc) {
      if (profile?.hostel) {
        setLoc(profile.hostel)
      } else if (defaultLocation) {
        setLoc(defaultLocation)
      }
    }
  }, [profile, loc])

  const qrPayload = useMemo(
    () =>
      JSON.stringify({
        guardName: user?.name,
        guardId: user?.guardId,
        location: loc,
      }),
    [loc, user?.guardId, user?.name],
  )

  const generatedDateLabel = useMemo(
    () =>
      new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [loc],
  )

  const quickActions = [
    {
      key: "logs",
      title: "Logs",
      icon: "document-text-outline",
      toneBg: colors.primarySoft,
      toneFg: colors.primary,
      onPress: () => navigation.navigate("LogBook", { location: loc }),
    },
    {
      key: "profile",
      title: "Profile",
      icon: "person-circle-outline",
      toneBg: colors.accentSoft,
      toneFg: colors.accent,
      onPress: () => navigation.navigate("Profile"),
    },
  ]

  const loadDashboardData = async () => {
    try {
      const res = await api.get("/auth/fetchProfile", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          user,
        },
      })

      setProfile(res.data.user)
    } catch (error) {
      console.log("Dashboard load error:", error)
      Alert.alert("Error", "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
  }

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ])
  }

  const handleDownloadQr = async () => {
    if (!loc) {
      Alert.alert("Location Required", "Please select a location before downloading the QR.")
      return
    }

    try {
      setSavingQr(true)
      const capturedUri = await captureRef(qrCardRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      })
      const now = new Date()
      const fileDate = formatDateStamp(now)
      const fileName = `aegis-qr-${sanitizeFilePart(loc) || "location"}-${fileDate}.png`
      const capturedBase64 = await FileSystem.readAsStringAsync(capturedUri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      if (Platform.OS === "android") {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()

        if (!permissions.granted) {
          Alert.alert("Download Cancelled", "Folder access is required to save the QR file.")
          return
        }

        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          "image/png",
        )

        await FileSystem.writeAsStringAsync(fileUri, capturedBase64, {
          encoding: FileSystem.EncodingType.Base64,
        })

        Alert.alert("QR Saved", `Saved ${fileName}`)
        return
      }

      const fallbackUri = `${FileSystem.documentDirectory}${fileName}`
      await FileSystem.writeAsStringAsync(fallbackUri, capturedBase64, {
        encoding: FileSystem.EncodingType.Base64,
      })

      Alert.alert("QR Saved", `Saved to ${fallbackUri}`)
    } catch (error) {
      console.log("QR download error:", error)
      Alert.alert("Download Failed", error?.message || "Unable to save the QR right now.")
    } finally {
      setSavingQr(false)
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
            paddingBottom: 24,
            backgroundColor: colors.header,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ width: "100%", alignSelf: "center", maxWidth: CONTENT_MAX_WIDTH }}>
            <View
              style={{
                borderRadius: 30,
                padding: 22,
                backgroundColor: colors.cardElevated,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, paddingRight: 14 }}>
                  <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 15 }}>
                    Good {getGreeting()}
                  </Text>
                  <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 30, marginTop: 6 }}>
                    {user?.name}
                  </Text>
                  <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 14, marginTop: 8 }}>
                    Guard ID: {user?.guardId || "-"}
                  </Text>
                  <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 14, marginTop: 4 }}>
                    Current stationed location: {profile?.hostel || profile?.securityPost || loc || "-"}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <TouchableOpacity
                    onPress={toggleTheme}
                    style={[
                      localStyles.roundIconButton,
                      {
                        backgroundColor: colors.cardMuted,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color={colors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      localStyles.roundIconButton,
                      {
                        marginTop: 12,
                        backgroundColor: colors.dangerSoft,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={handleLogout}
                  >
                    <Ionicons name="log-out-outline" size={22} color={colors.danger} />
                  </TouchableOpacity>
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
            paddingTop: 18,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "nowrap", marginBottom: 8 }}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={action.key}
                onPress={action.onPress}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  marginRight: index === 0 ? 10 : 0,
                  marginLeft: index === 1 ? 10 : 0,
                  borderRadius: 28,
                  paddingHorizontal: 18,
                  paddingTop: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.cardElevated,
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: action.toneBg,
                    }}
                  >
                    <Ionicons name={action.icon} size={24} color={action.toneFg} />
                  </View>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.cardMuted,
                    }}
                  >
                    <Ionicons name="arrow-forward" size={16} color={action.toneFg} />
                  </View>
                </View>

                <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 21, marginTop: 24 }}>
                  {action.title}
                </Text>
                <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 8, lineHeight: 19 }}>
                  {action.subtitle}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            <View
              style={{
                width: infoCardWidth,
                borderRadius: 28,
                padding: 20,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.cardElevated,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18 }}>QR For Location</Text>
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
                Gates need outpass checks after 6:00 PM.
              </Text>

              <View
                style={{
                  marginTop: 16,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.cardMuted,
                  overflow: "hidden",
                }}
              >
                <Picker selectedValue={loc} onValueChange={(value) => setLoc(value)} style={{ width: "100%", color: colors.text }}>
                  {locationOptions.map((location, index) => (
                    <Picker.Item key={`${location}-${index}`} label={location} value={location} />
                  ))}
                </Picker>
              </View>

              <View
                style={{
                  width: infoCardWidth,
                  borderRadius: 28,
                  padding: 20,
                  marginTop:20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.cardElevated,
                  marginBottom: 16,
                  alignItems: "center",
                }}
              >
                <View
                  ref={qrCardRef}
                  collapsable={false}
                  style={[localStyles.qrCard, { backgroundColor: COLORS.white, width: "100%" }]}
                >
                  <Text style={localStyles.qrCardTitle}>Guard QR</Text>
                  <Text style={localStyles.qrMeta}>Location: {loc || "-"}</Text>
                  <Text style={localStyles.qrMeta}>Date: {generatedDateLabel}</Text>
                  <Text style={localStyles.qrMeta}>Guard: {user?.name || "Guard"}</Text>
                  <View style={localStyles.qrCanvas}>
                    <QRCode value={qrPayload} size={qrSize} color={COLORS.gray[800]} backgroundColor={COLORS.white} />
                  </View>
                  <Text style={localStyles.qrNote}>Scan this QR at entry or exit checkpoints.</Text>
                </View>

                <TouchableOpacity
                  style={[
                    localStyles.downloadButton,
                    {
                      backgroundColor: colors.primary,
                      width: "100%",
                      opacity: savingQr ? 0.7 : 1,
                    },
                  ]}
                  onPress={handleDownloadQr}
                  disabled={savingQr}
                >
                  <Ionicons name="download-outline" size={18} color={colors.buttonTextOnPrimary} />
                  <Text style={[localStyles.downloadButtonText, { color: colors.buttonTextOnPrimary }]}>
                    {savingQr ? "Saving..." : "Download QR"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

              
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const localStyles = StyleSheet.create({
  roundIconButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  heroInfoCard: {
    flex: 1,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    minHeight: 100,
  },
  qrCard: {
    alignItems: "center",
    borderRadius: 24,
    padding: SPACING.xl,
    minHeight: 360,
    justifyContent: "center",
  },
  qrCardTitle: {
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
    color: COLORS.gray[800],
    marginBottom: 8,
  },
  qrMeta: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: COLORS.gray[700],
    marginBottom: 2,
    textAlign: "center",
  },
  qrCanvas: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  qrNote: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.gray[600],
    textAlign: "center",
    marginTop: SPACING.sm,
    maxWidth: 240,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  downloadButtonText: {
    marginLeft: 8,
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
})
