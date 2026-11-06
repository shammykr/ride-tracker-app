import { createSelector } from 'reselect';
import type { TripSummary } from '../types';

const selectTrips = (trips: TripSummary[]) => trips;

/** Totals for the history header; recomputed only when the list changes. */
export const selectTripStats = createSelector([selectTrips], trips => ({
  count: trips.length,
  totalSpent: trips.reduce((sum, trip) => sum + trip.fare, 0),
  totalKm: trips.reduce((sum, trip) => sum + trip.distanceKm, 0),
  currency: trips[0]?.currency ?? 'USD',
}));
