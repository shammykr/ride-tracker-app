import { Platform } from 'react-native';

/**
 * Mock server URL. The iOS simulator reaches the Mac as localhost; the Android
 * emulator uses 10.0.2.2. On a physical device, set your machine's LAN IP.
 */
export const SERVER_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000',
});

/** Where the map starts before a location fix (matches the mock server's city). */
export const DEFAULT_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export const TRIP_HISTORY_LIMIT = 200;
