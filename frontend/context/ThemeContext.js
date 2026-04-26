import React, { createContext, useContext, useMemo, useState } from "react"

const ThemeContext = createContext()

const lightColors = {
  background: "#f4f7fb",
  backgroundSecondary: "#e9eef7",
  text: "#102033",
  heading: "#08111f",
  subText: "#5f6f85",
  subtext: "#5f6f85",
  textMuted: "#7a8799",
  textInverse: "#f8fbff",
  card: "#ffffff",
  cardElevated: "#ffffff",
  cardMuted: "#f5f8fc",
  cardGlass: "rgba(255,255,255,0.78)",
  header: "#f8fbff",
  border: "#d8e1ef",
  borderStrong: "#b8c7dd",
  divider: "#e7edf6",
  overlay: "rgba(5, 15, 30, 0.48)",
  shadow: "rgba(15, 23, 42, 0.12)",
  shadowStrong: "rgba(15, 23, 42, 0.22)",
  primary: "#1d4ed8",
  primaryPress: "#1e40af",
  primarySoft: "#dbeafe",
  accent: "#0f766e",
  accentSoft: "#ccfbf1",
  success: "#059669",
  successSoft: "#d1fae5",
  warning: "#d97706",
  warningSoft: "#ffedd5",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  info: "#2563eb",
  infoSoft: "#dbeafe",
  inputBackground: "#f8fbff",
  inputBorder: "#cdd8ea",
  inputBorderFocus: "#2563eb",
  inputText: "#102033",
  placeholder: "#8b98aa",
  helperText: "#627287",
  buttonTextOnPrimary: "#f8fbff",
  buttonTextOnSolid: "#f8fbff",
  tabBar: "#f8fbff",
  tabBarBorder: "#dbe4f2",
  modalSurface: "#ffffff",
  scanFrame: "#d6e2f0",
}

const darkColors = {
  background: "#07111f",
  backgroundSecondary: "#0d1a2d",
  text: "#edf4ff",
  heading: "#ffffff",
  subText: "#98a9c2",
  subtext: "#98a9c2",
  textMuted: "#7487a3",
  textInverse: "#08111f",
  card: "#111f34",
  cardElevated: "#16263f",
  cardMuted: "#0d192b",
  cardGlass: "rgba(17,31,52,0.8)",
  header: "#0b1627",
  border: "#22354f",
  borderStrong: "#345072",
  divider: "#1b2b43",
  overlay: "rgba(1, 7, 16, 0.72)",
  shadow: "rgba(0, 0, 0, 0.28)",
  shadowStrong: "rgba(0, 0, 0, 0.42)",
  primary: "#60a5fa",
  primaryPress: "#3b82f6",
  primarySoft: "rgba(96, 165, 250, 0.18)",
  accent: "#2dd4bf",
  accentSoft: "rgba(45, 212, 191, 0.18)",
  success: "#34d399",
  successSoft: "rgba(52, 211, 153, 0.18)",
  warning: "#fbbf24",
  warningSoft: "rgba(251, 191, 36, 0.18)",
  danger: "#f87171",
  dangerSoft: "rgba(248, 113, 113, 0.18)",
  info: "#60a5fa",
  infoSoft: "rgba(96, 165, 250, 0.18)",
  inputBackground: "#0a1628",
  inputBorder: "#29405f",
  inputBorderFocus: "#60a5fa",
  inputText: "#edf4ff",
  placeholder: "#70839f",
  helperText: "#90a2bc",
  buttonTextOnPrimary: "#08111f",
  buttonTextOnSolid: "#08111f",
  tabBar: "#0a1628",
  tabBarBorder: "#182a43",
  modalSurface: "#102138",
  scanFrame: "#2b4464",
}

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false)

  const toggleTheme = () => setIsDarkMode((prev) => !prev)

  const colors = useMemo(() => {
    const palette = isDarkMode ? darkColors : lightColors
    return {
      ...palette,
      surface: palette.card,
      surfaceAlt: palette.cardMuted,
      onPrimary: palette.buttonTextOnPrimary,
    }
  }, [isDarkMode])

  const theme = useMemo(
    () => ({
      isDarkMode,
      toggleTheme,
      colors,
    }),
    [colors, isDarkMode],
  )

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
