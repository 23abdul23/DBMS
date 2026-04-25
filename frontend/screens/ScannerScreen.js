"use client"

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Modal,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { FONTS } from "../utils/constants";
import LoadingSpinner from "../components/LoadingSpinner";
import styles from "../styles/ScannerStyles";
import { CameraView, useCameraPermissions } from "expo-camera";
import { securityAPI } from "../services/api";
import ScanResultCard from "../components/ScanResultCard";
import { useAuth } from "../context/AuthContext";

export default function Scanner({ navigation, route }) {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [action, setAction] = useState("");
  const [loc, setLoc] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const fallbackLocation = route?.params?.location || "";

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    if (action === "exit" || action === "entry" || action === "outpass_used" || action === "without_outpass") {
      setShowPopup(true);
      setScanned(true); // Close camera
    }
  }, [action]);

  const handleBarCodeScanned = async ({ type, data }) => {
    if (!scanned) {
      setScanned(true);
      try {
        const parsed = JSON.parse(data);
        const location = parsed?.location || fallbackLocation || "";
        const isGuardLocationQr =
          Boolean(parsed?.guardId || parsed?.guardName || parsed?.location) &&
          !parsed?.hash &&
          !parsed?.studentId &&
          !parsed?.userId;

        setLoc(location);

        const response =
          user?.role === "student" && isGuardLocationQr
            ? await securityAPI.logStudentScan({
                location,
                guardId: parsed?.guardId,
                guardName: parsed?.guardName,
              })
            : await securityAPI.logEntry({
                location,
                hash: parsed?.hash,
                studentId: parsed?.studentId,
                userId: parsed?.userId,
              });

        setScanResult(response?.data || null);
        setAction(response?.data?.log?.action || "");
      } catch (error) {
        console.log("QR scan error:", error?.response?.data || error);
        Alert.alert("Invalid QR", error?.response?.data?.message || "Unable to scan this QR code");
        setScanned(false);
      }

    }
  };

  if (!permission) {
    return <LoadingSpinner />;
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
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {/* Header */}
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
          <Text
            style={{
              color: colors.subText,
              fontSize: 13,
              fontFamily: FONTS.regular,
              textAlign: "center",
              marginTop: 2,
            }}
          >
            QR and barcode verification with live movement status
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
            <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 3 }}>
              Entry, exit, and approved outpass usage will be identified automatically.
            </Text>
          </View>
        </View>
      </View>

      {/* Camera Scanner */}
      {!showPopup && (
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
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: "18%",
              left: "10%",
              right: "10%",
              bottom: "18%",
              borderRadius: 28,
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.88)",
              backgroundColor: "transparent",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: 18,
              left: 18,
              right: 18,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: colors.overlay,
            }}
          >
            <Text style={{ color: colors.textInverse, fontFamily: FONTS.bold, fontSize: 14 }}>Live verification</Text>
            <Text style={{ color: "rgba(248,251,255,0.78)", fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>
              Hold steady for a second while the app validates resident movement and outpass eligibility.
            </Text>
          </View>
        </View>
      )}

      {/* Popup Cards */}
      <Modal
        visible={showPopup}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPopup(false)}
      >
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.overlay,
          paddingHorizontal: 16,
        }}>
          <ScanResultCard
            scanResult={scanResult}
            location={loc}
            onClose={() => {
              setShowPopup(false);
              setScanned(false);
              setAction(null);
              setScanResult(null);
              navigation.goBack();
            }}
          />
        </View>
      </Modal>

      {/* Buttons & Result */}
      {scanned && !showPopup && (
        <TouchableOpacity
          onPress={() => {
            setScanned(false);
            setScanResult(null);
            setAction(null);
          }}
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
  );
}
