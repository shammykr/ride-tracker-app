import type {Coordinate} from '../types';

/** Region that fits all points, with some padding. */
export function regionForCoordinates(points: Coordinate[], padding = 1.4) {
  const lats = points.map(p => p.latitude);
  const lngs = points.map(p => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * padding, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * padding, 0.01),
  };
}
