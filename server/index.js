/**
 * Mock ride-hailing backend.
 *
 * - Every tick, broadcasts `nearby_drivers` with fake drivers wandering around
 *   the city centre.
 * - On `request_ride` it assigns the nearest free driver and plays the ride
 *   lifecycle on a timer: driver_assigned → driver_approaching (repeated, with
 *   position and ETA) → driver_arrived → trip_started → trip_progress (repeated)
 *   → trip_completed.
 *
 *   PORT=3000 TICK_MS=1000 CENTER=37.7749,-122.4194 node index.js
 */
const http = require('node:http');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 3000);
const TICK_MS = Number(process.env.TICK_MS || 1000);
const [CENTER_LAT, CENTER_LNG] = (process.env.CENTER || '37.7749,-122.4194')
  .split(',')
  .map(Number);
const DRIVER_COUNT = Number(process.env.DRIVERS || 8);
const APPROACH_TICKS = 12; // how long the driver takes to reach the pickup
const ARRIVED_TICKS = 3; // waiting at the pickup before the trip starts
const TRIP_TICKS = 20;

const NAMES = [
  'Maya',
  'Leo',
  'Priya',
  'Sam',
  'Diego',
  'Aiko',
  'Noah',
  'Zara',
  'Omar',
  'Ivy',
];
const VEHICLES = [
  'Toyota Prius · 7ABC123',
  'Tesla Model 3 · 8XYZ789',
  'Honda Civic · 6LMN456',
  'Hyundai Ioniq · 9QRS321',
  'Kia Niro · 5TUV654',
];

const jitter = scale => (Math.random() - 0.5) * scale;

const drivers = Array.from({ length: DRIVER_COUNT }, (_, i) => ({
  id: `driver-${i + 1}`,
  name: NAMES[i % NAMES.length],
  vehicle: VEHICLES[i % VEHICLES.length],
  rating: Number((4.6 + Math.random() * 0.4).toFixed(2)),
  location: {
    latitude: CENTER_LAT + jitter(0.03),
    longitude: CENTER_LNG + jitter(0.03),
  },
  heading: Math.floor(Math.random() * 360),
  busy: false,
}));

function distanceKm(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function headingBetween(a, b) {
  const angle =
    (Math.atan2(b.longitude - a.longitude, b.latitude - a.latitude) * 180) /
    Math.PI;
  return Math.round((angle + 360) % 360);
}

/** Straight-line path from a to b in `steps` points (excluding a, including b). */
function path(a, b, steps) {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    return {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    };
  });
}

const publicDriver = ({ busy, ...driver }) => driver;

function isCoordinate(value) {
  return (
    value &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, drivers: drivers.length }));
});
const io = new Server(server, { cors: { origin: '*' } });

// Idle drivers drift around so the map is alive.
setInterval(() => {
  for (const driver of drivers) {
    if (driver.busy) {
      continue;
    }
    const next = {
      latitude: driver.location.latitude + jitter(0.0012),
      longitude: driver.location.longitude + jitter(0.0012),
    };
    driver.heading = headingBetween(driver.location, next);
    driver.location = next;
  }
  io.emit('nearby_drivers', {
    drivers: drivers.map(publicDriver),
    timestamp: Date.now(),
  });
}, TICK_MS);

let rideCounter = 0;

io.on('connection', socket => {
  console.log(`client connected ${socket.id}`);
  socket.emit('nearby_drivers', {
    drivers: drivers.map(publicDriver),
    timestamp: Date.now(),
  });
  let activeRide = null;

  const finish = () => {
    if (activeRide) {
      clearInterval(activeRide.timer);
      activeRide.driver.busy = false;
      activeRide = null;
    }
  };

  socket.on('request_ride', (request, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (activeRide) {
      return reply({ ok: false, error: 'A ride is already in progress' });
    }
    if (!isCoordinate(request?.pickup) || !isCoordinate(request?.dropoff)) {
      return reply({
        ok: false,
        error: 'pickup and dropoff coordinates are required',
      });
    }
    const free = drivers.filter(d => !d.busy);
    if (free.length === 0) {
      return reply({ ok: false, error: 'No drivers available' });
    }
    const driver = free.reduce((best, d) =>
      distanceKm(d.location, request.pickup) <
      distanceKm(best.location, request.pickup)
        ? d
        : best,
    );
    driver.busy = true;

    const rideId = `ride-${Date.now()}-${++rideCounter}`;
    const approach = path(driver.location, request.pickup, APPROACH_TICKS);
    const trip = path(request.pickup, request.dropoff, TRIP_TICKS);
    const tripDistanceKm = distanceKm(request.pickup, request.dropoff);
    const secondsPerTick = TICK_MS / 1000;
    let tick = 0;
    let startedAt = null;

    reply({ ok: true, rideId });
    socket.emit('driver_assigned', {
      rideId,
      driver: publicDriver(driver),
      etaSeconds: Math.round(APPROACH_TICKS * secondsPerTick),
    });

    const move = to => {
      driver.heading = headingBetween(driver.location, to);
      driver.location = to;
    };

    activeRide = { driver, timer: null };
    activeRide.timer = setInterval(() => {
      tick += 1;
      if (tick <= APPROACH_TICKS) {
        move(approach[tick - 1]);
        if (tick < APPROACH_TICKS) {
          socket.emit('driver_approaching', {
            rideId,
            location: driver.location,
            heading: driver.heading,
            etaSeconds: Math.round((APPROACH_TICKS - tick) * secondsPerTick),
          });
        } else {
          socket.emit('driver_arrived', { rideId, location: driver.location });
        }
      } else if (tick === APPROACH_TICKS + ARRIVED_TICKS) {
        startedAt = Date.now();
        socket.emit('trip_started', { rideId, startedAt });
      } else if (tick > APPROACH_TICKS + ARRIVED_TICKS) {
        const step = tick - APPROACH_TICKS - ARRIVED_TICKS;
        move(trip[step - 1]);
        if (step < TRIP_TICKS) {
          socket.emit('trip_progress', {
            rideId,
            location: driver.location,
            heading: driver.heading,
            remainingSeconds: Math.round((TRIP_TICKS - step) * secondsPerTick),
          });
        } else {
          const completedAt = Date.now();
          socket.emit('trip_completed', {
            rideId,
            completedAt,
            durationSeconds: Math.round((completedAt - startedAt) / 1000),
            distanceKm: Number(tripDistanceKm.toFixed(2)),
            fare: Number((2.5 + tripDistanceKm * 1.75).toFixed(2)),
            currency: 'USD',
          });
          finish();
        }
      }
    }, TICK_MS);
  });

  socket.on('cancel_ride', () => {
    finish();
  });

  socket.on('disconnect', () => {
    console.log(`client disconnected ${socket.id}`);
    finish();
  });
});

server.listen(PORT, () => {
  console.log(
    `Ride Tracker mock server on http://localhost:${PORT} (tick ${TICK_MS} ms)`,
  );
});
