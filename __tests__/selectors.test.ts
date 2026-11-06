import {
  selectCanRequest,
  selectStatusText,
  selectVisibleDrivers,
} from '../src/selectors/rideSelectors';
import { selectTripStats } from '../src/selectors/tripSelectors';
import { initialRideState } from '../src/viewmodels/rideReducer';
import { driver, makeTrip } from './helpers/fakes';

describe('ride selectors', () => {
  const other = { ...driver, id: 'driver-2', name: 'Leo' };

  it('shows all nearby drivers when idle and only the assigned driver during a ride', () => {
    const idle = { ...initialRideState, nearbyDrivers: [driver, other] };
    expect(selectVisibleDrivers(idle)).toEqual([driver, other]);

    const riding = { ...idle, phase: 'approaching' as const, driver: other };
    expect(selectVisibleDrivers(riding)).toEqual([other]);
  });

  it('is memoized: unrelated state changes keep the same array', () => {
    const state = { ...initialRideState, nearbyDrivers: [driver, other] };
    const first = selectVisibleDrivers(state);
    const second = selectVisibleDrivers({
      ...state,
      userLocation: { latitude: 1, longitude: 1 },
    });
    expect(second).toBe(first);
  });

  it('describes the ride status', () => {
    expect(
      selectStatusText({
        ...initialRideState,
        phase: 'approaching',
        driver,
        etaSeconds: 120,
      }),
    ).toBe('Maya arrives in 2 min');
    expect(
      selectStatusText({ ...initialRideState, phase: 'arrived', driver }),
    ).toBe('Maya has arrived');
  });

  it('only allows a request when connected, idle and a drop-off is set', () => {
    const ready = {
      ...initialRideState,
      connection: 'connected' as const,
      dropoff: { latitude: 1, longitude: 2 },
    };
    expect(selectCanRequest(ready)).toBe(true);
    expect(selectCanRequest({ ...ready, connection: 'disconnected' })).toBe(
      false,
    );
    expect(selectCanRequest({ ...ready, dropoff: null })).toBe(false);
  });
});

describe('trip selectors', () => {
  it('totals trips and memoizes on the list identity', () => {
    const trips = [makeTrip('a', 1, 10), makeTrip('b', 2, 5.5)];
    const stats = selectTripStats(trips);
    expect(stats).toEqual({
      count: 2,
      totalSpent: 15.5,
      totalKm: 4,
      currency: 'USD',
    });
    expect(selectTripStats(trips)).toBe(stats);
  });
});
