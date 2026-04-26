import React, { createContext, useContext, useMemo, useRef, useState } from "react"
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native"
import Constants from "expo-constants"
import { captureRef } from "react-native-view-shot"

import { buildScreenshotFileName, saveCapturedPng } from "../utils/screenshot"

const ScreenshotContext = createContext(null)

const debugScreenshotsEnabled =
  __DEV__ || Constants.expoConfig?.extra?.DEBUG_SCREENSHOTS_ENABLED === true || Constants.expoConfig?.extra?.DEBUG_SCREENSHOTS_ENABLED === "true"

export function ScreenshotProvider({ children }) {
  const captureTargetRef = useRef(null)
  const [currentRouteName, setCurrentRouteName] = useState("unknown")
  const [isCapturing, setIsCapturing] = useState(false)

  const captureCurrentScreen = async ({ routeName, label } = {}) => {
    if (!captureTargetRef.current) {
      Alert.alert("Screenshot Unavailable", "The current screen is not ready to capture yet.")
      return null
    }

    if (isCapturing) {
      return null
    }

    try {
      setIsCapturing(true)
      const effectiveRouteName = routeName || currentRouteName || "screen"
      const capturedUri = await captureRef(captureTargetRef.current, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      })
      const fileName = buildScreenshotFileName({ routeName: effectiveRouteName, label })
      const result = await saveCapturedPng({ capturedUri, fileName })
      const successMessage =
        result.usedDirectoryAccess && result.savedUri
          ? `Saved ${fileName}`
          : `Saved to ${result.savedUri || fileName}`

      Alert.alert("Screenshot Saved", successMessage)
      return result
    } catch (error) {
      Alert.alert("Screenshot Failed", error?.message || "Unable to save the screenshot right now.")
      return null
    } finally {
      setIsCapturing(false)
    }
  }

  const openCaptureMenu = () => {
    if (!debugScreenshotsEnabled) {
      return
    }

    Alert.alert("Debug Screenshot", `Capture the current ${currentRouteName || "screen"} view?`, [
      { text: "Cancel", style: "cancel" },
      { text: isCapturing ? "Saving..." : "Save Screenshot", onPress: () => captureCurrentScreen(), style: "default" },
    ])
  }

  const value = useMemo(
    () => ({
      captureCurrentScreen,
      currentRouteName,
      debugScreenshotsEnabled,
      isCapturing,
      setCurrentRouteName,
    }),
    [currentRouteName, isCapturing],
  )

  return (
    <ScreenshotContext.Provider value={value}>
      <View style={styles.container}>
        <View ref={captureTargetRef} collapsable={false} style={styles.captureSurface}>
          {children}
        </View>

        {debugScreenshotsEnabled ? (
          <TouchableOpacity
            accessibilityLabel="debug-screenshot-hotspot"
            activeOpacity={1}
            delayLongPress={800}
            onLongPress={openCaptureMenu}
            style={styles.hotspot}
          >
            <View style={styles.hotspotInner} />
          </TouchableOpacity>
        ) : null}
      </View>
    </ScreenshotContext.Provider>
  )
}

export const useScreenshot = () => {
  const context = useContext(ScreenshotContext)

  if (!context) {
    throw new Error("useScreenshot must be used within a ScreenshotProvider")
  }

  return context
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  captureSurface: {
    flex: 1,
  },
  hotspot: {
    position: "absolute",
    top: 6,
    left: "50%",
    marginLeft: -32,
    width: 64,
    height: 18,
    zIndex: 9999,
    backgroundColor: "transparent",
  },
  hotspotInner: {
    flex: 1,
  },
})
