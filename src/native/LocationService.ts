import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { Coordinate } from '../types';

export interface Position extends Coordinate {
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface LocationServiceNative {
  startUpdating(): Promise<void>;
  stopUpdating(): void;
  getCurrentPosition(): Promise<Position>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

/** Swift module (ios/RideTracker/NativeModules/LocationService.swift). */
const native: LocationServiceNative | undefined = NativeModules.LocationService;
const emitter =
  native && Platform.OS === 'ios' ? new NativeEventEmitter(native) : null;

export const LocationService = {
  isAvailable: Boolean(native),

  getCurrentPosition(): Promise<Position> {
    if (!native) {
      return Promise.reject(
        new Error('LocationService is only implemented on iOS'),
      );
    }
    return native.getCurrentPosition();
  },

  /** Starts foreground updates; returns an unsubscribe function that also stops them. */
  async watchPosition(
    onPosition: (position: Position) => void,
    onError?: (error: { code: string; message: string }) => void,
  ): Promise<() => void> {
    if (!native || !emitter) {
      return () => {};
    }
    const updates = emitter.addListener('locationUpdate', onPosition);
    const errors = emitter.addListener('locationError', error =>
      onError?.(error),
    );
    try {
      await native.startUpdating();
    } catch (error) {
      updates.remove();
      errors.remove();
      throw error;
    }
    return () => {
      updates.remove();
      errors.remove();
      native.stopUpdating();
    };
  },
};
