"use client"

import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native"
import { useCallback, useEffect, useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { useTheme } from "../context/ThemeContext"
import { useAuth } from "../context/AuthContext"
import { wardenAPI } from "../services/api"
import LoadingSpinner from "../components/LoadingSpinner"
import styles from "../styles/WardenStyles"

const statCards = [
  { key: "dangerAlerts", label: "Danger", color: "#fee2e2", textColor: "#991b1b" },
  { key: "yellowAlerts", label: "Yellow", color: "#fef3c7", textColor: "#92400e" },
  { key: "pendingRequests", label: "Pending Requests", color: "#fef3c7", textColor: "#92400e" },
  { key: "approvedRequests", label: "Approved", color: "#dcfce7", textColor: "#166534" },
  { key: "ongoingCount", label: "Currently Outside", color: "#ede9fe", textColor: "#5b21b6" },
  { key: "overdueRequests", label: "Overdue", color: "#fee2e2", textColor: "#991b1b" },
  { key: "returnedToday", label: "Returned Today", color: "#e0f2fe", textColor: "#075985" },
  { key: "totalStudents", label: "Hostel Students", color: "#f3f4f6", textColor: "#111827" },
]

export default function WardenDashboardScreen({ navigation }) {
  const { isDarkMode, toggleTheme, colors } = useTheme()
  const { user, logout } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadDashboard()
    }, []),
  )

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadDashboard()
    }, 10000)

    return () => clearInterval(intervalId)
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await wardenAPI.getDashboard()
      setDashboard(response.data)
    } catch (error) {
      console.log("Warden dashboard error:", error?.response || error)
      Alert.alert("Error", error?.response?.data?.message || "Failed to load warden dashboard")
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadDashboard()
    setRefreshing(false)
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Warden Dashboard</Text>
            <Text style={[styles.headerSubtitle, { color: colors.subText }]}>
              {user?.name} | Hostel {dashboard?.hostel || user?.hostel || "-"}
            </Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            <TouchableOpacity onPress={toggleTheme} style={{ padding: 8, marginRight: 8 }}>
              <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={logout} style={{ padding: 8 }}>
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Overview</Text>
          <View style={styles.statGrid}>
            {statCards.map((card) => (
              <View key={card.key} style={[styles.statCard, { backgroundColor: card.color }]}>
                <Text style={[styles.statLabel, { color: card.textColor }]}>{card.label}</Text>
                <Text style={[styles.statValue, { color: card.textColor }]}>
                  {dashboard?.stats?.[card.key] ?? 0}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.cardRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Pending Requests</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Requests")}>
              <Text style={{ color: "#2563eb", fontWeight: "600" }}>View All</Text>
            </TouchableOpacity>
          </View>
          {dashboard?.recentPending?.length ? (
            dashboard.recentPending.map((item) => (
              <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.user?.name}</Text>
                <Text style={[styles.metaText, { color: colors.subText }]}>
                  {item.reason} | {item.destination}
                </Text>
                <Text style={[styles.metaText, { color: colors.subText }]}>
                  Departure: {new Date(item.outDate).toLocaleString()}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-outline" size={36} color={colors.subText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No pending approvals</Text>
              <Text style={[styles.emptyText, { color: colors.subText }]}>
                New requests from your hostel will appear here.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.cardRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Live Monitoring</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Monitoring")}>
              <Text style={{ color: "#2563eb", fontWeight: "600" }}>Open</Text>
            </TouchableOpacity>
          </View>
          {dashboard?.activeMonitoring?.length ? (
            dashboard.activeMonitoring.map((item) => (
              <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.user?.name}</Text>
                <Text style={[styles.metaText, { color: colors.subText }]}>
                  {String(item.monitoringState || "").split("_").join(" ")} | {item.destination}
                </Text>
                <Text style={[styles.metaText, { color: colors.subText }]}>
                  Return By: {new Date(item.expectedReturnDate).toLocaleString()}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={36} color={colors.subText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No active alerts</Text>
              <Text style={[styles.emptyText, { color: colors.subText }]}>
                Students in danger, yellow alert, outside, overdue, or awaiting exit will be listed here.
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  )
}
