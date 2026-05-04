"use client"

import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, ImageBackground } from "react-native"
import { useState, useEffect, useMemo } from "react"
import { useTheme } from "../context/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "../context/AuthContext"
import { outpass } from "../services/api"
import styles from "../styles/DashboardStyles"
import LoadingSpinner from "../components/LoadingSpinner"

const QUICK_ACTIONS = [
  {
    key: "scan",
    title: "Scan",
    subtitle: "Verify movement, QR checkpoints, and entry flow.",
    icon: "scan",
    arrowColorKey: "success",
    iconBgKey: "successSoft",
    iconFgKey: "success",
    onPress: (navigation) => navigation.navigate("Scan"),
  },
  {
    key: "library",
    title: "Library",
    subtitle: "Track occupancy, tokens, and your own live library status.",
    icon: "book",
    arrowColorKey: "primary",
    iconBgKey: "primarySoft",
    iconFgKey: "primary",
    onPress: (navigation) => navigation.navigate("Library"),
  },
  {
    key: "sac",
    title: "SAC",
    subtitle: "Club rooms and equipment counts with privacy-safe activity access.",
    icon: "color-wand-outline",
    arrowColorKey: "warning",
    iconBgKey: "warningSoft",
    iconFgKey: "warning",
    onPress: (navigation) => navigation.navigate("SAC"),
  },
  {
    key: "outpass",
    title: "Use Outpass",
    subtitle: "Start the approved exit flow when your pass is active.",
    icon: "log-out-outline",
    arrowColorKey: "accent",
    iconBgKey: "accentSoft",
    iconFgKey: "accent",
  },
]

export default function DashboardScreen({ navigation }) {
  const { isDarkMode, toggleTheme, colors } = useTheme()
  const { user, logout } = useAuth()
  const [currentOutpass, setCurrentOutpass] = useState(null)
  const [stats, setStats] = useState({
    totalOutpasses: 0,
    activeOutpasses: 0,
    pendingOutpasses: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const outpassesResponse = await outpass.getOutpasses()
      const nextOutpass = outpassesResponse.data?.outpass || null

      setCurrentOutpass(nextOutpass)

      if (nextOutpass?.auditTrail) {
        const auditTrail = nextOutpass.auditTrail
        setStats({
          totalOutpasses: auditTrail.length,
          activeOutpasses: auditTrail.filter((entry) => entry.status === "approved").length,
          pendingOutpasses: auditTrail.filter((entry) => entry.status === "pending").length,
        })
      } else {
        setStats({
          totalOutpasses: 0,
          activeOutpasses: 0,
          pendingOutpasses: 0,
        })
      }
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

  const handleUseOutpass = async () => {
    try {
      const activeOutpass = currentOutpass || (await outpass.getOutpasses()).data?.outpass

      if (!activeOutpass) {
        Alert.alert("No Outpass", "You do not have a current outpass to use.")
        return
      }

      if ((activeOutpass.requestType || activeOutpass.type) === "long_visit") {
        Alert.alert(
          "Long Visit Request",
          "Long visit requests are handled physically by the warden and are not used through the standard QR outpass flow.",
        )
        return
      }

      if (!activeOutpass.canUseOutpass) {
        Alert.alert("Outpass Not Usable", "Your approved regular outpass is not currently usable for exit.")
        return
      }

      navigation.navigate("Scan")
    } catch (error) {
      console.log("Use outpass error:", error)
      Alert.alert("Error", "Unable to load your current outpass right now.")
    }
  }

  const quickActions = useMemo(
    () =>
      QUICK_ACTIONS.map((action) => ({
        ...action,
        onPress:
          action.key === "outpass"
            ? handleUseOutpass
            : () => action.onPress?.(navigation),
      })),
    [navigation, currentOutpass],
  )

  const outpassStatus = currentOutpass
    ? currentOutpass.canUseOutpass
      ? "Ready to use"
      : currentOutpass.status === "pending"
        ? "Pending approval"
        : currentOutpass.status === "approved"
          ? "Approved"
          : "Inactive"
    : "No active pass"

  const outpassMeta = currentOutpass
    ? currentOutpass.destination || currentOutpass.reason || "Current outpass available"
    : "Generate one from the Outpass tab when needed."

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
      <ScrollView
        style={[styles.container, { backgroundColor: "transparent" }]}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.heroShell}>
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.cardElevated,
              borderColor: colors.border,
              shadowColor: colors.shadowStrong,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={[styles.greeting, { color: isDarkMode ? "rgba(248,251,255,0.74)" : colors.subText }]}>
                Good {getGreeting()}
              </Text>
              <Text style={[styles.userName, { color: isDarkMode ? "#ffffff" : colors.heading }]}>{user?.name}</Text>
              <Text style={[styles.studentId, { color: isDarkMode ? "rgba(248,251,255,0.72)" : colors.subText }]}>
                {user?.studentId || "Student"}{user?.hostel ? `  |  ${user.hostel}` : ""}
              </Text>
            </View>

            <View style={styles.heroRightRail}>
              <TouchableOpacity
                onPress={toggleTheme}
                style={[
                  styles.roundIconButton,
                  {
                    backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : colors.cardMuted,
                    borderColor: isDarkMode ? "rgba(255,255,255,0.12)" : colors.border,
                  },
                ]}
              >
                <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={isDarkMode ? "#ffffff" : colors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roundIconButton,
                  styles.logoutButton,
                  {
                    backgroundColor: isDarkMode ? "rgba(220,38,38,0.14)" : colors.dangerSoft,
                    borderColor: isDarkMode ? "rgba(248,113,113,0.22)" : colors.border,
                  },
                ]}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={24} color={isDarkMode ? "#fda4af" : colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.quickActions}>
          <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: "#F5F5F5" }]}>Quick Actions</Text> 
          </View>

          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: colors.cardElevated + "E0",
                    borderColor: colors.border,
                    shadowColor: colors.shadow,
                    borderRadius: 18,
                    shadowOpacity: 0.08,
                    shadowOffset: { width: 0, height: 2 },
                    shadowRadius: 8,
                    elevation: 3,
                  },
                ]}
                onPress={action.onPress}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.actionIcon, { backgroundColor: colors[action.iconBgKey] }]}>
                    <Ionicons name={action.icon} size={22} color={colors[action.iconFgKey]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionText, { color: "#0F0F0F", fontWeight: "800" }]}>{action.title}</Text>
                    <Text style={[styles.actionSubText, { color: colors.subText }]} numberOfLines={1}>{action.subtitle}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

    </ScrollView>
    </ImageBackground>
  )
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Morning"
  if (hour < 17) return "Afternoon"
  return "Evening"
}
