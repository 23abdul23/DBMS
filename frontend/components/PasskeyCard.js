"use client"

import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native"
import { useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import QRCode from "react-native-qrcode-svg"
import { FONTS, SIZES, SPACING } from "../utils/constants"
import { useTheme } from "../context/ThemeContext"

export default function PasskeyCard({ passkey, onRefresh }) {
  const { colors } = useTheme()
  const [showQR, setShowQR] = useState(false)

  const formatTime = (dateString) =>
    new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })

  const getTimeRemaining = () => {
    if (!passkey?.expiresAt) return "N/A"

    const now = new Date()
    const expiry = new Date(passkey.expiresAt)
    const diff = expiry - now

    if (diff <= 0) return "Expired"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `${hours}h ${minutes}m`
  }

  const handleRefresh = () => {
    Alert.alert("Refresh Passkey", "This will generate a new passkey. Continue?", [
      { text: "Cancel", style: "cancel" },
      { text: "Refresh", onPress: onRefresh },
    ])
  }

  if (!passkey) {
    return (
      <View style={[styles.card, { backgroundColor: colors.cardElevated, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.warning} />
          <Text style={[styles.errorTitle, { color: colors.heading }]}>QR To Be Shown</Text>
          <Text style={[styles.errorText, { color: colors.subText }]}>Contact admin to activate your account</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.cardElevated, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <View style={[styles.topGlow, { backgroundColor: colors.primarySoft }]} />

      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.cardTitle, { color: colors.heading }]}>Today's Passkey</Text>
          <Text style={[styles.validUntil, { color: colors.subText }]}>Valid until {formatTime(passkey.expiresAt)}</Text>
        </View>
        <TouchableOpacity style={[styles.refreshButton, { backgroundColor: colors.primarySoft }]} onPress={handleRefresh}>
          <Ionicons name="refresh-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.passkeyContainer, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
        <Text style={[styles.passkeyLabel, { color: colors.subText }]}>Secure Code</Text>
        <Text style={[styles.passkeyCode, { color: colors.primary }]}>{passkey.hash ? passkey.hash.substring(0, 8).toUpperCase() : ""}</Text>
        <Text style={[styles.timeRemaining, { color: colors.warning }]}>Expires in {getTimeRemaining()}</Text>
      </View>

      <View style={styles.qrSection}>
        <TouchableOpacity style={[styles.qrToggle, { backgroundColor: colors.primarySoft }]} onPress={() => setShowQR(!showQR)}>
          <Ionicons name={showQR ? "eye-off-outline" : "qr-code-outline"} size={20} color={colors.primary} />
          <Text style={[styles.qrToggleText, { color: colors.primary }]}>{showQR ? "Hide QR Code" : "Show QR Code"}</Text>
        </TouchableOpacity>

        {showQR ? (
          <View style={[styles.qrContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <QRCode
              value={JSON.stringify({
                userId: passkey.userId,
                hash: passkey.hash,
                timestamp: passkey.createdAt,
              })}
              size={150}
              color={colors.heading}
              backgroundColor={colors.card}
            />
            <Text style={[styles.qrNote, { color: colors.subText }]}>Show this QR code to security for entry or exit.</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statusIndicator}>
        <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
        <Text style={[styles.statusText, { color: colors.success }]}>Active and valid</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  topGlow: {
    position: "absolute",
    top: -56,
    right: -36,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
  },
  validUntil: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginTop: SPACING.xs,
  },
  refreshButton: {
    padding: SPACING.sm,
    borderRadius: 12,
  },
  passkeyContainer: {
    alignItems: "center",
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderRadius: 20,
    borderWidth: 1,
  },
  passkeyLabel: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginBottom: SPACING.xs,
  },
  passkeyCode: {
    fontSize: SIZES.xxxl,
    fontFamily: FONTS.bold,
    letterSpacing: 2,
    marginBottom: SPACING.xs,
  },
  timeRemaining: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
  qrSection: {
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  qrToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 14,
    marginBottom: SPACING.md,
  },
  qrToggleText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    marginLeft: SPACING.xs,
  },
  qrContainer: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  qrNote: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    textAlign: "center",
    marginTop: SPACING.sm,
    maxWidth: 220,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
  },
  errorTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  errorText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    textAlign: "center",
  },
})
