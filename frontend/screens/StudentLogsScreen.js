"use client"

import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { useTheme } from "../context/ThemeContext"
import LoadingSpinner from "../components/LoadingSpinner"
import { studentAPI } from "../services/api"
import { COLORS, FONTS, SIZES, SPACING } from "../utils/constants"

const PAGE_SIZE = 20

const ACTION_META = {
  entry: { label: "Entry", color: COLORS.success },
  exit: { label: "Exit", color: COLORS.warning },
  without_outpass: { label: "Exit Attempted", color: COLORS.error },
  outpass_request: { label: "Outpass Requested", color: "#7c3aed" },
  outpass_long_visit: { label: "Long Visit Request", color: "#0f766e" },
  outpass_used: { label: "Outpass Used", color: COLORS.primary },
  outpass_status_changed: { label: "Outpass Status Changed", color: "#f59e0b" },
  sac_room_opened: { label: "SAC Room Opened", color: "#d97706" },
  sac_room_joined: { label: "SAC Room Joined", color: "#2563eb" },
  sac_room_left: { label: "SAC Room Left", color: "#64748b" },
  sac_equipment_taken: { label: "SAC Equipment Taken", color: "#059669" },
  sac_equipment_returned: { label: "SAC Equipment Returned", color: "#0f766e" },
  library_seat_taken: { label: "Library Token Taken", color: "#7c3aed" },
  library_seat_released: { label: "Library Token Released", color: "#6b7280" },
}

const isOutpassAction = (action) =>
  ["without_outpass", "outpass_request", "outpass_long_visit", "outpass_used", "outpass_status_changed"].includes(action)

const formatDateTime = (value) => {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString()
}

export default function StudentLogsScreen() {
  const { colors } = useTheme()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState(null)

  const loadLogs = useCallback(async (pageToLoad = 1, replace = true) => {
    if (replace && pageToLoad === 1) {
      setLoading(true)
    } else if (replace) {
      setRefreshing(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const response = await studentAPI.getLogs({ page: pageToLoad, limit: PAGE_SIZE })
      const payload = response.data || {}
      const nextLogs = Array.isArray(payload.logs) ? payload.logs : []

      setLogs((current) => (replace ? nextLogs : [...current, ...nextLogs]))
      setPage(payload.page || pageToLoad)
      setHasMore(Boolean(payload.hasMore))
      setError(null)
    } catch (loadError) {
      setError(loadError?.response?.data?.message || "Unable to load student logs right now")
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useFocusEffect(
    useCallback(() => {
      loadLogs(1, true)
    }, [loadLogs]),
  )

  const onRefresh = useCallback(async () => {
    await loadLogs(1, true)
  }, [loadLogs])

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore || refreshing || loading) {
      return
    }

    await loadLogs(page + 1, false)
  }, [hasMore, loading, loadingMore, page, refreshing, loadLogs])

  const summaryText = useMemo(() => {
    const outpassCount = logs.filter((item) => isOutpassAction(item.action)).length
    return `${logs.length} records loaded - ${outpassCount} outpass-related`
  }, [logs])

  const renderItem = ({ item }) => {
    const actionMeta = ACTION_META[item.action] || { label: item.action, color: COLORS.gray[500] }
    const outpassRelated = isOutpassAction(item.action)

    return (
      <View
        style={[
          localStyles.card,
          {
            backgroundColor: colors.card,
            borderColor: outpassRelated ? `${actionMeta.color}55` : colors.border || COLORS.gray[200],
            borderLeftColor: actionMeta.color,
          },
        ]}
      >
        <View style={localStyles.cardHeader}>
          <Text style={[localStyles.cardTitle, { color: colors.text }]}>{actionMeta.label}</Text>
          {outpassRelated ? (
            <View style={[localStyles.tag, { backgroundColor: `${actionMeta.color}18` }]}>
              <Text style={[localStyles.tagText, { color: actionMeta.color }]}>Outpass</Text>
            </View>
          ) : null}
        </View>
        <Text style={[localStyles.cardMeta, { color: colors.subText }]}>Time: {formatDateTime(item.createdAt)}</Text>
        <Text style={[localStyles.cardMeta, { color: colors.text }]}>Location: {item.location || "-"}</Text>
        {item.guardName ? <Text style={[localStyles.cardMeta, { color: colors.text }]}>Guard: {item.guardName}</Text> : null}
        {item.details?.direction ? (
          <Text style={[localStyles.cardMeta, { color: colors.text }]}>Direction: {item.details.direction}</Text>
        ) : null}
        {item.details?.nextStatus ? (
          <Text style={[localStyles.cardMeta, { color: colors.text }]}>Status: {item.details.nextStatus}</Text>
        ) : null}
        {item.details?.reason ? (
          <Text style={[localStyles.cardMeta, { color: colors.text }]}>Reason: {item.details.reason}</Text>
        ) : null}
        {item.details?.description ? (
          <Text style={[localStyles.cardMeta, { color: colors.text }]}>Description: {item.details.description}</Text>
        ) : null}
      </View>
    )
  }

  const emptyState = !loading ? (
    <View style={localStyles.emptyState}>
      <Ionicons name="document-text-outline" size={42} color={colors.subText} />
      <Text style={[localStyles.emptyTitle, { color: colors.text }]}>No student logs yet</Text>
      <Text style={[localStyles.emptyText, { color: colors.subText }]}>
        Entry, exit, and outpass-related activity will appear here.
      </Text>
    </View>
  ) : null

  return (
    <View style={[localStyles.container, { backgroundColor: colors.background }]}>
      <View style={[localStyles.header, { backgroundColor: colors.header, borderBottomColor: colors.border || COLORS.gray[200] }]}>
        <Text style={[localStyles.headerTitle, { color: colors.heading }]}>My Logs</Text>
        <Text style={[localStyles.headerSubtitle, { color: colors.subText }]}>
          Personal entry, exit, and outpass activity
        </Text>
        <Text style={[localStyles.headerSummary, { color: colors.subText }]}>{summaryText}</Text>
        {error ? <Text style={localStyles.errorText}>{error}</Text> : null}
      </View>

      {loading ? (
        <View style={localStyles.loader}>
          <LoadingSpinner
            variant="panel"
            label="Loading your movement logs"
            sublabel="Pulling entry, exit, and outpass activity from Aegis."
            statusText="Records are being synced and sorted for this timeline."
            showThemeToggle={false}
          />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={localStyles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={emptyState}
          onEndReachedThreshold={0.4}
          onEndReached={onLoadMore}
          ListFooterComponent={
            loadingMore ? (
                  <View style={localStyles.footerLoader}>
                    <LoadingSpinner variant="inline" label="Loading more logs" />
                  </View>
                ) : hasMore ? (
                  <TouchableOpacity style={[localStyles.loadMoreButton, { backgroundColor: colors.primary }]} onPress={onLoadMore}>
                    <Text style={[localStyles.loadMoreText, { color: colors.onPrimary }]}>Load More</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
      )}
    </View>
  )
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
  },
  headerSummary: {
    marginTop: 8,
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
  },
  errorText: {
    marginTop: 8,
    color: COLORS.error,
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  card: {
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
  },
  cardMeta: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginBottom: 4,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    marginTop: SPACING.sm,
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
  },
  emptyText: {
    marginTop: 6,
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
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
})
