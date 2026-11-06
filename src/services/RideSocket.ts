import {io, type Socket} from 'socket.io-client';
import type {Coordinate, Driver} from '../types';

/** Events sent by the mock server (server/index.js). */
export interface ServerEvents {
  nearby_drivers: (payload: {drivers: Driver[]; timestamp: number}) => void;
  driver_assigned: (payload: {rideId: string; driver: Driver; etaSeconds: number}) => void;
  driver_approaching: (payload: {
    rideId: string;
    location: Coordinate;
    heading: number;
    etaSeconds: number;
  }) => void;
  driver_arrived: (payload: {rideId: string; location: Coordinate}) => void;
  trip_started: (payload: {rideId: string; startedAt: number}) => void;
  trip_progress: (payload: {
    rideId: string;
    location: Coordinate;
    heading: number;
    remainingSeconds: number;
  }) => void;
  trip_completed: (payload: {
    rideId: string;
    completedAt: number;
    durationSeconds: number;
    distanceKm: number;
    fare: number;
    currency: string;
  }) => void;
}

export interface RideRequest {
  pickup: Coordinate;
  dropoff: Coordinate;
}

type Ack = {ok: true; rideId: string} | {ok: false; error: string};

interface ClientEvents {
  request_ride: (request: RideRequest, ack: (response: Ack) => void) => void;
  cancel_ride: () => void;
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

/** Thin typed wrapper around socket.io-client for the ride events. */
export class RideSocket {
  private socket: Socket<ServerEvents, ClientEvents>;

  constructor(url: string, socket?: Socket<ServerEvents, ClientEvents>) {
    this.socket =
      socket ??
      io(url, {
        transports: ['websocket'],
        autoConnect: false,
        reconnectionDelayMax: 5000,
      });
  }

  connect(): void {
    this.socket.connect();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  on<E extends keyof ServerEvents>(event: E, handler: ServerEvents[E]): () => void {
    // socket.io's overloads can't follow the generic key; the types above are the contract.
    (this.socket.on as (e: string, h: unknown) => void)(event, handler);
    return () => {
      (this.socket.off as (e: string, h: unknown) => void)(event, handler);
    };
  }

  onConnectionChange(handler: (state: ConnectionState) => void): () => void {
    const connected = () => handler('connected');
    const disconnected = () => handler('disconnected');
    const reconnecting = () => handler('connecting');
    this.socket.on('connect', connected);
    this.socket.on('disconnect', disconnected);
    this.socket.io.on('reconnect_attempt', reconnecting);
    return () => {
      this.socket.off('connect', connected);
      this.socket.off('disconnect', disconnected);
      this.socket.io.off('reconnect_attempt', reconnecting);
    };
  }

  /** Resolves with the ride id, or rejects with the server's reason. */
  requestRide(request: RideRequest, timeoutMs = 10000): Promise<string> {
    return new Promise((resolve, reject) => {
      this.socket.timeout(timeoutMs).emit('request_ride', request, (error, response) => {
        if (error) {
          reject(new Error('The server did not respond'));
        } else if (response.ok) {
          resolve(response.rideId);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  cancelRide(): void {
    this.socket.emit('cancel_ride');
  }
}
