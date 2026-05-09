/\*\*

- Example Integration of Location QR Download Feature
- This file demonstrates how to integrate the new LocationQRDownloadScreen
- into your existing navigation structure.
  \*/

// ============================================================================
// OPTION 1: Add to Existing Stack Navigator (Recommended)
// ============================================================================

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Import screens
import DashboardScreen from '../screens/DashboardScreen';
import LocationQRDownloadScreen from '../screens/LocationQRDownloadScreen';
import GuardScreen from '../screens/GuardScreen';
import ScannerScreen from '../screens/ScannerScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/\*\*

- Admin Stack Navigator - Add LocationQRDownload screen here
  \*/
  export function AdminStackNavigator() {
  return (
  <Stack.Navigator
  screenOptions={{
          headerShown: false,
          animationEnabled: true,
          cardStyle: { backgroundColor: 'transparent' },
        }} >
  <Stack.Screen
  name="AdminDashboard"
  component={DashboardScreen}
  options={{ headerShown: false }}
  />
  {/_ New screen for location QR downloads _/}
  <Stack.Screen
  name="LocationQRDownload"
  component={LocationQRDownloadScreen}
  options={{
            headerShown: false,
            animationEnabled: true,
            presentation: 'card',
          }}
  />

        <Stack.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>

  );
  }

// ============================================================================
// OPTION 2: Add as a Tab in Bottom Tab Navigator
// ============================================================================

import { Ionicons } from '@expo/vector-icons';

/\*\*

- Main App Navigator with QR Download Tab
  \*/
  export function MainAppNavigator() {
  return (
  <Tab.Navigator
  screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#999',
        }} >
  <Tab.Screen
  name="Dashboard"
  component={DashboardScreen}
  options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
  />

        <Tab.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{
            tabBarLabel: 'Scan',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="scan-outline" size={size} color={color} />
            ),
          }}
        />

        {/* New QR Download Tab */}
        <Tab.Screen
          name="LocationQRDownload"
          component={LocationQRDownloadScreen}
          options={{
            tabBarLabel: 'QR Codes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="qr-code-outline" size={size} color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="Guard"
          component={GuardScreen}
          options={{
            tabBarLabel: 'Guard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-outline" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

  );
  }

// ============================================================================
// OPTION 3: Add Navigation Button to Existing Screen
// ============================================================================

import { TouchableOpacity, View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/\*\*

- Example Dashboard with QR Download Button
  \*/
  export function DashboardWithQRButton() {
  const navigation = useNavigation();
  const { colors } = useTheme();

return (
<View style={{ flex: 1, backgroundColor: colors.background }}>
{/_ Existing dashboard content _/}

      {/* Add QR Download Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('LocationQRDownload')}
        style={{
          marginHorizontal: 16,
          marginVertical: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: colors.primary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Ionicons
          name="qr-code-outline"
          size={20}
          color={colors.buttonTextOnPrimary}
        />
        <Text
          style={{
            color: colors.buttonTextOnPrimary,
            fontFamily: 'System',
            fontSize: 16,
            fontWeight: '600',
          }}
        >
          Download Location QR Codes
        </Text>
      </TouchableOpacity>
    </View>

);
}

// ============================================================================
// OPTION 4: Create a Settings/Tools Screen with QR Download Access
// ============================================================================

/\*\*

- Tools/Settings Screen with QR Download Option
  \*/
  export function ToolsScreen({ navigation }) {
  const { colors } = useTheme();

const tools = [
{
id: 'qr-download',
title: 'Download Location QRs',
description: 'Generate and download QR codes for all campus locations',
icon: 'qr-code-outline',
onPress: () => navigation.navigate('LocationQRDownload'),
},
{
id: 'qr-history',
title: 'Download History',
description: 'View and manage your downloaded QR codes',
icon: 'download-outline',
onPress: () => {}, // Navigate to history screen
},
// Add more tools as needed
];

return (
<View style={{ flex: 1, backgroundColor: colors.background }}>
<Text style={{ padding: 16, fontSize: 18, fontWeight: 'bold' }}>
Tools
</Text>

      {tools.map((tool) => (
        <TouchableOpacity
          key={tool.id}
          onPress={tool.onPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: 16,
            marginVertical: 8,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: colors.cardElevated,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <Ionicons name={tool.icon} size={24} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.heading, fontWeight: '600' }}>
              {tool.title}
            </Text>
            <Text
              style={{
                color: colors.subText,
                fontSize: 13,
                marginTop: 2,
              }}
            >
              {tool.description}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.subText} />
        </TouchableOpacity>
      ))}
    </View>

);
}

// ============================================================================
// OPTION 5: Add to Admin/Security Dashboard
// ============================================================================

/\*\*

- Quick Actions Menu - Add QR Download to Guard/Admin Screen
  \*/
  export function GuardScreenWithQROption() {
  const { colors } = useTheme();
  const navigation = useNavigation();

const quickActions = [
{
id: 'scan',
title: 'Scan QR',
icon: 'scan-outline',
onPress: () => navigation.navigate('Scanner'),
},
{
id: 'my-qr',
title: 'My Guard QR',
icon: 'qr-code-outline',
onPress: () => {}, // Show own QR
},
{
id: 'location-qrs',
title: 'Location QRs',
icon: 'map-outline',
onPress: () => navigation.navigate('LocationQRDownload'),
},
{
id: 'settings',
title: 'Settings',
icon: 'settings-outline',
onPress: () => {}, // Navigate to settings
},
];

return (
<View
style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }} >
{quickActions.map((action) => (
<TouchableOpacity
key={action.id}
onPress={action.onPress}
style={{
            flex: 0.45,
            aspectRatio: 1,
            backgroundColor: colors.cardElevated,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }} >
<Ionicons name={action.icon} size={28} color={colors.primary} />
<Text
style={{
              marginTop: 8,
              textAlign: 'center',
              fontSize: 12,
              fontWeight: '600',
              color: colors.heading,
            }} >
{action.title}
</Text>
</TouchableOpacity>
))}
</View>
);
}

// ============================================================================
// OPTION 6: Deep Link Configuration
// ============================================================================

/\*\*

- Configure deep linking for QR download screen
  \*/
  export const linking = {
  prefixes: ['aegis://', 'https://aegis.app'],
  config: {
  screens: {
  LocationQRDownload: 'qr-download/:category', // Optional category filter
  LocationQRDownload: 'qr-download',
  Dashboard: 'dashboard',
  Scanner: 'scanner',
  // Add other routes
  },
  },
  };

/\*\*

- Handle deep links
  \*/
  export function handleDeepLink(link) {
  if (link.startsWith('aegis://qr-download')) {
  // Navigate to LocationQRDownloadScreen
  return {
  name: 'LocationQRDownload',
  params: {
  category: link.split('/')[3], // Optional
  },
  };
  }
  }

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/\*\*

- Example 1: Navigate from button press
  \*/
  export function NavigateToQRDownload() {
  const navigation = useNavigation();

const handlePress = () => {
navigation.navigate('LocationQRDownload');
};

return (
<TouchableOpacity onPress={handlePress}>
<Text>Download QR Codes</Text>
</TouchableOpacity>
);
}

/\*\*

- Example 2: Navigate with parameters
  \*/
  export function NavigateToQRDownloadWithParams() {
  const navigation = useNavigation();

const handlePress = () => {
navigation.navigate('LocationQRDownload', {
preselectedCategory: 'exit_gates',
autostart: false,
});
};

return (
<TouchableOpacity onPress={handlePress}>
<Text>Download Gate QRs</Text>
</TouchableOpacity>
);
}

/\*\*

- Example 3: Using QRDownloadHistory component in a screen
  \*/
  import QRDownloadHistory from '../components/QRDownloadHistory';

export function DownloadManagementScreen() {
const [refreshKey, setRefreshKey] = React.useState(0);
const { colors } = useTheme();

return (
<View style={{ flex: 1, backgroundColor: colors.background }}>
<Text style={{ padding: 16, fontSize: 18, fontWeight: 'bold' }}>
Manage Downloads
</Text>

      <QRDownloadHistory
        key={refreshKey}
        onRefresh={() => {
          // Refresh the list
          setRefreshKey((prev) => prev + 1);
        }}
      />
    </View>

);
}

// ============================================================================
// IMPORT AND USE IN YOUR MAIN NAVIGATOR
// ============================================================================

/\*\*

- Example: How to use in your main navigation file
-
- import { AdminStackNavigator } from './navigation/AdminNavigator';
-
- export function RootNavigator() {
- return (
-     <NavigationContainer>
-       <AdminStackNavigator />
-     </NavigationContainer>
- );
- }
  \*/
