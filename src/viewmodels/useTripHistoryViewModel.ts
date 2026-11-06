import { useCallback, useEffect, useRef, useState } from 'react';
import { TRIP_HISTORY_LIMIT } from '../config';
import { useAppServices } from '../context/AppServices';
import { selectTripStats } from '../selectors/tripSelectors';
import type { TripSummary } from '../types';

/** ViewModel for trip history: lightweight summaries (no routes) from the trip store. */
export function useTripHistoryViewModel() {
  const { tripStore } = useAppServices();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await tripStore.getTrips(TRIP_HISTORY_LIMIT);
      if (mounted.current) {
        setTrips(result);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [tripStore]);

  const clearHistory = useCallback(async () => {
    await tripStore.clearTrips();
    await reload();
  }, [tripStore, reload]);

  return {
    trips,
    loading,
    error,
    stats: selectTripStats(trips),
    reload,
    clearHistory,
  };
}
