import {NativeModules} from 'react-native';
import type {Trip, TripSummary} from '../types';

export interface TripStore {
  saveTrip(trip: Trip): Promise<void>;
  /** Newest first, without routes. */
  getTrips(limit: number): Promise<TripSummary[]>;
  /** Full trip including its route, or null. */
  getTrip(id: string): Promise<Trip | null>;
  clearTrips(): Promise<void>;
}

/**
 * In-memory implementation with the same contract, used where the Swift Core
 * Data module doesn't exist (Android, Jest).
 */
export function createMemoryTripStore(initial: Trip[] = []): TripStore {
  const trips = new Map(initial.map(trip => [trip.id, trip]));
  return {
    async saveTrip(trip) {
      trips.set(trip.id, trip);
    },
    async getTrips(limit) {
      return [...trips.values()]
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, limit)
        .map(({route: _route, ...summary}) => summary);
    },
    async getTrip(id) {
      return trips.get(id) ?? null;
    },
    async clearTrips() {
      trips.clear();
    },
  };
}

/** Swift module backed by Core Data (ios/RideTracker/NativeModules/TripStore.swift). */
const native: TripStore | undefined = NativeModules.TripStore;

export const tripStore: TripStore = native ?? createMemoryTripStore();
export const isPersistent = Boolean(native);
