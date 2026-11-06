import React, {useCallback, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import MapView, {Marker, Polyline, type MapPressEvent, type Region} from 'react-native-maps';
import {DriverMarker} from '../components/DriverMarker';
import {RideStatusCard} from '../components/RideStatusCard';
import {DEFAULT_REGION} from '../config';
import {useCoordinator} from '../navigation/useCoordinator';
import {useRideViewModel} from '../viewmodels/useRideViewModel';

/** Live map: nearby drivers, pickup/drop-off, and the assigned driver's progress. */
export function RideScreen() {
  const vm = useRideViewModel();
  const coordinator = useCoordinator();
  const {state} = vm;
  const center = useRef<Region>(DEFAULT_REGION);

  const onMapPress = useCallback(
    (event: MapPressEvent) => vm.setDropoff(event.nativeEvent.coordinate),
    [vm.setDropoff], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const onRegionChange = useCallback((region: Region) => {
    center.current = region;
  }, []);
  const onRequest = useCallback(
    () => vm.requestRide({latitude: center.current.latitude, longitude: center.current.longitude}),
    [vm.requestRide], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const onViewTrip = useCallback(() => {
    if (state.lastTrip) {
      coordinator.showTripDetail(state.lastTrip.id);
    }
  }, [coordinator, state.lastTrip]);

  const pickup = state.pickup ?? state.userLocation;
  const highlightedId = state.driver?.id;

  return (
    <View style={styles.container}>
      {/* On iOS react-native-maps renders Apple MapKit by default. */}
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        onPress={onMapPress}
        onRegionChangeComplete={onRegionChange}
        showsCompass={false}
        testID="ride-map">
        {vm.drivers.map(driver => (
          <DriverMarker key={driver.id} driver={driver} highlighted={driver.id === highlightedId} />
        ))}
        {pickup && <Marker coordinate={pickup} pinColor="#2563eb" title="Pickup" />}
        {state.dropoff && <Marker coordinate={state.dropoff} pinColor="#dc2626" title="Drop-off" />}
        {state.route.length > 1 && (
          <Polyline coordinates={state.route} strokeColor="#2563eb" strokeWidth={4} />
        )}
      </MapView>
      <RideStatusCard
        phase={state.phase}
        statusText={vm.statusText}
        driver={state.driver}
        lastTrip={state.lastTrip}
        connected={state.connection === 'connected'}
        error={state.error}
        canRequest={vm.canRequest}
        canCancel={vm.canCancel}
        onRequest={onRequest}
        onCancel={vm.cancelRide}
        onDismiss={vm.dismissTrip}
        onViewTrip={onViewTrip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
});
