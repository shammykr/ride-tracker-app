import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useAppServices } from '../context/AppServices';
import {
  selectCanCancel,
  selectCanRequest,
  selectStatusText,
  selectVisibleDrivers,
} from '../selectors/rideSelectors';
import type { Coordinate } from '../types';
import { formatCurrency } from '../utils/format';
import { initialRideState, rideReducer } from './rideReducer';

/**
 * ViewModel for the ride screen: owns the WebSocket subscription, the user's
 * location and the ride state machine, and turns phase changes into haptics,
 * notifications and a saved trip. The screen only renders what this returns.
 */
export function useRideViewModel() {
  const { socket, location, haptics, notify, tripStore } = useAppServices();
  const [state, dispatch] = useReducer(rideReducer, initialRideState);

  // WebSocket: connection state and server events.
  useEffect(() => {
    const unsubscribers = [
      socket.onConnectionChange(connection =>
        dispatch({ type: 'connection', state: connection }),
      ),
      socket.on('nearby_drivers', ({ drivers }) =>
        dispatch({ type: 'nearbyDrivers', drivers }),
      ),
      socket.on('driver_assigned', payload =>
        dispatch({ type: 'driverAssigned', payload }),
      ),
      socket.on('driver_approaching', payload =>
        dispatch({ type: 'driverApproaching', payload }),
      ),
      socket.on('driver_arrived', payload =>
        dispatch({ type: 'driverArrived', payload }),
      ),
      socket.on('trip_started', payload =>
        dispatch({ type: 'tripStarted', payload }),
      ),
      socket.on('trip_progress', payload =>
        dispatch({ type: 'tripProgress', payload }),
      ),
      socket.on('trip_completed', payload =>
        dispatch({ type: 'tripCompleted', payload }),
      ),
    ];
    socket.connect();
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      socket.disconnect();
    };
  }, [socket]);

  // Foreground location from the Swift LocationService module.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    location
      .watchPosition(position =>
        dispatch({
          type: 'userLocation',
          location: {
            latitude: position.latitude,
            longitude: position.longitude,
          },
        }),
      )
      .then(unsubscribe => {
        if (cancelled) {
          unsubscribe();
        } else {
          stop = unsubscribe;
        }
      })
      .catch(() => {
        // Permission denied or no native module: the map's centre is used as pickup.
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [location]);

  // Side effects of entering a phase (each runs once per transition).
  const previousPhase = useRef(state.phase);
  useEffect(() => {
    if (previousPhase.current === state.phase) {
      return;
    }
    previousPhase.current = state.phase;
    const driverName = state.driver?.name ?? 'Your driver';
    switch (state.phase) {
      case 'assigned':
        haptics.impact('light');
        notify(
          'Driver assigned',
          `${driverName} is on the way · ${state.driver?.vehicle ?? ''}`,
        );
        break;
      case 'arrived':
        haptics.impact('heavy');
        notify(
          'Your driver has arrived',
          `${driverName} is waiting at the pickup point`,
        );
        break;
      case 'inProgress':
        haptics.impact('medium');
        break;
      case 'completed':
        haptics.impact('rigid');
        if (state.lastTrip) {
          const trip = state.lastTrip;
          notify(
            'Trip completed',
            `${formatCurrency(trip.fare, trip.currency)} with ${driverName}`,
          );
          tripStore
            .saveTrip(trip)
            .catch(error => console.warn('Could not save trip', error));
        }
        break;
    }
  }, [state.phase, state.driver, state.lastTrip, haptics, notify, tripStore]);

  const setDropoff = useCallback((dropoff: Coordinate) => {
    dispatch({ type: 'setDropoff', dropoff });
  }, []);

  /** `fallbackPickup` (e.g. the map centre) is used when there is no location fix. */
  const requestRide = useCallback(
    async (fallbackPickup: Coordinate) => {
      if (!state.dropoff) {
        return;
      }
      const pickup = state.userLocation ?? fallbackPickup;
      dispatch({ type: 'requestStarted', pickup });
      haptics.impact('soft');
      try {
        await socket.requestRide({ pickup, dropoff: state.dropoff });
      } catch (error) {
        dispatch({ type: 'requestFailed', error: (error as Error).message });
      }
    },
    [socket, haptics, state.dropoff, state.userLocation],
  );

  const cancelRide = useCallback(() => {
    socket.cancelRide();
    dispatch({ type: 'cancel' });
  }, [socket]);

  const dismissTrip = useCallback(() => dispatch({ type: 'dismiss' }), []);

  return {
    state,
    drivers: selectVisibleDrivers(state),
    statusText: selectStatusText(state),
    canRequest: selectCanRequest(state),
    canCancel: selectCanCancel(state),
    setDropoff,
    requestRide,
    cancelRide,
    dismissTrip,
  };
}

export type RideViewModel = ReturnType<typeof useRideViewModel>;
