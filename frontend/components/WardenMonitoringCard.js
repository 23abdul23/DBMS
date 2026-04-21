"use client"

import { Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import styles from "../styles/WardenStyles"
import { COLORS } from "../utils/constants"

const stateColors = {
  overdue: "#dc2626",
  ongoing: "#7c3aed",
  pending_review: "#f59e0b",
  awaiting_exit: "#2563eb",
  approved: "#10b981",
  returned: "#059669",
  returned_late: "#c2410c",
  inside: "#6b7280",
  outside_without_outpass: "#b91c1c",
}

const prettify = (value) =>
  String(value || "")
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase())

const formatDateTime = (value) => {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString()
}

export default function WardenMonitoringCard({ entry, colors }) {
  const badgeColor = stateColors[entry.monitoringState] || COLORS.gray[500]

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border || COLORS.gray[200] }]}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{entry.student.name}</Text>
          <Text style={[styles.metaText, { color: colors.subText }]}>
            {entry.student.studentId || "No student ID"} | Room {entry.student.roomNumber || "-"}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${badgeColor}20` }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{prettify(entry.monitoringState)}</Text>
        </View>
      </View>

      {entry.outpass ? (
        <>
          <Text style={[styles.metaText, { color: colors.text }]}>Reason: {entry.outpass.reason}</Text>
          <Text style={[styles.metaText, { color: colors.text }]}>Destination: {entry.outpass.destination}</Text>
          <Text style={[styles.metaText, { color: colors.subText }]}>
            Window: {formatDateTime(entry.outpass.outDate)} to {formatDateTime(entry.outpass.expectedReturnDate)}
          </Text>
        </>
      ) : (
        <Text style={[styles.metaText, { color: colors.subText }]}>No recent outpass record linked to this student.</Text>
      )}

      {entry.latestMovement ? (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
          <Ionicons name="scan-outline" size={16} color={colors.text} />
          <Text style={[styles.metaText, { color: colors.text, marginTop: 0, marginLeft: 6 }]}>
            Last movement: {prettify(entry.latestMovement.action)} at {formatDateTime(entry.latestMovement.createdAt)}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
