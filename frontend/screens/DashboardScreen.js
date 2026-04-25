"use client"

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native"
import { useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "../context/AuthContext"
import { outpass, commonAPI } from "../services/api"
import styles from "../styles/DashboardStyles"

import LoadingSpinner from "../components/LoadingSpinner"
import PasskeyCard from "../components/PasskeyCard"

export default function DashboardScreen({ navigation }) {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { user, logout } = useAuth()
  const [passkey, setPasskey] = useState(null)
  const [currentOutpass, setCurrentOutpass] = useState(null)
  const [stats, setStats] = useState({
    totalOutpasses: 0,
    activeOutpasses: 0,
    pendingOutpasses: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [passkeyResponse, outpassesResponse] = await Promise.all([
        commonAPI.getDailyPasskey(),
        outpass.getOutpasses(),
      ])

      setPasskey(passkeyResponse.data)
      setCurrentOutpass(outpassesResponse.data?.outpass || null)

      if (outpassesResponse.data.outpass){
        const outpasses = outpassesResponse.data.outpass.auditTrail
        setStats({
          totalOutpasses: outpasses.length,
          activeOutpasses: outpasses.filter((op) => op.status === "approved").length,
          pendingOutpasses: outpasses.filter((op) => op.status === "pending").length,
        })
      }
    } catch (error) {
      console.log("Dashboard load error:", error)
      Alert.alert("Error", "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
  }

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ])
  }

  const handleUseOutpass = async () => {
    try {
      const activeOutpass = currentOutpass || (await outpass.getOutpasses()).data?.outpass

      if (!activeOutpass) {
        Alert.alert("No Outpass", "You do not have a current outpass to use.")
        return
      }

      if ((activeOutpass.requestType || activeOutpass.type) === "long_visit") {
        Alert.alert(
          "Long Visit Request",
          "Long visit requests are handled physically by the warden and are not used through the standard QR outpass flow.",
        )
        return
      }

      if (!activeOutpass.canUseOutpass) {
        Alert.alert("Outpass Not Usable", "Your approved regular outpass is not currently usable for exit.")
        return
      }

      navigation.navigate("Scan")
    } catch (error) {
      console.log("Use outpass error:", error)
      Alert.alert("Error", "Unable to load your current outpass right now.")
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.header, { backgroundColor: colors.header }]}>


        <View style={styles.headerContent}>

          <View>
            <Text style={[styles.greeting, { color: colors.subText }]}>Good {getGreeting()}</Text>
            <Text style={[styles.userName, { color: colors.heading }]}>{user?.name}</Text>
            <Text style={[styles.studentId, { color: colors.subText }]}>{user?.studentId}</Text>
          </View>

          <View>
            <TouchableOpacity
              onPress={toggleTheme}
              style={{ padding: 10, borderRadius: 14, backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={24} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.dangerSoft }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={colors.danger} />
            </TouchableOpacity>
          </View>

        </View>
      </View>

      <View style={styles.content}>
        {/* Daily Passkey Card */}
        <PasskeyCard passkey={passkey?.passkey} onRefresh={loadDashboardData} />

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.cardElevated, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={() => navigation.navigate("Scan")}>
              <View style={[styles.actionIcon, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="scan" size={24} color={colors.success} />
              </View>
              <Text style={[styles.actionText, { color: colors.heading }]}>Scan</Text>
              <Text style={[styles.actionSubText, { color: colors.subText }]}>Verify movement</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.cardElevated, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={() => navigation.navigate("Library")}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="book" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.actionText, { color: colors.heading }]}>Library</Text>
              <Text style={[styles.actionSubText, { color: colors.subText }]}>Campus resources</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.cardElevated, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={() => navigation.navigate("SAC")}>
              <View style={[styles.actionIcon, { backgroundColor: colors.warningSoft }]}>
                <Ionicons name="bicycle" size={24} color={colors.warning} />
              </View>
              <Text style={[styles.actionText, { color: colors.heading }]}>SAC</Text>
              <Text style={[styles.actionSubText, { color: colors.subText }]}>Recreation access</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.cardElevated, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={handleUseOutpass}>
              <View style={[styles.actionIcon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="log-out-outline" size={24} color={colors.accent} />
              </View>
              <Text style={[styles.actionText, { color: colors.heading }]}>Use Outpass</Text>
              <Text style={[styles.actionSubText, { color: colors.subText }]}>Approved exit flow</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Morning"
  if (hour < 17) return "Afternoon"
  return "Evening"
}

