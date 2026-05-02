import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  ScrollView,
  StyleSheet,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { Picker } from "@react-native-picker/picker"
import { useTheme } from "../context/ThemeContext"
import { useAuth } from "../context/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import { securityAPI } from "../services/api"
import { COLORS, FONTS, SIZES, SPACING } from "../utils/constants"

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_3_days", label: "Last 3 Days" },
  { key: "last_week", label: "Last Week" },
  { key: "last_month", label: "Last Month" },
  { key: "custom_month", label: "Choose Month" },
]

const PAGE_SIZE = 20

export default function LogBook({ navigation, route }) {
  const { isDarkMode, toggleTheme, colors } = useTheme()
  const { token } = useAuth()

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [activeRangeLabel, setActiveRangeLabel] = useState("Today")
  const [rangePreset, setRangePreset] = useState("today")
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const now = useMemo(() => new Date(), [])
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1))
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()))

  const location = route?.params?.location || ""

  const displayedLocation = useMemo(() => {
    return location && location.trim().length > 0 ? location : "All Locations"
  }, [location])

  const monthOptions = useMemo(
    () => [
      { label: "January", value: "1" },
      { label: "February", value: "2" },
      { label: "March", value: "3" },
      { label: "April", value: "4" },
      { label: "May", value: "5" },
      { label: "June", value: "6" },
      { label: "July", value: "7" },
      { label: "August", value: "8" },
      { label: "September", value: "9" },
      { label: "October", value: "10" },
      { label: "November", value: "11" },
      { label: "December", value: "12" },
    ],
    [],
  )

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, index) => String(currentYear - index))
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 350)

    return () => clearTimeout(timeoutId)
  }, [searchInput])

  const buildParams = useCallback(
    (pageToLoad) => {
      const params = {
        page: pageToLoad,
        limit: PAGE_SIZE,
        rangePreset,
      }

      if (location && location.trim().length > 0) {
        params.location = location.trim()
      }

      if (debouncedSearch) {
        params.search = debouncedSearch
      }

      if (rangePreset === "custom_month") {
        params.month = selectedMonth
        params.year = selectedYear
      }

      return params
    },
    [debouncedSearch, location, rangePreset, selectedMonth, selectedYear],
  )

  const fetchLogs = useCallback(
    async (pageToLoad = 1, replace = true) => {
      if (!token) {
        setError("Authentication token missing. Please log in again.")
        return
      }

      const isInitialLoad = replace && pageToLoad === 1 && !refreshing

      if (isInitialLoad) {
        setLoading(true)
      } else if (replace) {
        setRefreshing(true)
      } else {
        setLoadingMore(true)
      }

      try {
        const response = await securityAPI.getLogs(buildParams(pageToLoad), token)
        const payload = response.data || {}
        const nextLogs = payload.logs || []

        setLogs((prev) => (replace ? nextLogs : [...prev, ...nextLogs]))
        setPage(payload.page || pageToLoad)
        setTotal(payload.total || 0)
        setHasMore(Boolean(payload.hasMore))
        setActiveRangeLabel(payload.activeRangeLabel || "Today")
        setError(null)
      } catch (err) {
        console.log("LogBook fetch error:", err?.response || err)
        const serverMessage = err?.response?.data?.message
        setError(serverMessage || err?.message || "Unable to load logs right now")
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [buildParams, refreshing, token],
  )

  useFocusEffect(
    useCallback(() => {
      fetchLogs(1, true)
    }, [fetchLogs]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchLogs(1, true)
  }, [fetchLogs])

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore || refreshing) {
      return
    }

    await fetchLogs(page + 1, false)
  }, [fetchLogs, hasMore, loading, loadingMore, page, refreshing])

  const activeRangeText = useMemo(() => {
    if (rangePreset !== "custom_month") {
      return activeRangeLabel
    }

    const selectedMonthLabel = monthOptions.find((item) => item.value === selectedMonth)?.label || "Month"
    return `${selectedMonthLabel} ${selectedYear}`
  }, [activeRangeLabel, monthOptions, rangePreset, selectedMonth, selectedYear])

  const renderLog = useCallback(
    ({ item }) => {
      const actionLabels = {
        entry: "Entry",
        exit: "Exit",
        without_outpass: "Exit Attempted",
        outpass_used: "Outpass Used",
        outpass_status_changed: "Outpass Status Changed",
        sac_room_opened: "SAC Room Opened",
        sac_room_joined: "SAC Room Joined",
        sac_room_left: "SAC Room Left",
        sac_equipment_taken: "SAC Equipment Taken",
        sac_equipment_returned: "SAC Equipment Returned",
        library_seat_taken: "Library Token Taken",
        library_seat_released: "Library Token Released",
      }
      const actionColors = {
        entry: COLORS.success,
        exit: COLORS.error,
        without_outpass: COLORS.warning,
        outpass_used: "#7c3aed",
        outpass_status_changed: "#f59e0b",
        sac_room_opened: "#d97706",
        sac_room_joined: "#2563eb",
        sac_room_left: "#64748b",
        sac_equipment_taken: "#059669",
        sac_equipment_returned: "#0f766e",
        library_seat_taken: "#7c3aed",
        library_seat_released: "#6b7280",
      }
      const actionLabel = actionLabels[item.action] || item.action
      const residentName = item?.user?.name || item?.details?.scannedUserName || "Resident"
      const residentStudentId = item?.user?.studentId || item?.details?.scannedStudentId || "-"
      const residentSystemId = item?.user?.id || item?.userId || item?.details?.scannedUserId || "-"
      const guardOnDuty = item.guardName || "Guard"
      const timestamp = item?.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown"
      const actionColor = actionColors[item.action] || COLORS.warning

      return (
        <View style={[styles.logCard, { backgroundColor: colors.card, borderLeftColor: actionColor }]}>
          <View style={styles.logHeader}>
            <Text style={[styles.logTitle, { color: colors.text }]}>{actionLabel}</Text>
            <Text style={[styles.logTime, { color: colors.subText }]}>{timestamp}</Text>
          </View>
          <Text style={[styles.logMeta, { color: colors.text }]}>Name: {residentName}</Text>
          <Text style={[styles.logMeta, { color: colors.text }]}>Roll No: {residentStudentId}</Text>
          <Text style={[styles.logMeta, { color: colors.text }]}>User ID: {residentSystemId}</Text>
          <Text style={[styles.logMeta, { color: colors.text }]}>Guard: {guardOnDuty}</Text>
          <Text style={[styles.logMeta, { color: colors.text }]}>Location: {item.location || "-"}</Text>
          {item?.details?.reason ? <Text style={[styles.logMeta, { color: colors.text }]}>Reason: {item.details.reason}</Text> : null}
          {item?.details?.description ? (
            <Text style={[styles.logMeta, { color: colors.text }]}>Description: {item.details.description}</Text>
          ) : null}
        </View>
      )
    },
    [colors.card, colors.subText, colors.text],
  )

  const headerComponent = (
    <View style={styles.headerBlock}>
      <View style={styles.summaryBlock}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Location: {displayedLocation}</Text>
        <Text style={[styles.summaryText, { color: colors.subText }]}>Range: {activeRangeText}</Text>
        <Text style={[styles.summaryText, { color: colors.subText }]}>Showing {logs.length} of {total} record(s)</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <View style={[styles.filterCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.filterTitle, { color: colors.text }]}>Filter Logs</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {RANGE_OPTIONS.map((option) => {
            const active = option.key === rangePreset
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => setRangePreset(option.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? COLORS.primary : colors.background,
                    borderColor: active ? COLORS.primary : colors.subText,
                  },
                ]}
              >
                <Text style={[styles.filterChipText, { color: active ? COLORS.white : colors.text }]}>{option.label}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {rangePreset === "custom_month" ? (
          <View style={styles.monthPickerRow}>
            <View style={[styles.pickerShell, styles.pickerShellLeft, { borderColor: colors.subText }]}>
              <Picker selectedValue={selectedMonth} onValueChange={(value) => setSelectedMonth(String(value))}>
                {monthOptions.map((option) => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </View>
            <View style={[styles.pickerShell, { borderColor: colors.subText }]}>
              <Picker selectedValue={selectedYear} onValueChange={(value) => setSelectedYear(String(value))}>
                {yearOptions.map((option) => (
                  <Picker.Item key={option} label={option} value={option} />
                ))}
              </Picker>
            </View>
          </View>
        ) : null}

        <View style={[styles.searchBox, { borderColor: colors.subText, backgroundColor: colors.background }]}>
          <Ionicons name="search-outline" size={18} color={colors.subText} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search by roll number or name"
            placeholderTextColor={colors.subText}
            style={[styles.searchInput, { color: colors.text }]}
            autoCapitalize="none"
          />
          {searchInput ? (
            <TouchableOpacity onPress={() => setSearchInput("")}>
              <Ionicons name="close-circle" size={18} color={colors.subText} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  )

  const listEmptyComponent = !loading ? (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={40} color={colors.subText} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No logs found</Text>
      <Text style={[styles.emptyText, { color: colors.subText }]}>Try a different date range or search term.</Text>
    </View>
  ) : null

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Entry Exit Logs</Text>
        <TouchableOpacity onPress={toggleTheme}>
          <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <LoadingSpinner
            variant="panel"
            label="Loading entry and exit logs"
            sublabel="Fetching the latest campus movement records for this view."
            statusText="Aegis is assembling the filtered logbook feed."
            showThemeToggle={false}
          />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderLog}
          ListHeaderComponent={headerComponent}
          ListEmptyComponent={listEmptyComponent}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={onLoadMore}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <LoadingSpinner variant="inline" label="Loading more logs" />
              </View>
            ) : hasMore ? (
              <TouchableOpacity onPress={onLoadMore} style={styles.loadMoreButton}>
                <Text style={styles.loadMoreText}>Load More</Text>
              </TouchableOpacity>
            ) : logs.length > 0 ? (
              <Text style={[styles.endText, { color: colors.subText }]}>No more logs to load</Text>
            ) : null
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingTop: 48,
    paddingBottom: SPACING.md,
  },
  screenTitle: {
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: SPACING.xl,
  },
  headerBlock: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  summaryBlock: {
    marginBottom: SPACING.md,
  },
  summaryTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginBottom: 2,
  },
  errorText: {
    color: COLORS.error,
    marginTop: 6,
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
  },
  filterCard: {
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  filterTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.sm,
  },
  chipRow: {
    paddingVertical: 2,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
  },
  monthPickerRow: {
    flexDirection: "row",
    marginTop: SPACING.sm,
  },
  pickerShell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  pickerShellLeft: {
    marginRight: 10,
  },
  searchBox: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
  },
  logCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 14,
    padding: SPACING.md,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  logTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
  },
  logTime: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    flexShrink: 1,
    textAlign: "right",
  },
  logMeta: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginBottom: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    marginTop: 10,
  },
  emptyText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginTop: 6,
    textAlign: "center",
  },
  footerLoader: {
    paddingVertical: SPACING.md,
  },
  loadMoreButton: {
    marginTop: SPACING.sm,
    alignSelf: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  loadMoreText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
  endText: {
    textAlign: "center",
    paddingVertical: SPACING.md,
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
  },
})

