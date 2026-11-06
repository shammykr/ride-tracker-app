import { createSelector } from 'reselect';
import type { RideState } from '../viewmodels/rideReducer';
import { formatEta } from '../utils/format';

const selectPhase = (state: RideState) => state.phase;
const selectNearby = (state: RideState) => state.nearbyDrivers;
const selectDriver = (state: RideState) => state.driver;
const selectEta = (state: RideState) => state.etaSeconds;
const selectRemaining = (state: RideState) => state.remainingSeconds;

/**
 * Drivers to draw: every nearby driver while idle, only the assigned one during
 * a ride. Memoized so the marker list keeps its identity between unrelated
 * state changes and memoized markers don't re-render.
 */
export const selectVisibleDrivers = createSelector(
  [selectPhase, selectNearby, selectDriver],
  (phase, nearby, driver) => {
    if (driver && phase !== 'idle' && phase !== 'requesting') {
      return [driver];
    }
    return nearby;
  },
);

export const selectStatusText = createSelector(
  [selectPhase, selectDriver, selectEta, selectRemaining],
  (phase, driver, eta, remaining) => {
    switch (phase) {
      case 'idle':
        return 'Tap the map to choose a destination';
      case 'requesting':
        return 'Finding you a driver…';
      case 'assigned':
      case 'approaching':
        return `${driver?.name ?? 'Your driver'} arrives in ${formatEta(eta)}`;
      case 'arrived':
        return `${driver?.name ?? 'Your driver'} has arrived`;
      case 'inProgress':
        return remaining === null
          ? 'On the way'
          : `Arriving in ${formatEta(remaining)}`;
      case 'completed':
        return 'You have arrived';
    }
  },
);

export const selectCanRequest = createSelector(
  [
    selectPhase,
    (state: RideState) => state.dropoff,
    (state: RideState) => state.connection,
  ],
  (phase, dropoff, connection) =>
    phase === 'idle' && dropoff !== null && connection === 'connected',
);

export const selectCanCancel = createSelector([selectPhase], phase =>
  ['requesting', 'assigned', 'approaching', 'arrived'].includes(phase),
);
