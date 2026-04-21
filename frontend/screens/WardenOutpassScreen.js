"use client"

import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { useTheme } from "../context/ThemeContext"
import { wardenAPI } from "../services/api"
import FilterTabs from "../components/FilterTabs"
import LoadingSpinner from "../components/LoadingSpinner"
import WardenOutpassCard from "../components/WardenOutpassCard"
import styles from "../styles/WardenStyles"

const filterDefinitions = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "ongoing", label: "Ongoing" },
  { key: "expired", label: "Expired" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
]

export default function WardenOutpassScreen() {
  const { isDarkMode, toggleTheme, colors } = useTheme()
  const [outpasses, setOutpasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")
  const [busyOutpassId, setBusyOutpassId] = useState(null)

  useEffect(() => {
    loadOutpasses()
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadOutpasses()
    }, []),
  )

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadOutpasses()
    }, 10000)

    return () => clearInterval(intervalId)
  }, [])

  const loadOutpasses = async () => {
    try {
      const response = await wardenAPI.getOutpasses({ limit: 100 })
      setOutpasses(response.data?.outpasses || [])
    } catch (error) {
      console.log("Warden outpass load error:", error?.response || error)
      Alert.alert("Error", error?.response?.data?.message || "Failed to load hostel outpasses")
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadOutpasses()
    setRefreshing(false)
  }

  const statusCounts = useMemo(() => {
    return outpasses.reduce(
      (accumulator, item) => {
        accumulator[item.status] = (accumulator[item.status] || 0) + 1
        if (item.monitoringState === "ongoing") {
          accumulator.ongoing = (accumulator.ongoing || 0) + 1
        }
        return accumulator
      },
      { ongoing: 0 },
    )
  }, [outpasses])

  const filterOptions = useMemo(
    () =>
      filterDefinitions.map((item) => ({
        ...item,
        count: item.key === "all" ? outpasses.length : statusCounts[item.key] || 0,
      })),
    [outpasses.length, statusCounts],
  )

  const filteredOutpasses = useMemo(() => {
    if (activeFilter === "all") {
      return outpasses
    }

    if (activeFilter === "ongoing") {
      return outpasses.filter((item) => item.monitoringState === "ongoing")
    }

    return outpasses.filter((item) => item.status === activeFilter)
  }, [activeFilter, outpasses])

  const handleAction = async (outpass, action) => {
    try {
      setBusyOutpassId(outpass.id)
      const response = await wardenAPI.actOnOutpass(outpass.id, { action })
      const updatedOutpass = response.data?.outpass
      setOutpasses((previous) => previous.map((item) => (item.id === updatedOutpass.id ? updatedOutpass : item)))
    } catch (error) {
      console.log("Warden action error:", error?.response || error)
      Alert.alert("Error", error?.response?.data?.message || "Failed to update outpass")
    } finally {
      setBusyOutpassId(null)
    }
  }

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={52} color={colors.subText} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No matching outpasses</Text>
      <Text style={[styles.emptyText, { color: colors.subText }]}>
        Requests from students in your hostel will appear here.
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
            <Text style={[styles.headerTitle, { color: colors.text }]}>Outpass Requests</Text>
            <Text style={[styles.headerSubtitle, { color: colors.subText }]}>
              Review, approve, reject, and cancel hostel outpasses.
            </Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={{ padding: 8 }}>
            <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FilterTabs options={filterOptions} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <FlatList
        data={filteredOutpasses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <WardenOutpassCard
            outpass={item}
            colors={colors}
            onAction={handleAction}
            isBusy={busyOutpassId === item.id}
          />
        )}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  )
}
