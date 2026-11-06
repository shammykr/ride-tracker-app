import { createMemoryTripStore } from '../src/native/TripStore';
import { makeTrip } from './helpers/fakes';

describe('memory trip store (same contract as the Swift Core Data module)', () => {
  it('lists summaries newest first without routes and loads details by id', async () => {
    const store = createMemoryTripStore();
    await store.saveTrip(makeTrip('old', 1000));
    await store.saveTrip(makeTrip('new', 3000));
    await store.saveTrip(makeTrip('mid', 2000));

    const trips = await store.getTrips(10);
    expect(trips.map(trip => trip.id)).toEqual(['new', 'mid', 'old']);
    expect(trips.every(trip => !('route' in trip))).toBe(true);
    expect(await store.getTrips(1)).toHaveLength(1);

    expect((await store.getTrip('mid'))?.route).toHaveLength(2);
    expect(await store.getTrip('missing')).toBeNull();

    await store.clearTrips();
    expect(await store.getTrips(10)).toEqual([]);
  });

  it('replaces a trip saved again with the same id', async () => {
    const store = createMemoryTripStore();
    await store.saveTrip(makeTrip('a', 1000, 10));
    await store.saveTrip(makeTrip('a', 1000, 20));
    expect(await store.getTrips(10)).toEqual([
      expect.objectContaining({ id: 'a', fare: 20 }),
    ]);
  });
});
