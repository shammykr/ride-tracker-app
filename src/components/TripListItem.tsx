import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TripSummary } from '../types';
import {
  formatCurrency,
  formatDateTime,
  formatDistance,
  formatDuration,
} from '../utils/format';

/** Fixed row height, so the FlatList can use getItemLayout instead of measuring. */
export const TRIP_ITEM_HEIGHT = 76;

interface Props {
  trip: TripSummary;
  onPress(tripId: string): void;
}

function TripListItemView({ trip, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(trip.id)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {formatDateTime(trip.completedAt)} · {trip.driverName}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {formatDistance(trip.distanceKm)} ·{' '}
          {formatDuration(trip.durationSeconds)} · {trip.vehicle}
        </Text>
      </View>
      <Text style={styles.fare}>
        {formatCurrency(trip.fare, trip.currency)}
      </Text>
    </Pressable>
  );
}

export const TripListItem = memo(TripListItemView);

const styles = StyleSheet.create({
  row: {
    height: TRIP_ITEM_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  pressed: { backgroundColor: '#f9fafb' },
  main: { flex: 1, marginRight: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  fare: { fontSize: 16, fontWeight: '600', color: '#111827' },
});
