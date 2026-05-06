import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

import LibraryAdminScreen from '../screens/LibraryAdminScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function LibraryAdminTabNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarPaddingBottom = Math.max(insets.bottom, 10);
  const tabBarHeight = 62 + tabBarPaddingBottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconName =
            route.name === 'Library'
              ? focused
                ? 'book'
                : 'book-outline'
              : focused
              ? 'person'
              : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: tabBarPaddingBottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Library" component={LibraryAdminScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
