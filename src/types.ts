export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Driver {
  id: string;
  name: string;
  vehicle: string;
  rating: number;
  location: Coordinate;
  heading: number;
}

export type RidePhase =
  | 'idle'
  | 'requesting'
  | 'assigned'
  | 'approaching'
  | 'arrived'
  | 'inProgress'
  | 'completed';

/** A trip as stored in history. Timestamps are epoch milliseconds. */
export interface TripSummary {
  id: string;
  driverName: string;
  vehicle: string;
  pickup: Coordinate;
  dropoff: Coordinate;
  fare: number;
  currency: string;
  distanceKm: number;
  durationSeconds: number;
  startedAt: number;
  completedAt: number;
}

/** Full trip details, loaded only when a trip is opened. */
export interface Trip extends TripSummary {
  route: Coordinate[];
}
