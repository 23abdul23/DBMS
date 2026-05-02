import React, { useEffect, useState } from "react"
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../context/ThemeContext"
import { useAuth } from "../context/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import { sacAPI } from "../services/api"
import { SAC_EQUIPMENT } from "../constants/sacCatalog"
import { FONTS } from "../utils/constants"
import { CONTENT_MAX_WIDTH, getThreeColumnCardWidth } from "../utils/responsiveLayout"

const formatTime = (value) => {
  if (!value) {
    return ""
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function SACAdminEquipmentScreen({ navigation, route }) {
  const { colors, isDarkMode, toggleTheme } = useTheme()
  const { user } = useAuth()
  const { width } = useWindowDimensions()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submittingKey, setSubmittingKey] = useState(null)

  const entrySource = route?.params?.entrySource || "manual"
  const isStudent = user?.role === "student"
  const statCardWidth = getThreeColumnCardWidth(width)

  const equipmentActivity = (overview?.activityFeed || []).filter(
    (item) => item.type === "equipment_checked_out" || item.type === "equipment_returned",
  )
  const equipmentStateMap = new Map((overview?.equipment || []).map((equipment) => [equipment.name, equipment]))

  const loadOverview = async (nextLoading = false) => {
    try {
      if (nextLoading) {
        setLoading(true)
      }

      const response = await sacAPI.getOverview()
      setOverview(response?.data?.overview || null)
    } catch (error) {
      console.log("Equipment overview error:", error?.response?.data || error)
      Alert.alert("SAC Error", error?.response?.data?.message || "Unable to load equipment activity right now.")
    } finally {
      if (nextLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadOverview(true)
  }, [])

  const onRefresh = async () => {
    try {
      setRefreshing(true)
      await loadOverview(false)
    } finally {
      setRefreshing(false)
    }
  }

  const runAction = async (key, action, fallbackMessage) => {
    try {
      setSubmittingKey(key)
      const response = await action()
      setOverview(response?.data?.overview || null)
      Alert.alert("SAC Updated", response?.data?.message || fallbackMessage)
    } catch (error) {
      console.log("Equipment action error:", error?.response?.data || error)
      Alert.alert("Action Failed", error?.response?.data?.message || fallbackMessage)
    } finally {
      setSubmittingKey(null)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 22,
            backgroundColor: colors.header,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ width: "100%", alignSelf: "center", maxWidth: CONTENT_MAX_WIDTH }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.cardElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>

              <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 22 }}>Equipments</Text>

              <TouchableOpacity
                onPress={toggleTheme}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.cardElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View
              style={{
                marginTop: 18,
                borderRadius: 28,
                padding: 20,
                backgroundColor: colors.cardElevated,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: entrySource === "qr" ? colors.successSoft : colors.primarySoft,
                  }}
                >
                  <Ionicons
                    name={entrySource === "qr" ? "qr-code-outline" : "football-outline"}
                    size={26}
                    color={entrySource === "qr" ? colors.success : colors.primary}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 18 }}>Guard equipment activity</Text>
                  <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
                    Mark sports equipment as taken or returned, and see who currently has each item.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View
          style={{
            width: "100%",
            alignSelf: "center",
            maxWidth: CONTENT_MAX_WIDTH,
            paddingHorizontal: 18,
            paddingTop: 18,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 4 }}>
            {[
              {
                label: "In Use",
                value: overview?.summary?.equipmentInUse || 0,
                icon: "football-outline",
                toneBg: colors.primarySoft,
                toneFg: colors.primary,
              },
              {
                label: "Equipment Types",
                value: overview?.summary?.activeEquipmentTypes || 0,
                icon: "apps-outline",
                toneBg: colors.accentSoft,
                toneFg: colors.accent,
              },
              {
                label: "Your Items",
                value: overview?.myStatus?.activeEquipment?.length || 0,
                icon: "person-outline",
                toneBg: colors.warningSoft,
                toneFg: colors.warning,
              },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  width: statCardWidth,
                  backgroundColor: colors.cardElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 24,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: stat.toneBg,
                    marginBottom: 10,
                  }}
                >
                  <Ionicons name={stat.icon} size={18} color={stat.toneFg} />
                </View>
                <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 20 }}>{stat.value}</Text>
                <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {SAC_EQUIPMENT.map((item) => {
            const equipmentState = equipmentStateMap.get(item.name)
            const userHasItem = Boolean(equipmentState?.checkedOutBy?.some((entry) => entry.user?.id === user?.id))
            const isBusy = submittingKey === `equipment-select-${item.name}` || submittingKey === `equipment-return-${item.name}`

            return (
              <View
                key={item.name}
                style={{
                  marginBottom: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: userHasItem ? colors.successSoft : colors.primarySoft,
                      marginRight: 14,
                    }}
                  >
                    <Ionicons name={item.icon} size={22} color={userHasItem ? colors.success : colors.primary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 16 }}>{item.name}</Text>
                    <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13, marginTop: 3 }}>
                      {equipmentState?.activeCount || 0} active checkout{equipmentState?.activeCount === 1 ? "" : "s"}
                    </Text>
                  </View>

                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: colors.cardMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 12 }}>
                      Count {equipmentState?.activeCount || 0}
                    </Text>
                  </View>
                </View>

                {Boolean(equipmentState?.checkedOutBy?.length) && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 13, marginBottom: 8 }}>
                      Taken by
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      {equipmentState.checkedOutBy.map((entry) => (
                        <View
                          key={entry.id}
                          style={{
                            marginRight: 8,
                            marginBottom: 8,
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            backgroundColor: colors.cardMuted,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 12 }}>{entry.user?.name}</Text>
                          <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 11 }}>
                            {formatTime(entry.checkedOutAt)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {isStudent && (
                  <TouchableOpacity
                    disabled={isBusy}
                    onPress={() =>
                      userHasItem
                        ? runAction(
                            `equipment-return-${item.name}`,
                            () => sacAPI.returnEquipment(item.name),
                            `Unable to return ${item.name}.`,
                          )
                        : runAction(
                            `equipment-select-${item.name}`,
                            () => sacAPI.selectEquipment(item.name),
                            `Unable to mark ${item.name} as taken.`,
                          )
                    }
                    style={{
                      marginTop: 14,
                      borderRadius: 18,
                      paddingVertical: 14,
                      alignItems: "center",
                      backgroundColor: userHasItem ? colors.cardMuted : colors.accent,
                      borderWidth: userHasItem ? 1 : 0,
                      borderColor: colors.border,
                      opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    <Text
                      style={{
                        color: userHasItem ? colors.heading : colors.buttonTextOnSolid,
                        fontFamily: FONTS.bold,
                        fontSize: 14,
                      }}
                    >
                      {userHasItem ? "Return Equipment" : "Take Equipment"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })}

          <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 20, marginBottom: 12, marginTop: 8 }}>
            Equipment Activity
          </Text>
          <View
            style={{
              backgroundColor: colors.cardElevated,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
            }}
          >
            {equipmentActivity.length ? (
              equipmentActivity.map((activity, index) => (
                <View
                  key={`${activity.type}-${activity.timestamp}-${index}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    paddingVertical: 10,
                    borderBottomWidth: index === equipmentActivity.length - 1 ? 0 : 1,
                    borderBottomColor: colors.divider,
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: activity.type === "equipment_returned" ? colors.successSoft : colors.primarySoft,
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name={activity.type === "equipment_returned" ? "checkmark-circle-outline" : "football-outline"}
                      size={20}
                      color={activity.type === "equipment_returned" ? colors.success : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.heading, fontFamily: FONTS.bold, fontSize: 14 }}>{activity.title}</Text>
                    <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 }}>
                      {activity.subtitle}
                    </Text>
                  </View>
                  <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 12, marginLeft: 12 }}>
                    {formatTime(activity.timestamp)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.subText, fontFamily: FONTS.regular, fontSize: 13 }}>
                No equipment activity yet.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
