"use client"

import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { useTheme } from "../context/ThemeContext"
import { wardenAPI } from "../services/api"
import FilterTabs from "../components/FilterTabs"
import LoadingSpinner from "../components/LoadingSpinner"
import WardenMonitoringCard from "../components/WardenMonitoringCard"
import styles from "../styles/WardenStyles"

const filters = [
  { key: "all", label: "All" },
  { key: "pending_review", label: "Pending" },
  { key: "awaiting_exit", label: "Awaiting Exit" },
  { key: "ongoing", label: "Outside" },
  { key: "overdue", label: "Overdue" },
  { key: "inside", label: "Inside" },
]

export default function WardenMonitoringScreen() {
  const { isDarkMode, toggleTheme, colors } = useTheme()
  const [monitoring, setMonitoring] = useState([])
  const [counts, setCounts] = useState({})
  const [activeFilter, setActiveFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadMonitoring()
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadMonitoring()
    }, []),
  )

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadMonitoring()
    }, 10000)

    return () => clearInterval(intervalId)
  }, [])

  const loadMonitoring = async () => {
    try {
      const response = await wardenAPI.getMonitoring()
      setMonitoring(response.data?.monitoring || [])
      setCounts(response.data?.counts || {})
    } catch (error) {
      console.log("Warden monitoring error:", error?.response || error)
      Alert.alert("Error", error?.response?.data?.message || "Failed to load monitoring data")
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadMonitoring()
    setRefreshing(false)
  }

  const filteredMonitoring = useMemo(() => {
    if (activeFilter === "all") {
      return monitoring
    }

    return monitoring.filter((item) => item.monitoringState === activeFilter)
  }, [activeFilter, monitoring])

  const filterOptions = useMemo(
    () =>
      filters.map((item) => ({
        ...item,
        count: item.key === "all" ? monitoring.length : counts[item.key] || 0,
      })),
    [counts, monitoring.length],
  )

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="pulse-outline" size={52} color={colors.subText} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No monitoring records</Text>
      <Text style={[styles.emptyText, { color: colors.subText }]}>
        Students from your hostel will appear here once they request or use outpasses.
      </Text>
    </View>
  )

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Student Monitoring</Text>
            <Text style={[styles.headerSubtitle, { color: colors.subText }]}>
              Track who is waiting, outside, overdue, or back inside.
            </Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={{ padding: 8 }}>
            <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FilterTabs options={filterOptions} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <FlatList
        data={filteredMonitoring}
        keyExtractor={(item) => item.student.id}
        renderItem={({ item }) => <WardenMonitoringCard entry={item} colors={colors} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  )
}
