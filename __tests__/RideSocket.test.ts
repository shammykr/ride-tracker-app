import { RideSocket } from '../src/services/RideSocket';

/** Minimal socket.io client double. */
function fakeIo(ack: unknown, error: Error | null = null) {
  const handlers: Record<string, Function[]> = {};
  const socket = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn((event: string, handler: Function) => {
      (handlers[event] ??= []).push(handler);
    }),
    off: jest.fn((event: string, handler: Function) => {
      handlers[event] = (handlers[event] ?? []).filter(h => h !== handler);
    }),
    io: { on: jest.fn(), off: jest.fn() },
    timeout: jest.fn(() => ({
      emit: (_event: string, _payload: unknown, callback: Function) =>
        callback(error, ack),
    })),
  };
  return { socket, handlers };
}

const request = {
  pickup: { latitude: 1, longitude: 2 },
  dropoff: { latitude: 3, longitude: 4 },
};

describe('RideSocket', () => {
  it('resolves the ride id when the server accepts the request', async () => {
    const { socket } = fakeIo({ ok: true, rideId: 'ride-9' });
    const rides = new RideSocket('http://test', socket as never);
    await expect(rides.requestRide(request)).resolves.toBe('ride-9');
  });

  it('rejects with the server reason', async () => {
    const { socket } = fakeIo({ ok: false, error: 'No drivers available' });
    const rides = new RideSocket('http://test', socket as never);
    await expect(rides.requestRide(request)).rejects.toThrow(
      'No drivers available',
    );
  });

  it('rejects when the server does not answer in time', async () => {
    const { socket } = fakeIo(undefined, new Error('timeout'));
    const rides = new RideSocket('http://test', socket as never);
    await expect(rides.requestRide(request)).rejects.toThrow('did not respond');
  });

  it('subscribes and unsubscribes from server events', () => {
    const { socket, handlers } = fakeIo(null);
    const rides = new RideSocket('http://test', socket as never);
    const handler = jest.fn();
    const off = rides.on('driver_arrived', handler);
    handlers.driver_arrived[0]({
      rideId: 'r',
      location: { latitude: 0, longitude: 0 },
    });
    expect(handler).toHaveBeenCalledTimes(1);
    off();
    expect(handlers.driver_arrived).toHaveLength(0);
  });
});
