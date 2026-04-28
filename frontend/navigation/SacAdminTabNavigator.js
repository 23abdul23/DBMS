import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../context/ThemeContext"

import SACAdminScreen from "../screens/SACAdminScreen"
import SACAdminClubRoomScreen from "../screens/SACAdminClubRoomScreen"
import SACAdminEquipmentScreen from "../screens/SACAdminEquipmentScreen"
import ProfileScreen from "../screens/ProfileScreen"

const Tab = createBottomTabNavigator()

export default function SacAdminTabNavigator() {
  const { colors } = useTheme()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = "ellipse-outline"

          if (route.name === "SAC") {
            iconName = focused ? "grid" : "grid-outline"
          } else if (route.name === "Club Rooms") {
            iconName = focused ? "key" : "key-outline"
          } else if (route.name === "Equipment") {
            iconName = focused ? "football" : "football-outline"
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline"
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="SAC" component={SACAdminScreen} />
      <Tab.Screen name="Club Rooms" component={SACAdminClubRoomScreen} />
      <Tab.Screen name="Equipment" component={SACAdminEquipmentScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}
