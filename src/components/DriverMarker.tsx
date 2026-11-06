import React, {memo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Marker} from 'react-native-maps';
import type {Driver} from '../types';

interface Props {
  driver: Driver;
  highlighted?: boolean;
}

function DriverMarkerView({driver, highlighted = false}: Props) {
  return (
    <Marker
      identifier={driver.id}
      coordinate={driver.location}
      title={driver.name}
      description={driver.vehicle}
      rotation={driver.heading}
      flat
      anchor={{x: 0.5, y: 0.5}}
      // The custom view never changes on its own; skipping snapshots saves work on every tick.
      tracksViewChanges={false}>
      <View style={[styles.car, highlighted && styles.highlighted]}>
        <Text style={styles.glyph}>▲</Text>
      </View>
    </Marker>
  );
}

/**
 * Re-render only when this driver actually moved, turned or changed highlight.
 * The server pushes every driver on every tick, so most markers are skipped.
 */
export const DriverMarker = memo(
  DriverMarkerView,
  (prev, next) =>
    prev.highlighted === next.highlighted &&
    prev.driver.id === next.driver.id &&
    prev.driver.heading === next.driver.heading &&
    prev.driver.location.latitude === next.driver.location.latitude &&
    prev.driver.location.longitude === next.driver.location.longitude,
);

const styles = StyleSheet.create({
  car: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  highlighted: {backgroundColor: '#2563eb'},
  glyph: {color: '#fff', fontSize: 11},
});
