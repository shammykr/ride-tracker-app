import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { RideScreen } from '../screens/RideScreen';
import { TripHistoryScreen } from '../screens/TripHistoryScreen';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const tabIcon =
  (glyph: string) =>
  ({ color }: { color: string }) =>
    <Text style={[styles.icon, { color }]}>{glyph}</Text>;

/** Tabs: the live ride map and trip history. */
function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#111827' }}>
      <Tab.Screen
        name="Ride"
        component={RideScreen}
        options={{
          title: 'Ride',
          headerShown: false,
          tabBarIcon: tabIcon('◉'),
        }}
      />
      <Tab.Screen
        name="History"
        component={TripHistoryScreen}
        options={{ title: 'Trips', tabBarIcon: tabIcon('☰') }}
      />
    </Tab.Navigator>
  );
}

/**
 * Root of the navigation tree:
 *
 *   Stack
 *   ├── Main (tabs)
 *   │   ├── Ride      map, drivers, request/track a ride
 *   │   └── History   trip list
 *   └── TripDetail    pushed from History (module loaded lazily)
 */
export function AppCoordinator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TripDetail"
          // Lazy: the detail screen (and its map) is only required when first opened.
          getComponent={() =>
            require('../screens/TripDetailScreen').TripDetailScreen
          }
          options={{ title: 'Trip details' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 18 },
});
