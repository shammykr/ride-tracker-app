import {useNavigation, type NavigationProp} from '@react-navigation/native';
import {useMemo} from 'react';
import type {RootStackParamList} from './types';

/**
 * Coordinator: the only place that knows the route names and how screens are
 * connected. Screens express intent (`showTripDetail(id)`) and never call
 * `navigation.navigate` themselves, so flows can change without touching them.
 */
export function useCoordinator() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  return useMemo(
    () => ({
      showRide: () => navigation.navigate('Main', {screen: 'Ride'}),
      showHistory: () => navigation.navigate('Main', {screen: 'History'}),
      showTripDetail: (tripId: string) => navigation.navigate('TripDetail', {tripId}),
      back: () => navigation.goBack(),
    }),
    [navigation],
  );
}

export type Coordinator = ReturnType<typeof useCoordinator>;
