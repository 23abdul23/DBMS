import { createStackNavigator } from '@react-navigation/stack';

import SecurityAdminScreen from '../screens/SecurityAdminScreen';
import EditLocationScreen from '../screens/EditLocationScreen';

const Stack = createStackNavigator();

export default function SecurityAdminStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SecurityAdminHome" component={SecurityAdminScreen} />
      <Stack.Screen name="EditLocation" component={EditLocationScreen} />
    </Stack.Navigator>
  );
}
