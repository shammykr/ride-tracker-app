import {
  initialRideState,
  rideReducer,
  type RideAction,
  type RideState,
} from '../src/viewmodels/rideReducer';
import { driver } from './helpers/fakes';

const pickup = { latitude: 37.77, longitude: -122.42 };
const dropoff = { latitude: 37.79, longitude: -122.4 };

function run(actions: RideAction[], state: RideState = initialRideState) {
  return actions.reduce(rideReducer, state);
}

const toAssigned: RideAction[] = [
  { type: 'connection', state: 'connected' },
  { type: 'setDropoff', dropoff },
  { type: 'requestStarted', pickup },
  { type: 'driverAssigned', payload: { rideId: 'r1', driver, etaSeconds: 12 } },
];

describe('rideReducer', () => {
  it('walks through the full ride lifecycle and builds the trip', () => {
    let state = run(toAssigned);
    expect(state.phase).toBe('assigned');
    expect(state.etaSeconds).toBe(12);

    const moved = { latitude: 37.775, longitude: -122.415 };
    state = run(
      [
        {
          type: 'driverApproaching',
          payload: {
            rideId: 'r1',
            location: moved,
            heading: 45,
            etaSeconds: 5,
          },
        },
      ],
      state,
    );
    expect(state.phase).toBe('approaching');
    expect(state.driver?.location).toEqual(moved);
    expect(state.driver?.heading).toBe(45);

    const mid = { latitude: 37.78, longitude: -122.41 };
    state = run(
      [
        { type: 'driverArrived', payload: { rideId: 'r1', location: pickup } },
        { type: 'tripStarted', payload: { rideId: 'r1', startedAt: 1000 } },
        {
          type: 'tripProgress',
          payload: {
            rideId: 'r1',
            location: mid,
            heading: 30,
            remainingSeconds: 8,
          },
        },
      ],
      state,
    );
    expect(state.phase).toBe('inProgress');
    expect(state.route).toEqual([pickup, mid]);
    expect(state.remainingSeconds).toBe(8);

    state = rideReducer(state, {
      type: 'tripCompleted',
      payload: {
        rideId: 'r1',
        completedAt: 61000,
        durationSeconds: 60,
        distanceKm: 2.8,
        fare: 7.4,
        currency: 'USD',
      },
    });
    expect(state.phase).toBe('completed');
    expect(state.lastTrip).toEqual({
      id: 'r1',
      driverName: 'Maya',
      vehicle: driver.vehicle,
      pickup,
      dropoff,
      fare: 7.4,
      currency: 'USD',
      distanceKm: 2.8,
      durationSeconds: 60,
      startedAt: 1000,
      completedAt: 61000,
      route: [pickup, mid, dropoff],
    });

    state = rideReducer(state, { type: 'dismiss' });
    expect(state.phase).toBe('idle');
    expect(state.connection).toBe('connected');
  });

  it('ignores events for a different ride', () => {
    const state = run(toAssigned);
    const next = rideReducer(state, {
      type: 'driverArrived',
      payload: { rideId: 'other', location: pickup },
    });
    expect(next).toBe(state);
  });

  it('needs a drop-off before requesting', () => {
    const state = rideReducer(initialRideState, {
      type: 'requestStarted',
      pickup,
    });
    expect(state.phase).toBe('idle');
  });

  it('returns to idle with an error when the request fails', () => {
    const state = run([
      { type: 'setDropoff', dropoff },
      { type: 'requestStarted', pickup },
      { type: 'requestFailed', error: 'No drivers available' },
    ]);
    expect(state.phase).toBe('idle');
    expect(state.error).toBe('No drivers available');
    expect(state.dropoff).toEqual(dropoff);
  });

  it('cancels an active ride but keeps the destination', () => {
    const state = rideReducer(run(toAssigned), { type: 'cancel' });
    expect(state.phase).toBe('idle');
    expect(state.driver).toBeNull();
    expect(state.dropoff).toEqual(dropoff);
  });

  it('does not change the destination mid-ride', () => {
    const state = run(toAssigned);
    expect(rideReducer(state, { type: 'setDropoff', dropoff: pickup })).toBe(
      state,
    );
  });
});
