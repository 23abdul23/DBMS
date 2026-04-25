"use client"

import { Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import styles from "../styles/WardenStyles"
import { COLORS } from "../utils/constants"

const stateColors = {
  danger: "#dc2626",
  yellow_alert: "#f59e0b",
  ongoing: COLORS.primary,
  inside: "#6b7280",
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
  const badgeLabel =
    entry.monitoringState === "ongoing"
      ? "Outside With Outpass"
      : entry.monitoringState === "inside"
        ? "Inside Campus"
        : prettify(entry.monitoringState)

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
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </View>
      </View>

      {entry.campusPresence === "outside" ? (
        <>
          <Text style={[styles.metaText, { color: colors.text }]}>Exit Gate: {entry.exitGate || "-"}</Text>
          <Text style={[styles.metaText, { color: colors.subText }]}>Exit Time: {formatDateTime(entry.exitTime)}</Text>
          <Text style={[styles.metaText, { color: colors.text }]}>
            Outpass: {entry.hasOutpass ? "Approved / Used" : "No approved outpass"}
          </Text>
          {entry.outpass ? (
            <>
              <Text style={[styles.metaText, { color: colors.text }]}>Reason: {entry.outpass.reason}</Text>
              <Text style={[styles.metaText, { color: colors.text }]}>Destination: {entry.outpass.destination}</Text>
              <Text style={[styles.metaText, { color: colors.subText }]}>
                Window: {formatDateTime(entry.outpass.outDate)} to {formatDateTime(entry.outpass.expectedReturnDate)}
              </Text>
            </>
          ) : null}
        </>
      ) : (
        <Text style={[styles.metaText, { color: colors.subText }]}>
          Student is currently inside campus.
        </Text>
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
