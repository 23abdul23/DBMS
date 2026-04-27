"use client"

import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Modal,
  StatusBar,
  TextInput,
} from "react-native"
import Constants from "expo-constants"
import { Ionicons } from "@expo/vector-icons"
import { CameraView, useCameraPermissions } from "expo-camera"
import { useTheme } from "../context/ThemeContext"
import { FONTS } from "../utils/constants"
import LoadingSpinner from "../components/LoadingSpinner"
import styles from "../styles/ScannerStyles"
import { libraryAPI, securityAPI } from "../services/api"
import ScanResultCard from "../components/ScanResultCard"
import { useAuth } from "../context/AuthContext"
import { showToast } from "../utils/toast"

const LIBRARY_LIMIT = Number(Constants.expoConfig?.extra?.LIBRARY_LIMIT || 60)

export default function Scanner({ navigation, route }) {
  const { isDarkMode, toggleTheme, colors } = useTheme()
  const { user } = useAuth()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [action, setAction] = useState("")
  const [loc, setLoc] = useState("")
  const [showPopup, setShowPopup] = useState(false)
  const [showLibraryPrompt, setShowLibraryPrompt] = useState(false)
  const [libraryOverview, setLibraryOverview] = useState(null)
  const [seatNumber, setSeatNumber] = useState("")
  const [librarySubmitting, setLibrarySubmitting] = useState(false)
  const fallbackLocation = route?.params?.location || ""

  useEffect(() => {
    if (!permission) {
      requestPermission()
    }
  }, [permission, requestPermission])

  useEffect(() => {
    if (action === "exit" || action === "entry" || action === "outpass_used" || action === "without_outpass") {
      setShowPopup(true)
      setScanned(true)
    }
  }, [action])

  const resetScanState = () => {
    setScanned(false)
    setScanResult(null)
    setAction("")
    setShowPopup(false)
    setShowLibraryPrompt(false)
    setLibraryOverview(null)
    setSeatNumber("")
    setLibrarySubmitting(false)
  }

  const refreshLibraryOverview = async () => {
    const response = await libraryAPI.getOverview()
    const overview = response?.data?.overview || null
    setLibraryOverview(overview)
    return overview
  }

  const handleLibraryStudentScan = async () => {
    const overview = await refreshLibraryOverview()
    setLoc("Library")

    if (overview?.myStatus?.activeSeat) {
      const response = await libraryAPI.releaseSeat()
      showToast(response?.data?.message || "Library token released.")
      resetScanState()
      navigation.replace("Library")
      return
    }

    const statusResponse = await libraryAPI.getStatus()
    if (!statusResponse?.data?.status) {
      showToast(statusResponse?.data?.message || "Library is closed for new entry right now.")
      setScanned(false)
      return
    }

    if (overview?.summary?.isFull) {
      showToast("Library full.")
      setScanned(false)
      return
    }

    setShowLibraryPrompt(true)
  }

  const submitLibrarySeat = async () => {
    const parsedSeatNumber = Number.parseInt(seatNumber, 10)

    if (!Number.isInteger(parsedSeatNumber) || parsedSeatNumber < 1 || parsedSeatNumber > LIBRARY_LIMIT) {
      showToast(`Enter a slot number between 1 and ${LIBRARY_LIMIT}.`)
      return
    }

    try {
      setLibrarySubmitting(true)
      const response = await libraryAPI.claimSeat(parsedSeatNumber)
      setLibraryOverview(response?.data?.overview || null)
      showToast(response?.data?.message || `Token Number ${parsedSeatNumber} assigned successfully.`)
      resetScanState()
      navigation.replace("Library")
    } catch (error) {
      const code = error?.response?.data?.code

      if (code === "SEAT_TAKEN") {
        showToast("Seat already taken, choose another seat.")
        await refreshLibraryOverview()
        return
      }

      if (code === "LIBRARY_FULL") {
        showToast("Library full.")
        await refreshLibraryOverview()
        setShowLibraryPrompt(false)
        setScanned(false)
        return
      }

      if (code === "LIBRARY_CLOSED") {
        showToast(error?.response?.data?.message || "Library is closed for new entry right now.")
        await refreshLibraryOverview()
        setShowLibraryPrompt(false)
        setScanned(false)
        return
      }

      showToast(error?.response?.data?.message || "Unable to assign the library token right now.")
    } finally {
      setLibrarySubmitting(false)
    }
  }

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) {
      return
    }

    setScanned(true)

    try {
      const parsed = JSON.parse(data)
      const location = parsed?.location || fallbackLocation || ""
      const normalizedLocation = typeof location === "string" ? location.trim().toLowerCase() : ""
      const isGuardLocationQr =
        Boolean(parsed?.guardId || parsed?.guardName || parsed?.location) &&
        !parsed?.studentId &&
        !parsed?.userId

      setLoc(location)

      if (user?.role === "student" && normalizedLocation === "sac") {
        navigation.replace("SAC", { entrySource: "qr", location: "SAC" })
        return
      }

      if (user?.role === "student" && normalizedLocation === "library") {
        await handleLibraryStudentScan()
        return
      }

      const response =
        user?.role === "student" && isGuardLocationQr
          ? await securityAPI.logStudentScan({
              location,
              guardId: parsed?.guardId,
              guardName: parsed?.guardName,
            })
          : await securityAPI.logEntry({
              location,
              studentId: parsed?.studentId,
              userId: parsed?.userId,
            })

      setScanResult(response?.data || null)
      setAction(response?.data?.log?.action || "")
    } catch (error) {
      console.log("QR scan error:", error?.response?.data || error)
      Alert.alert("Invalid QR", error?.response?.data?.message || "Unable to scan this QR code")
      setScanned(false)
    }
  }

  if (!permission) {
    return <LoadingSpinner />
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, flex: 1 }]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: colors.text }}>No access to camera</Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={{ padding: 8, marginTop: 12, backgroundColor: colors.card, borderRadius: 8 }}
          >
            <Text style={{ color: colors.text }}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            padding: 10,
            borderRadius: 16,
            backgroundColor: colors.cardElevated,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <Text
            style={{
              color: colors.heading,
              fontSize: 22,
              fontFamily: FONTS.bold,
              textAlign: "center",
            }}
          >
            Security Scan
          </Text>
        </View>
        <TouchableOpacity
          onPress={toggleTheme}
          style={{
            padding: 10,
            borderRadius: 16,
            backgroundColor: colors.cardElevated,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View
        style={{
          marginHorizontal: 18,
          marginBottom: 14,
          padding: 16,
          borderRadius: 24,
          backgroundColor: colors.cardGlass,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.shadow,
          shadowOpacity: 1,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primarySoft,
              marginRight: 12,
            }}
          >
            <Ionicons name="scan" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 16 }}>
              Align the code within the frame
            </Text>
          </View>
        </View>
      </View>

      {!showPopup && !showLibraryPrompt && (
        <View
          style={{
            flex: 1,
            overflow: "hidden",
            borderRadius: 32,
            marginHorizontal: 18,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.scanFrame,
            backgroundColor: colors.cardMuted,
            shadowColor: colors.shadowStrong,
            shadowOpacity: 1,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 14 },
            elevation: 16,
          }}
        >
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128"],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          
        </View>
      )}

      <Modal visible={showPopup} animationType="fade" transparent onRequestClose={() => setShowPopup(false)}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.overlay,
            paddingHorizontal: 16,
          }}
        >
          <ScanResultCard
            scanResult={scanResult}
            location={loc}
            onClose={() => {
              setShowPopup(false)
              resetScanState()
              navigation.goBack()
            }}
          />
        </View>
      </Modal>

      <Modal
        visible={showLibraryPrompt}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowLibraryPrompt(false)
          setScanned(false)
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.overlay,
            paddingHorizontal: 18,
          }}
        >
          <View
            style={{
              width: "100%",
              borderRadius: 24,
              backgroundColor: colors.cardElevated,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 20,
            }}
          >
            <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 20 }}>Choose Library Slot</Text>
            <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 6 }}>
              Enter the slot number where you placed your bag. The slot number becomes your library token.
            </Text>

            <View
              style={{
                marginTop: 16,
                borderRadius: 18,
                backgroundColor: colors.cardMuted,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
              }}
            >
              <Text style={{ color: colors.text, fontFamily: FONTS.medium, fontSize: 13 }}>
                Current strength: {libraryOverview?.summary?.occupiedCount || 0}/{libraryOverview?.summary?.capacity || LIBRARY_LIMIT}
              </Text>
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 4 }}>
                Available seats: {libraryOverview?.summary?.availableCount || 0}
              </Text>
            </View>

            <Text style={{ color: colors.subText, fontFamily: FONTS.medium, fontSize: 13, marginTop: 16, marginBottom: 8 }}>
              Slot number
            </Text>
            <TextInput
              value={seatNumber}
              onChangeText={setSeatNumber}
              placeholder={`1 - ${LIBRARY_LIMIT}`}
              placeholderTextColor={colors.subText}
              keyboardType="number-pad"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: colors.text,
                backgroundColor: colors.background,
                fontFamily: FONTS.medium,
                fontSize: 16,
              }}
            />

            <View style={{ flexDirection: "row", marginTop: 18 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowLibraryPrompt(false)
                  setScanned(false)
                }}
                style={{
                  flex: 1,
                  marginRight: 8,
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                  backgroundColor: colors.cardMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.heading, fontFamily: FONTS.bold }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={librarySubmitting}
                onPress={submitLibrarySeat}
                style={{
                  flex: 1,
                  marginLeft: 8,
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                  backgroundColor: colors.primary,
                  opacity: librarySubmitting ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.buttonTextOnPrimary, fontFamily: FONTS.bold }}>
                  {librarySubmitting ? "Assigning..." : "Take Token"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {scanned && !showPopup && !showLibraryPrompt && (
        <TouchableOpacity
          onPress={resetScanState}
          style={{
            backgroundColor: colors.cardElevated,
            paddingHorizontal: 18,
            paddingVertical: 16,
            borderRadius: 18,
            alignSelf: "center",
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.heading, fontFamily: FONTS.bold }}>Tap to scan again</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}
