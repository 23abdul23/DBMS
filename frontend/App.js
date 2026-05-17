import React, { useEffect, useState } from 'react';
import { ScrollView, Platform, StyleSheet, View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { LocationAccessDeniedProvider } from './context/LocationAccessDeniedContext';
import { ThemeProvider } from './context/ThemeContext'; // Make sure to import ThemeProvider
import MainTabNavigator from './navigation/MainTabNavigator';
import WardenTabNavigator from './navigation/WardenTabNavigator';
import SacAdminTabNavigator from './navigation/SacAdminTabNavigator';
import LibraryAdminTabNavigator from './navigation/LibraryAdminTabNavigator';
import SecurityAdminTabNavigator from './navigation/SecurityAdminTabNavigator';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import LoadingScreen from './screens/LoadingScreen';
import SACScreen from './screens/SACScreen';
import ClubRoomScreen from './screens/ClubRoomScreen';
import EquipmentScreen from './screens/EquipmentScreen';
import SACAdminScreen from './screens/SACAdminScreen';
import SACAdminClubRoomScreen from './screens/SACAdminClubRoomScreen';
import SACAdminEquipmentScreen from './screens/SACAdminEquipmentScreen';
import CreateOutpassScreen from './screens/CreateOutpassScreen';
import Scanner from './screens/ScannerScreen';
import LibraryScreen from './screens/LibraryScreen';
import LibraryAdminScreen from './screens/LibraryAdminScreen';
import LogBook from './screens/LogBookScreen';
import ProfileScreen from './screens/ProfileScreen';
import GuardDashboardScreen from './screens/GuardScreen';
import AppStartupSplash from './components/AppStartupSplash';
import NotificationsScreen from './screens/NotificationsScreen';
import { useTheme } from './context/ThemeContext';
import { NotificationProvider } from './notifications/notificationProvider';
import {
  navigationRef,
  setNavigationReady,
} from './notifications/notificationNavigation';
import {
  isLibraryAdministrator,
  isSacAdministrator,
  isSecurityAdministrator,
} from './utils/adminScopes';
const Stack = createStackNavigator();

function RootNavigator() {
  const { user, loading } = useAuth();
  const { isDarkMode, colors } = useTheme();

  useEffect(() => {
    return () => setNavigationReady(false);
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  const navigationTheme = {
    ...(isDarkMode ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDarkMode ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.header,
      border: colors.border,
      text: colors.text,
      primary: colors.primary,
      notification: colors.danger,
    },
  };

  return (
    <NavigationContainer
      theme={navigationTheme}
      ref={navigationRef}
      onReady={() => setNavigationReady(true)}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          user.role === 'student' ? (
            <>
              <Stack.Screen name="Main" component={MainTabNavigator} />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
              />
              <Stack.Screen name="SAC" component={SACScreen} />
              <Stack.Screen name="ClubRooms" component={ClubRoomScreen} />
              <Stack.Screen name="Equipments" component={EquipmentScreen} />
              <Stack.Screen
                name="CreateOutpass"
                component={CreateOutpassScreen}
              />
              <Stack.Screen name="Scan" component={Scanner} />
              <Stack.Screen name="Library" component={LibraryScreen} />
            </>
          ) : user.role === 'warden' ? (
            <>
              <Stack.Screen name="WardenMain" component={WardenTabNavigator} />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
              />
            </>
          ) : isSecurityAdministrator(user) ? (
            <>
              <Stack.Screen
                name="SecurityAdminMain"
                component={SecurityAdminTabNavigator}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
              />
            </>
          ) : isSacAdministrator(user) ? (
            <>
              <Stack.Screen
                name="SacAdminMain"
                component={SacAdminTabNavigator}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
              />
            </>
          ) : isLibraryAdministrator(user) ? (
            <>
              <Stack.Screen
                name="LibraryAdminMain"
                component={LibraryAdminTabNavigator}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
              />
            </>
          ) : user.role === 'admin' ? (
            <>
              <Stack.Screen
                name="SecurityAdminMain"
                component={SecurityAdminTabNavigator}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="GuardMain" component={GuardDashboardScreen} />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
              />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="SAC" component={SACAdminScreen} />
              <Stack.Screen
                name="ClubRooms"
                component={SACAdminClubRoomScreen}
              />
              <Stack.Screen
                name="Equipments"
                component={SACAdminEquipmentScreen}
              />
              <Stack.Screen
                name="CreateOutpass"
                component={CreateOutpassScreen}
              />
              <Stack.Screen name="Scan" component={Scanner} />
              <Stack.Screen name="Library" component={LibraryAdminScreen} />
              <Stack.Screen name="LogBook" component={LogBook} />
            </>
          )
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [showStartupSplash, setShowStartupSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowStartupSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const content = (
    <LocationProvider>
      <AuthProvider>
        <LocationAccessDeniedProvider>
          <NotificationProvider>
            <RootNavigator />
          </NotificationProvider>
        </LocationAccessDeniedProvider>
      </AuthProvider>
    </LocationProvider>
  );

  if (Platform.OS === 'web') {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          {showStartupSplash ? (
            <AppStartupSplash />
          ) : (
            <ScrollView
              contentContainerStyle={styles.webContainer}
              style={{ flex: 1 }}
            >
              <View style={styles.inner}>{content}</View>
            </ScrollView>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {showStartupSplash ? <AppStartupSplash /> : content}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    minHeight: '100vh',
    flexGrow: 1,
    flexDirection: 'column',
  },
  inner: {
    flex: 1,
    minHeight: '100vh',
  },
});
