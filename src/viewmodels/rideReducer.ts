import type {ConnectionState, ServerEvents} from '../services/RideSocket';
import type {Coordinate, Driver, RidePhase, Trip} from '../types';

type Payload<E extends keyof ServerEvents> = Parameters<ServerEvents[E]>[0];

export interface RideState {
  connection: ConnectionState;
  phase: RidePhase;
  nearbyDrivers: Driver[];
  userLocation: Coordinate | null;
  pickup: Coordinate | null;
  dropoff: Coordinate | null;
  rideId: string | null;
  /** The assigned driver, with a live location. */
  driver: Driver | null;
  etaSeconds: number | null;
  remainingSeconds: number | null;
  startedAt: number | null;
  /** Points driven during the trip, pickup first. */
  route: Coordinate[];
  lastTrip: Trip | null;
  error: string | null;
}

export type RideAction =
  | {type: 'connection'; state: ConnectionState}
  | {type: 'nearbyDrivers'; drivers: Driver[]}
  | {type: 'userLocation'; location: Coordinate}
  | {type: 'setDropoff'; dropoff: Coordinate}
  | {type: 'requestStarted'; pickup: Coordinate}
  | {type: 'requestFailed'; error: string}
  | {type: 'driverAssigned'; payload: Payload<'driver_assigned'>}
  | {type: 'driverApproaching'; payload: Payload<'driver_approaching'>}
  | {type: 'driverArrived'; payload: Payload<'driver_arrived'>}
  | {type: 'tripStarted'; payload: Payload<'trip_started'>}
  | {type: 'tripProgress'; payload: Payload<'trip_progress'>}
  | {type: 'tripCompleted'; payload: Payload<'trip_completed'>}
  | {type: 'cancel'}
  | {type: 'dismiss'};

export const initialRideState: RideState = {
  connection: 'connecting',
  phase: 'idle',
  nearbyDrivers: [],
  userLocation: null,
  pickup: null,
  dropoff: null,
  rideId: null,
  driver: null,
  etaSeconds: null,
  remainingSeconds: null,
  startedAt: null,
  route: [],
  lastTrip: null,
  error: null,
};

/** Back to idle, keeping what isn't tied to a ride. */
function resetRide(state: RideState, overrides: Partial<RideState> = {}): RideState {
  return {
    ...initialRideState,
    connection: state.connection,
    nearbyDrivers: state.nearbyDrivers,
    userLocation: state.userLocation,
    ...overrides,
  };
}

const ACTIVE_PHASES: RidePhase[] = ['assigned', 'approaching', 'arrived', 'inProgress'];

/** Pure state machine for a ride: idle → requesting → assigned → approaching → arrived → inProgress → completed. */
export function rideReducer(state: RideState, action: RideAction): RideState {
  switch (action.type) {
    case 'connection':
      return {...state, connection: action.state};
    case 'nearbyDrivers':
      return {...state, nearbyDrivers: action.drivers};
    case 'userLocation':
      return {...state, userLocation: action.location};
    case 'setDropoff':
      return state.phase === 'idle' || state.phase === 'completed'
        ? {...resetRide(state), dropoff: action.dropoff}
        : state;
    case 'requestStarted':
      return state.phase === 'idle' && state.dropoff
        ? {...state, phase: 'requesting', pickup: action.pickup, error: null}
        : state;
    case 'requestFailed':
      return state.phase === 'requesting' ? {...state, phase: 'idle', error: action.error} : state;
    case 'driverAssigned':
      // The server sends driver_assigned right after accepting the request.
      if (state.phase !== 'requesting') {
        return state;
      }
      return {
        ...state,
        phase: 'assigned',
        rideId: action.payload.rideId,
        driver: action.payload.driver,
        etaSeconds: action.payload.etaSeconds,
      };
    case 'cancel':
      return ACTIVE_PHASES.includes(state.phase) || state.phase === 'requesting'
        ? resetRide(state, {dropoff: state.dropoff})
        : state;
    case 'dismiss':
      return state.phase === 'completed' ? resetRide(state) : state;
  }

  // Remaining actions are events for the current ride only.
  if (!state.driver || action.payload.rideId !== state.rideId) {
    return state;
  }
  switch (action.type) {
    case 'driverApproaching':
      return {
        ...state,
        phase: 'approaching',
        driver: {...state.driver, location: action.payload.location, heading: action.payload.heading},
        etaSeconds: action.payload.etaSeconds,
      };
    case 'driverArrived':
      return {
        ...state,
        phase: 'arrived',
        driver: {...state.driver, location: action.payload.location},
        etaSeconds: 0,
      };
    case 'tripStarted':
      return {
        ...state,
        phase: 'inProgress',
        startedAt: action.payload.startedAt,
        route: state.pickup ? [state.pickup] : [],
      };
    case 'tripProgress':
      return {
        ...state,
        driver: {...state.driver, location: action.payload.location, heading: action.payload.heading},
        remainingSeconds: action.payload.remainingSeconds,
        route: [...state.route, action.payload.location],
      };
    case 'tripCompleted': {
      if (!state.pickup || !state.dropoff) {
        return state;
      }
      const {payload} = action;
      const trip: Trip = {
        id: payload.rideId,
        driverName: state.driver.name,
        vehicle: state.driver.vehicle,
        pickup: state.pickup,
        dropoff: state.dropoff,
        fare: payload.fare,
        currency: payload.currency,
        distanceKm: payload.distanceKm,
        durationSeconds: payload.durationSeconds,
        startedAt: state.startedAt ?? payload.completedAt - payload.durationSeconds * 1000,
        completedAt: payload.completedAt,
        route: [...state.route, state.dropoff],
      };
      return {...state, phase: 'completed', remainingSeconds: 0, lastTrip: trip};
    }
  }
}
