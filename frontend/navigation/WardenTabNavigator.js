import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { Ionicons } from "@expo/vector-icons"

import WardenDashboardScreen from "../screens/WardenDashboardScreen"
import WardenOutpassScreen from "../screens/WardenOutpassScreen"
import WardenMonitoringScreen from "../screens/WardenMonitoringScreen"
import ProfileScreen from "../screens/ProfileScreen"

const Tab = createBottomTabNavigator()

export default function WardenTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = "ellipse-outline"

          if (route.name === "Dashboard") {
            iconName = focused ? "home" : "home-outline"
          } else if (route.name === "Requests") {
            iconName = focused ? "document-text" : "document-text-outline"
          } else if (route.name === "Monitoring") {
            iconName = focused ? "pulse" : "pulse-outline"
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline"
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "gray",
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={WardenDashboardScreen} />
      <Tab.Screen name="Requests" component={WardenOutpassScreen} />
      <Tab.Screen name="Monitoring" component={WardenMonitoringScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}
