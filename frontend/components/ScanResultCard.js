import React, { useEffect, useMemo, useRef } from "react"
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../context/ThemeContext"
import { FONTS, SIZES, SPACING } from "../utils/constants"

const formatStatusLabel = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())

const formatDateTime = (value) => {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ScanResultCard({ scanResult, location, onClose }) {
  const { colors, isDarkMode } = useTheme()
  const entryAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0.96)).current

  const log = scanResult?.log || {}
  const outpass = scanResult?.outpass || {}
  const action = log?.action
  const direction = log?.details?.direction
  const isWithoutOutpass = action === "without_outpass"

  const variant = useMemo(() => {
    if (isWithoutOutpass) {
      return {
        key: "without_outpass",
        icon: "warning",
        eyebrow: "Exit Attempted",
        title: "Do not have an outpass",
        subtitle:
          log?.details?.reason || "This student cannot leave campus after 6:00 PM without an approved outpass.",
        accent: colors.warning,
        soft: colors.warningSoft,
        badgeText: "Warning issued",
      }
    }

    if (action === "outpass_used" && direction === "exit") {
      return {
        key: "outpass_exit",
        icon: "shield-checkmark",
        eyebrow: "Approved Outpass Used",
        title: "Exit cleared",
        subtitle: "Security has verified the approved outpass and logged the student exit.",
        accent: colors.warning,
        soft: colors.warningSoft,
        badgeText: "Used for going outside",
      }
    }

    if (action === "outpass_used" && direction === "entry") {
      return {
        key: "outpass_return",
        icon: "return-up-back",
        eyebrow: "Outpass Journey Completed",
        title: "Return recorded",
        subtitle: "The outpass trip has been linked to this campus re-entry.",
        accent: colors.info,
        soft: colors.infoSoft,
        badgeText: "Returned with outpass",
      }
    }

    if (action === "exit") {
      return {
        key: "exit",
        icon: "walk",
        eyebrow: "Exit Scan Complete",
        title: "Exit recorded",
        subtitle: "The scan has been accepted and the movement log is now updated.",
        accent: colors.accent,
        soft: colors.accentSoft,
        badgeText: "Leaving campus",
      }
    }

    return {
      key: "entry",
      icon: "checkmark-circle",
      eyebrow: "Entry Scan Complete",
      title: "Welcome back",
      subtitle: "The scan has been accepted and campus entry is now logged.",
      accent: colors.success,
      soft: colors.successSoft,
      badgeText: "Entered campus",
    }
  }, [action, colors, direction, isWithoutOutpass, log?.details?.reason])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1.04,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.96,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start()
  }, [entryAnim, glowAnim])

  const residentName = scanResult?.user?.name || "Resident"
  const studentId = scanResult?.user?.studentId || scanResult?.user?.guardId || "-"
  const resolvedLocation = log?.location || location || "Campus gate"
  const purpose = outpass?.purpose || outpass?.reason || "-"
  const destination = outpass?.destination || "-"
  const outpassStatus = outpass?.status ? formatStatusLabel(outpass.status) : "No Request"
  const requestedWindow = outpass?.fromDate || outpass?.outDate
  const returnWindow = outpass?.toDate || outpass?.expectedReturnDate
  const warningReason = log?.details?.reason || "This student does not have an approved outpass."
  const rejectionReason = outpass?.rejectionReason || null
  const showOutpassDetails = action === "outpass_used" || isWithoutOutpass

  return (
    <Animated.View
      style={[
        styles.shell,
        {
          backgroundColor: colors.modalSurface,
          borderColor: `${variant.accent}${isDarkMode ? "44" : "26"}`,
          shadowColor: colors.shadowStrong,
          opacity: entryAnim,
          transform: [
            {
              translateY: entryAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [34, 0],
              }),
            },
            {
              scale: entryAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            backgroundColor: variant.soft,
            transform: [{ scale: glowAnim }],
          },
        ]}
      />

      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: variant.soft, borderColor: `${variant.accent}50` }]}>
          <Ionicons name={variant.icon} size={28} color={variant.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: variant.accent }]}>{variant.eyebrow}</Text>
          <Text style={[styles.title, { color: colors.heading }]}>{variant.title}</Text>
          <Text style={[styles.subtitle, { color: colors.subText }]}>{variant.subtitle}</Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: variant.soft }]}>
          <Text style={[styles.badgeText, { color: variant.accent }]}>{variant.badgeText}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>{resolvedLocation}</Text>
        </View>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Resident</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{residentName}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>ID</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{studentId}</Text>
          </View>
        </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Timestamp</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formatDateTime(log?.createdAt)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Status</Text>
              <Text style={[styles.summaryValue, { color: variant.accent }]}>
                {isWithoutOutpass ? "Exit Attempted" : action === "outpass_used" ? "Verified" : "Success"}
              </Text>
            </View>
          </View>
        </View>

      {isWithoutOutpass ? (
        <View style={[styles.warningCard, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
          <View style={styles.warningHeader}>
            <Ionicons name="alert-circle" size={18} color={colors.warning} />
            <Text style={[styles.warningTitle, { color: colors.warning }]}>Outpass warning</Text>
          </View>
          <Text style={[styles.warningText, { color: colors.text }]}>{warningReason}</Text>
        </View>
      ) : null}

      {showOutpassDetails ? (
        <View style={[styles.outpassCard, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
          <View style={styles.outpassHeader}>
            <Text style={[styles.outpassTitle, { color: colors.heading }]}>Outpass details</Text>
            <View style={[styles.statusPill, { backgroundColor: variant.soft }]}>
              <Ionicons name={isWithoutOutpass ? "alert-circle" : "checkmark-circle"} size={14} color={variant.accent} />
              <Text style={[styles.statusPillText, { color: variant.accent }]}>{outpassStatus}</Text>
            </View>
          </View>

          <View style={styles.outpassGrid}>
            <View style={styles.detailBlock}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Purpose</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{purpose}</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Destination</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{destination}</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Approved window</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatDateTime(requestedWindow)}</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Expected return</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatDateTime(returnWindow)}</Text>
            </View>
            {rejectionReason ? (
              <View style={styles.detailBlockFull}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Reason</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{rejectionReason}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.primary }]} onPress={onClose} activeOpacity={0.9}>
        <Text style={[styles.closeText, { color: colors.onPrimary }]}>Done</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  shell: {
    width: "90%",
    maxWidth: 420,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 18,
  },
  halo: {
    position: "absolute",
    top: -54,
    right: -38,
    width: 156,
    height: 156,
    borderRadius: 78,
    opacity: 0.9,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: SPACING.md,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.bold,
  },
  subtitle: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    lineHeight: 20,
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 18,
    marginBottom: 18,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
  },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1,
    marginRight: 10,
  },
  summaryLabel: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    lineHeight: 19,
  },
  outpassCard: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  warningCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    marginLeft: 8,
  },
  warningText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  outpassHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  outpassTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusPillText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
    marginLeft: 6,
  },
  outpassGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  detailBlock: {
    width: "48%",
    marginBottom: 14,
  },
  detailBlockFull: {
    width: "100%",
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  detailValue: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    lineHeight: 19,
  },
  closeButton: {
    marginTop: 18,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
    marginRight: 8,
  },
})
