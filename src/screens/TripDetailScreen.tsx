import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { RootStackParamList } from '../navigation/types';
import { regionForCoordinates } from '../utils/geo';
import {
  formatCurrency,
  formatDateTime,
  formatDistance,
  formatDuration,
} from '../utils/format';
import { useTripDetailViewModel } from '../viewmodels/useTripDetailViewModel';

type Props = NativeStackScreenProps<RootStackParamList, 'TripDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

/** Loaded lazily by the navigator; fetches the full trip (with route) on open. */
export function TripDetailScreen({ route }: Props) {
  const { trip, loading, error } = useTripDetailViewModel(route.params.tripId);
  const region = useMemo(
    () =>
      trip
        ? regionForCoordinates([trip.pickup, trip.dropoff, ...trip.route])
        : undefined,
    [trip],
  );

  if (loading) {
    return <ActivityIndicator style={styles.centered} />;
  }
  if (!trip) {
    return <Text style={styles.error}>{error ?? 'Trip not found'}</Text>;
  }
  return (
    <ScrollView>
      <MapView
        style={styles.map}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        <Marker coordinate={trip.pickup} pinColor="#2563eb" title="Pickup" />
        <Marker coordinate={trip.dropoff} pinColor="#dc2626" title="Drop-off" />
        {trip.route.length > 1 && (
          <Polyline
            coordinates={trip.route}
            strokeColor="#2563eb"
            strokeWidth={4}
          />
        )}
      </MapView>
      <View style={styles.details}>
        <Text style={styles.fare}>
          {formatCurrency(trip.fare, trip.currency)}
        </Text>
        <Row label="Driver" value={trip.driverName} />
        <Row label="Vehicle" value={trip.vehicle} />
        <Row label="Started" value={formatDateTime(trip.startedAt)} />
        <Row label="Completed" value={formatDateTime(trip.completedAt)} />
        <Row label="Distance" value={formatDistance(trip.distanceKm)} />
        <Row label="Duration" value={formatDuration(trip.durationSeconds)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1 },
  error: { padding: 24, fontSize: 16, color: '#b91c1c' },
  map: { height: 260 },
  details: { padding: 16 },
  fare: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  label: { fontSize: 15, color: '#6b7280' },
  value: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
});
