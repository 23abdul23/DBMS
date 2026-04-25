"use client"

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Platform } from "react-native"
import { useMemo, useRef, useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "../context/AuthContext"
import { Picker } from "@react-native-picker/picker"
import QRCode from "react-native-qrcode-svg"
import * as FileSystem from "expo-file-system/legacy"
import styles from "../styles/DashboardStyles"
import AllLocations from "../constants/SecuityLocations.json"
import api from "../services/api"
import LoadingSpinner from "../components/LoadingSpinner"
import { COLORS, FONTS, SIZES, SPACING } from "../utils/constants"

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

const escapeXml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

const formatDateStamp = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`
}

const buildQrSvgMarkup = ({ qrBase64, location, generatedAt, guardName, guardId }) => {
  const width = 640
  const height = 860
  const safeLocation = escapeXml(location)
  const safeGeneratedAt = escapeXml(generatedAt)
  const safeGuardName = escapeXml(guardName)
  const safeGuardId = escapeXml(guardId)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ffffff" rx="28" ry="28" />
  <text x="50%" y="86" text-anchor="middle" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="#111827">Aegis Guard QR</text>
  <text x="50%" y="138" text-anchor="middle" font-size="24" font-family="Arial, sans-serif" fill="#374151">Location: ${safeLocation}</text>
  <text x="50%" y="178" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" fill="#6b7280">Generated: ${safeGeneratedAt}</text>
  <text x="50%" y="214" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" fill="#6b7280">Guard: ${safeGuardName}${safeGuardId ? ` (${safeGuardId})` : ""}</text>
  <rect x="120" y="260" width="400" height="400" rx="20" ry="20" fill="#f8fafc" />
  <image href="data:image/png;base64,${qrBase64}" x="170" y="310" width="300" height="300" />
  <text x="50%" y="738" text-anchor="middle" font-size="22" font-family="Arial, sans-serif" fill="#4b5563">Scan this QR at entry or exit</text>
</svg>`
}

export default function GuardDashboardScreen({ navigation }) {
  const { isDarkMode, toggleTheme, colors } = useTheme()
  const { user, token, logout } = useAuth()

  const qrRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [loc, setLoc] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingQr, setSavingQr] = useState(false)

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

  const getQrBase64 = () =>
    new Promise((resolve, reject) => {
      if (!qrRef.current?.toDataURL) {
        reject(new Error("QR reference unavailable"))
        return
      }

      qrRef.current.toDataURL((data) => {
        if (!data) {
          reject(new Error("Unable to generate QR image"))
          return
        }

        resolve(data)
      })
    })

  const handleDownloadQr = async () => {
    if (!loc) {
      Alert.alert("Location Required", "Please select a location before downloading the QR.")
      return
    }

    try {
      setSavingQr(true)
      const qrBase64 = await getQrBase64()
      const now = new Date()
      const fileDate = formatDateStamp(now)
      const fileName = `aegis-qr-${sanitizeFilePart(loc) || "location"}-${fileDate}.svg`
      const svgMarkup = buildQrSvgMarkup({
        qrBase64,
        location: loc,
        generatedAt: now.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        guardName: user?.name || "Guard",
        guardId: user?.guardId || "",
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
          "image/svg+xml",
        )

        await FileSystem.writeAsStringAsync(fileUri, svgMarkup, {
          encoding: FileSystem.EncodingType.UTF8,
        })

        Alert.alert("QR Saved", `Saved ${fileName}`)
        return
      }

      const fallbackUri = `${FileSystem.documentDirectory}${fileName}`
      await FileSystem.writeAsStringAsync(fallbackUri, svgMarkup, {
        encoding: FileSystem.EncodingType.UTF8,
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
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>Good {getGreeting()}</Text>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.name}</Text>
            <Text style={[styles.userRole, { color: colors.subText }]}>Current Stationed Location: {profile?.hostel || "-"}</Text>
          </View>

          <View>
            <TouchableOpacity onPress={toggleTheme}>
              <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={28} color="#f44336" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={[styles.content, localStyles.centerContent]}>
        <View style={localStyles.centerRow}>
          <TouchableOpacity
            style={[localStyles.actionCard, { backgroundColor: isDarkMode ? "#e8f5e9" : "#f1f8f3" }]}
            onPress={() => navigation.navigate("Scan", { location: loc })}
            activeOpacity={0.8}
          >
            <View style={[localStyles.actionIcon, { backgroundColor: "#4caf50" }]}>
              <Ionicons name="scan" size={24} color="#fff" />
            </View>
            <Text style={[localStyles.actionText, { color: colors.subText }]}>Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[localStyles.actionCard, { backgroundColor: isDarkMode ? "#ede9fe" : "#f3e8ff" }]}
            onPress={() => navigation.navigate("LogBook", { location: loc })}
            activeOpacity={0.8}
          >
            <View style={[localStyles.actionIcon, { backgroundColor: "#7c3aed" }]}>
              <Ionicons name="document-text" size={24} color="#fff" />
            </View>
            <Text style={[localStyles.actionText, { color: colors.subText }]}>Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[localStyles.actionCard, { backgroundColor: isDarkMode ? "#e0f2fe" : "#eff6ff" }]}
            onPress={() => navigation.navigate("Profile")}
            activeOpacity={0.8}
          >
            <View style={[localStyles.actionIcon, { backgroundColor: "#2563eb" }]}>
              <Ionicons name="person-circle" size={24} color="#fff" />
            </View>
            <Text style={[localStyles.actionText, { color: colors.subText }]}>Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={localStyles.pickerWrapper}>
          <Text style={[localStyles.sectionTitle, { color: colors.text }]}>QR For Location</Text>
          <Text style={[localStyles.sectionHint, { color: colors.subText }]}>
            Gates need outpass checks after 6:00 PM. Buildings and hostels are internal campus locations.
          </Text>
          <View style={[localStyles.pickerCard, { backgroundColor: colors.card, borderColor: colors.subText }]}>
            <Picker selectedValue={loc} onValueChange={(value) => setLoc(value)} style={{ width: "100%" }}>
              {locationOptions.map((location, index) => (
                <Picker.Item key={`${location}-${index}`} label={location} value={location} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={localStyles.qrWrapper}>
          <View style={[localStyles.qrCardLarge, { backgroundColor: COLORS.white }]}>
            <Text style={localStyles.qrCardTitle}>Guard QR</Text>
            <Text style={localStyles.qrMeta}>Location: {loc || "-"}</Text>
            <Text style={localStyles.qrMeta}>Date: {generatedDateLabel}</Text>
            <Text style={localStyles.qrMeta}>Guard: {user?.name || "Guard"}</Text>
            <View style={localStyles.qrCanvas}>
              <QRCode
                getRef={(ref) => {
                  qrRef.current = ref
                }}
                value={qrPayload}
                size={200}
                color={COLORS.gray[800]}
                backgroundColor={COLORS.white}
              />
            </View>
            <Text style={localStyles.qrNote}>Scan this QR at entry/exit</Text>
            <TouchableOpacity style={localStyles.downloadButton} onPress={handleDownloadQr} disabled={savingQr}>
              <Ionicons name="download-outline" size={18} color={COLORS.white} />
              <Text style={localStyles.downloadButtonText}>{savingQr ? "Saving..." : "Download QR"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Morning"
  if (hour < 17) return "Afternoon"
  return "Evening"
}

const localStyles = StyleSheet.create({
  centerContent: {
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  centerRow: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 160,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginHorizontal: 6,
    marginBottom: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    fontFamily: FONTS.regular,
  },
  pickerWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    alignSelf: "flex-start",
    marginBottom: 8,
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  sectionHint: {
    alignSelf: "flex-start",
    marginBottom: 8,
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
  },
  pickerCard: {
    width: "100%",
    borderRadius: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  qrWrapper: {
    width: "100%",
    alignItems: "center",
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  qrCardLarge: {
    alignItems: "center",
    borderRadius: 24,
    padding: SPACING.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    minWidth: 300,
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
    maxWidth: 220,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  downloadButtonText: {
    marginLeft: 8,
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
})
