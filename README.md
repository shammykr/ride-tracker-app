# Ride Tracker

A cross-platform React Native + TypeScript passenger app for real-time ride
tracking: see drivers move on a live Apple Maps (MapKit) map, request a ride,
watch the assigned driver approach, ride to your destination and review your
trip history. Live updates arrive over WebSockets from a small Node.js mock
server. On iOS, location, haptics and trip persistence are native modules
written in Swift and bridged to JavaScript.

## Features

- **Live map** (`react-native-maps`, Apple MapKit on iOS). It shows nearby
  drivers that update every second, your pickup and drop-off points, the
  assigned driver's position and heading, and the driven route.
- **Real-time ride status over WebSockets.** `socket.io-client` talks to the
  mock server in `server/` and receives these events:
  `driver_assigned` → `driver_approaching` (repeated, with ETA) → `driver_arrived`
  → `trip_started` → `trip_completed`. The server also sends `nearby_drivers`
  and `trip_progress`.
- **Trip history** persisted with **Core Data** through a Swift native module
  (`TripStore`). The list loads lightweight summaries; a trip's full record and
  route are loaded only when you open it.
- **Swift native modules** (no Objective-C):
  - `LocationService` wraps `CLLocationManager` for foreground updates:
    `startUpdating`, `stopUpdating`, `getCurrentPosition`, plus
    `locationUpdate` / `locationError` events.
  - `HapticFeedback` triggers `UIImpactFeedbackGenerator`:
    `impact('light' | 'medium' | 'heavy' | 'soft' | 'rigid')`.
  - `TripStore` is Core Data persistence: `saveTrip`, `getTrips`, `getTrip`,
    `clearTrips`.
- **Notifications** use `react-native-push-notification`. Local notifications
  fire when a driver is assigned, when they arrive and when the trip completes.
  APNs registration is wired through the AppDelegate, the
  `aps-environment` entitlement and the `remote-notification` background mode,
  so the device token is available to JavaScript for a backend.
- **MVVM**: screens render; ViewModel hooks (`useRideViewModel`,
  `useTripHistoryViewModel`, `useTripDetailViewModel`) own state and logic.
  Dependencies are injected through React context.
- **Coordinator navigation** with React Navigation: a root stack containing the
  tabs and the trip detail screen. Screens call intent methods such as
  `showTripDetail(id)` and never call navigation directly.
- **Performance**:
  - `React.memo` on map markers, with a comparator that skips drivers that
    haven't moved
  - `tracksViewChanges={false}` on markers
  - memoized `reselect` selectors
  - `FlatList` with `getItemLayout` and fixed-height rows
  - lazy loading of trip details, both the data (route fetched on open) and
    the screen module (`getComponent`)
- **CI/CD**: GitHub Actions runs `tsc --noEmit`, ESLint and Jest, and builds the
  iOS app and runs the Swift XCTests with **Fastlane** (`scan`). It also
  produces an unsigned Release archive with `gym`.

## Architecture

```
┌──────────────────────────── React Native (TypeScript) ─────────────────────────────┐
│                                                                                    │
│  Screens (render only)        ViewModels (hooks)            Services               │
│  ┌──────────────────┐        ┌───────────────────────┐     ┌────────────────────┐  │
│  │ RideScreen       │──────▶ │ useRideViewModel      │───▶ │ RideSocket         │──┼──┐
│  │ TripHistoryScreen│──────▶ │ useTripHistoryVM      │     │ (socket.io-client) │  │  │ WebSocket
│  │ TripDetailScreen │──────▶ │ useTripDetailVM       │     │ notifications      │  │  │
│  └────────┬─────────┘        │  rideReducer (state   │     └────────────────────┘  │  │
│           │                  │  machine) + selectors │                             │  │
│  AppCoordinator /            └──────────┬────────────┘     src/native/*.ts         │  │
│  useCoordinator                         │ AppServices      typed wrappers          │  │
│  (stack + tabs)                         └─ context ──────▶ LocationService         │  │
│                                                            HapticFeedback          │  │
│                                                            TripStore               │  │
└──────────────────────────────────────────────────────────────────┬─────────────────┘  │
                                                                   │ NativeModules     │
                                              React Native bridge  │ (New Arch interop)│
┌──────────────────────────────── iOS (Swift) ─────────────────────▼──────────────┐    │
│  LocationService.swift     HapticFeedback.swift      TripStore.swift            │    │
│  CLLocationManager         UIImpactFeedbackGenerator  └─ TripRepository.swift   │    │
│  (RCTEventEmitter)                                       Core Data (SQLite)     │    │
│  RCTExport.swift / NativeModuleRegistry.swift: Swift-only export + registration │    │
│  AppDelegate.swift + PushNotifications.swift: APNs / UNUserNotificationCenter   │    │
└─────────────────────────────────────────────────────────────────────────────────┘    │
                                                                                       │
┌──────────── server/ (Node.js, socket.io) ────────────┐                               │
│ fake drivers on a timer · ride lifecycle events      │ ◀─────────────────────────────┘
└──────────────────────────────────────────────────────┘
```

### Ride lifecycle

`rideReducer` is a pure state machine, unit-tested in Jest:

```
idle ──request──▶ requesting ──driver_assigned──▶ assigned ──driver_approaching──▶ approaching
                                                                                      │
completed ◀──trip_completed── inProgress ◀──trip_started── arrived ◀──driver_arrived──┘
```

`useRideViewModel` turns each transition into side effects:
- a haptic tap (Swift `HapticFeedback`)
- a local notification
- on completion, saving the trip (Swift `TripStore` → Core Data)

### Swift modules without Objective-C

Swift modules usually need a `.m` file with `RCT_EXTERN_MODULE` macros. This
project uses none; the only Objective-C is the standard bridging header:

- **Exporting methods.** React Native finds a module's methods by calling class
  methods named `__rct_export__*`, which return an `RCTMethodInfo`. The
  `RCT_EXPORT_METHOD` macro generates those methods; here each Swift module
  declares them through a small helper (`RCTExport.method("impact:(NSString *)style")`).
- **Registering modules.** `RCT_EXPORT_MODULE` calls `RCTRegisterModule` from
  `+load`. Swift has no `+load`, so `NativeModuleRegistry.registerAll()` calls
  `RCTRegisterModule` from `AppDelegate` before React Native starts. The New
  Architecture's interop layer resolves modules from that same registry.
- **Checking the signatures.** A Swift XCTest checks that every exported
  signature matches a selector the class really implements.

On Android (not a target of this project) the native modules aren't
implemented. The JavaScript wrappers fall back to an in-memory trip store and
no-op haptics and location.

## Project layout

```
App.tsx                      providers + AppCoordinator
src/
  screens/                   RideScreen, TripHistoryScreen, TripDetailScreen
  viewmodels/                useRideViewModel, useTripHistoryViewModel, useTripDetailViewModel, rideReducer
  components/                DriverMarker (memo), RideStatusCard, TripListItem
  navigation/                AppCoordinator (stack + tabs), useCoordinator, route types
  services/                  RideSocket (socket.io), notifications
  native/                    typed JS wrappers for the Swift modules
  selectors/                 memoized reselect selectors
  context/                   AppServices (dependency injection)
ios/RideTracker/
  NativeModules/             LocationService, HapticFeedback, TripStore, TripRepository (Core Data),
                             RCTExport, NativeModuleRegistry
  AppDelegate.swift, PushNotifications.swift, RideTracker-Bridging-Header.h, RideTracker.entitlements
ios/RideTrackerTests/        Swift XCTests (Core Data repository, module exports)
server/                      socket.io mock backend
fastlane/                    Fastfile (scan / gym), Appfile
__tests__/                   Jest tests
.github/workflows/ci.yml
```

## Getting started

Requirements: macOS with Xcode 16+, Node.js 20+, Ruby with Bundler (for
CocoaPods and Fastlane), and the iOS simulator.

```sh
npm install
bundle install
bundle exec pod install --project-directory=ios    # or: bundle exec fastlane ios pods

# terminal 1: mock backend on http://localhost:3000
npm --prefix server install
npm run server

# terminal 2: Metro + the iOS app
npm start
npm run ios
```

Using the app:
1. Allow location access when asked; your position becomes the pickup point.
   In the simulator, choose **Features → Location** to set one. Without a
   location fix, the centre of the map is used as the pickup.
2. Tap the map to choose a destination, then tap **Request ride**.
3. Watch the driver approach, arrive and drive you there. Notifications and
   haptics mark each step (haptics only work on a real device).
4. Open the **Trips** tab to see the saved trip, and tap a trip for its route
   and details.

On a physical device, point `SERVER_URL` in `src/config.ts` at your Mac's LAN IP.
The server can be tuned with environment variables:
`PORT=3000 TICK_MS=1000 DRIVERS=8 CENTER=37.7749,-122.4194 npm run server`.

### Push notifications

Local notifications work with no setup. For remote notifications:
1. Give the app a signing team that has the Push Notifications capability.
   `RideTracker.entitlements` already contains `aps-environment`.
2. Upload an APNs key to your push provider.
3. Send the device token that `onRegister` receives in
   `src/services/notifications.ts` to your backend.

`AppDelegate` already forwards the token and incoming notifications to
`react-native-push-notification`.

## Scripts and tooling

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`@react-native` config, zero warnings allowed) |
| `npm test` | Jest: ride reducer, selectors (including memoization), socket service, trip store contract, ViewModel hooks with a fake socket |
| `bundle exec fastlane ios test` | Builds for the simulator and runs the Swift XCTests (`scan`) |
| `bundle exec fastlane ios build` | Signed Release archive and `.ipa` (`gym`). Needs a signing team; pass `skip_codesigning:true` for an unsigned archive (what CI does) |

CI (`.github/workflows/ci.yml`) runs two jobs on every push and pull request:
- **checks** on Ubuntu: type-check, ESLint and Jest.
- **ios** on macOS: CocoaPods, `fastlane ios test` and
  `fastlane ios build skip_codesigning:true`.

## Screenshots

_Screenshots coming soon._

| Live map | Driver approaching | Trip history | Trip detail |
|---|---|---|---|
| _placeholder_ | _placeholder_ | _placeholder_ | _placeholder_ |

## Tech stack

| Layer | Technology |
|---|---|
| App | React Native 0.83 (New Architecture), React 19, TypeScript |
| Maps | react-native-maps (Apple MapKit on iOS) |
| Real-time | socket.io-client 4 ↔ Node.js socket.io 4 mock server |
| Native iOS | Swift 5: CoreLocation, UIKit haptics, Core Data, UserNotifications |
| Navigation | React Navigation 7 (native stack + bottom tabs) |
| State | React hooks + context, `useReducer` state machine, reselect |
| Notifications | react-native-push-notification + @react-native-community/push-notification-ios |
| Quality | Jest + React Native Testing Library, ESLint, Prettier, XCTest |
| CI/CD | GitHub Actions, Fastlane (scan, gym), CocoaPods |

## License

MIT
