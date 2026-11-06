import type { RideRequest, ServerEvents } from '../../src/services/RideSocket';
import type { Driver, Trip } from '../../src/types';

type Handler = (payload: never) => void;

/** In-process stand-in for RideSocket: tests push server events with `emit`. */
export class FakeRideSocket {
  handlers = new Map<string, Set<Handler>>();
  connectionHandlers = new Set<
    (state: 'connecting' | 'connected' | 'disconnected') => void
  >();
  requests: RideRequest[] = [];
  cancelled = 0;
  connected = false;
  nextRideId = 'ride-1';
  rejectWith: string | null = null;

  connect() {
    this.connected = true;
    this.connectionHandlers.forEach(handler => handler('connected'));
  }
  disconnect() {
    this.connected = false;
  }
  on<E extends keyof ServerEvents>(event: E, handler: ServerEvents[E]) {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as Handler);
    this.handlers.set(event, set);
    return () => set.delete(handler as Handler);
  }
  onConnectionChange(
    handler: (state: 'connecting' | 'connected' | 'disconnected') => void,
  ) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }
  async requestRide(request: RideRequest) {
    this.requests.push(request);
    if (this.rejectWith) {
      throw new Error(this.rejectWith);
    }
    return this.nextRideId;
  }
  cancelRide() {
    this.cancelled += 1;
  }
  emit<E extends keyof ServerEvents>(
    event: E,
    payload: Parameters<ServerEvents[E]>[0],
  ) {
    this.handlers
      .get(event)
      ?.forEach(handler => (handler as (p: typeof payload) => void)(payload));
  }
}

export const driver: Driver = {
  id: 'driver-1',
  name: 'Maya',
  vehicle: 'Toyota Prius · 7ABC123',
  rating: 4.9,
  location: { latitude: 37.78, longitude: -122.41 },
  heading: 90,
};

export function makeTrip(id: string, completedAt: number, fare = 10): Trip {
  return {
    id,
    driverName: 'Maya',
    vehicle: 'Toyota Prius',
    pickup: { latitude: 1, longitude: 2 },
    dropoff: { latitude: 3, longitude: 4 },
    fare,
    currency: 'USD',
    distanceKm: 2,
    durationSeconds: 300,
    startedAt: completedAt - 300_000,
    completedAt,
    route: [
      { latitude: 1, longitude: 2 },
      { latitude: 3, longitude: 4 },
    ],
  };
}
