import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import {
  AppServicesProvider,
  type AppServices,
} from '../src/context/AppServices';
import { createMemoryTripStore } from '../src/native/TripStore';
import type { RideSocket } from '../src/services/RideSocket';
import { useRideViewModel } from '../src/viewmodels/useRideViewModel';
import { useTripDetailViewModel } from '../src/viewmodels/useTripDetailViewModel';
import { useTripHistoryViewModel } from '../src/viewmodels/useTripHistoryViewModel';
import { driver, FakeRideSocket, makeTrip } from './helpers/fakes';

function setup(overrides: Partial<AppServices> = {}) {
  const socket = new FakeRideSocket();
  const services = {
    socket: socket as unknown as RideSocket,
    tripStore: createMemoryTripStore(),
    location: {
      getCurrentPosition: jest.fn(),
      watchPosition: jest.fn(async () => () => {}),
    },
    haptics: { impact: jest.fn() },
    notify: jest.fn(),
    ...overrides,
  } as AppServices;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppServicesProvider services={services}>{children}</AppServicesProvider>
  );
  return { socket, services, wrapper };
}

describe('useRideViewModel', () => {
  it('requests a ride, reacts to live events and saves the completed trip', async () => {
    const { socket, services, wrapper } = setup();
    const { result } = await renderHook(() => useRideViewModel(), { wrapper });
    expect(socket.connected).toBe(true);
    expect(result.current.state.connection).toBe('connected');

    await act(async () => {
      socket.emit('nearby_drivers', { drivers: [driver], timestamp: 0 });
    });
    expect(result.current.drivers).toEqual([driver]);

    const dropoff = { latitude: 37.79, longitude: -122.4 };
    const mapCenter = { latitude: 37.77, longitude: -122.42 };
    await act(async () => {
      result.current.setDropoff(dropoff);
    });
    expect(result.current.canRequest).toBe(true);
    await act(() => result.current.requestRide(mapCenter));
    expect(socket.requests).toEqual([{ pickup: mapCenter, dropoff }]);
    expect(result.current.state.phase).toBe('requesting');

    await act(async () => {
      socket.emit('driver_assigned', {
        rideId: 'ride-1',
        driver,
        etaSeconds: 30,
      });
    });
    expect(result.current.state.phase).toBe('assigned');
    expect(services.notify).toHaveBeenCalledWith(
      'Driver assigned',
      expect.stringContaining('Maya'),
    );
    expect(services.haptics.impact).toHaveBeenCalledWith('light');

    await act(async () => {
      socket.emit('driver_arrived', { rideId: 'ride-1', location: mapCenter });
      socket.emit('trip_started', { rideId: 'ride-1', startedAt: 1000 });
      socket.emit('trip_completed', {
        rideId: 'ride-1',
        completedAt: 61000,
        durationSeconds: 60,
        distanceKm: 2.5,
        fare: 6.9,
        currency: 'USD',
      });
    });
    expect(result.current.state.phase).toBe('completed');
    await waitFor(async () => {
      expect(await services.tripStore.getTrip('ride-1')).toEqual(
        expect.objectContaining({
          fare: 6.9,
          driverName: 'Maya',
          route: [mapCenter, dropoff],
        }),
      );
    });
    expect(services.notify).toHaveBeenCalledWith(
      'Trip completed',
      '$6.90 with Maya',
    );
  });

  it('surfaces a rejected request', async () => {
    const { socket, wrapper } = setup();
    socket.rejectWith = 'No drivers available';
    const { result } = await renderHook(() => useRideViewModel(), { wrapper });
    await act(async () => {
      result.current.setDropoff({ latitude: 1, longitude: 1 });
    });
    await act(() => result.current.requestRide({ latitude: 0, longitude: 0 }));
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.state.error).toBe('No drivers available');
  });
});

describe('trip history view models', () => {
  it('loads summaries with stats, then the full trip lazily', async () => {
    const tripStore = createMemoryTripStore([
      makeTrip('a', 1000, 10),
      makeTrip('b', 2000, 4),
    ]);
    const getTrip = jest.spyOn(tripStore, 'getTrip');
    const { wrapper } = setup({ tripStore });

    const history = await renderHook(() => useTripHistoryViewModel(), {
      wrapper,
    });
    await act(() => history.result.current.reload());
    expect(history.result.current.trips.map(trip => trip.id)).toEqual([
      'b',
      'a',
    ]);
    expect(history.result.current.stats.totalSpent).toBe(14);
    expect(getTrip).not.toHaveBeenCalled();

    const detail = await renderHook(() => useTripDetailViewModel('a'), {
      wrapper,
    });
    await waitFor(() => expect(detail.result.current.loading).toBe(false));
    expect(getTrip).toHaveBeenCalledWith('a');
    expect(detail.result.current.trip?.route).toHaveLength(2);
  });
});
