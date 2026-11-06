import React, {memo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import type {Driver, RidePhase, Trip} from '../types';
import {formatCurrency, formatDistance, formatDuration} from '../utils/format';

interface Props {
  phase: RidePhase;
  statusText: string;
  driver: Driver | null;
  lastTrip: Trip | null;
  connected: boolean;
  error: string | null;
  canRequest: boolean;
  canCancel: boolean;
  onRequest(): void;
  onCancel(): void;
  onDismiss(): void;
  onViewTrip(): void;
}

function Button({label, onPress, kind = 'primary', disabled = false}: {
  label: string;
  onPress(): void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.button,
        kind === 'secondary' && styles.secondary,
        (pressed || disabled) && styles.dimmed,
      ]}>
      <Text style={[styles.buttonText, kind === 'secondary' && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

function RideStatusCardView(props: Props) {
  const {phase, statusText, driver, lastTrip, connected, error} = props;
  return (
    <View style={styles.card}>
      {!connected && <Text style={styles.offline}>Connecting to the ride server…</Text>}
      <View style={styles.row}>
        {phase === 'requesting' && <ActivityIndicator style={styles.spinner} />}
        <Text style={styles.status} testID="ride-status">
          {statusText}
        </Text>
      </View>
      {driver && phase !== 'completed' && (
        <Text style={styles.driver}>
          {driver.name} · ★ {driver.rating.toFixed(2)} · {driver.vehicle}
        </Text>
      )}
      {phase === 'completed' && lastTrip && (
        <Text style={styles.driver}>
          {formatCurrency(lastTrip.fare, lastTrip.currency)} · {formatDistance(lastTrip.distanceKm)} ·{' '}
          {formatDuration(lastTrip.durationSeconds)}
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        {phase === 'idle' && (
          <Button label="Request ride" onPress={props.onRequest} disabled={!props.canRequest} />
        )}
        {props.canCancel && <Button label="Cancel" kind="secondary" onPress={props.onCancel} />}
        {phase === 'completed' && (
          <>
            <Button label="View trip" kind="secondary" onPress={props.onViewTrip} />
            <Button label="Done" onPress={props.onDismiss} />
          </>
        )}
      </View>
    </View>
  );
}

export const RideStatusCard = memo(RideStatusCardView);

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
    gap: 6,
  },
  row: {flexDirection: 'row', alignItems: 'center'},
  spinner: {marginRight: 8},
  status: {fontSize: 18, fontWeight: '600', color: '#111827', flexShrink: 1},
  driver: {fontSize: 14, color: '#4b5563'},
  offline: {fontSize: 13, color: '#b45309'},
  error: {fontSize: 13, color: '#b91c1c'},
  actions: {flexDirection: 'row', gap: 8, marginTop: 6},
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  secondary: {backgroundColor: '#f3f4f6'},
  dimmed: {opacity: 0.5},
  buttonText: {color: '#fff', fontWeight: '600', fontSize: 16},
  secondaryText: {color: '#111827'},
});
