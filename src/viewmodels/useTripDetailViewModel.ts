import { useEffect, useState } from 'react';
import { useAppServices } from '../context/AppServices';
import type { Trip } from '../types';

/**
 * ViewModel for one trip. The full record (with its route) is loaded lazily,
 * only when the detail screen opens; the history list never fetches routes.
 */
export function useTripDetailViewModel(tripId: string) {
  const { tripStore } = useAppServices();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    tripStore
      .getTrip(tripId)
      .then(result => {
        if (active) {
          setTrip(result);
          setError(result ? null : 'Trip not found');
        }
      })
      .catch(e => active && setError((e as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [tripId, tripStore]);

  return { trip, loading, error };
}
