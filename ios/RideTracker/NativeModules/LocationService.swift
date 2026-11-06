import CoreLocation
import Foundation

/// `NativeModules.LocationService`: foreground location updates via CLLocationManager.
///
/// JS API:
///   startUpdating(): Promise<void>       begins continuous updates (`locationUpdate` events)
///   stopUpdating(): void
///   getCurrentPosition(): Promise<Position>
///   events: `locationUpdate` (Position), `locationError` ({code, message})
@objc(LocationService)
final class LocationService: RCTEventEmitter, CLLocationManagerDelegate {
  static let updateEvent = "locationUpdate"
  static let errorEvent = "locationError"

  private var manager: CLLocationManager?
  private var hasListeners = false
  private var isUpdating = false
  /// Promises waiting for authorization before updates can start.
  private var pendingStarts: [(RCTPromiseResolveBlock, RCTPromiseRejectBlock)] = []
  /// Promises waiting for a single fix from getCurrentPosition.
  private var pendingPositions: [(RCTPromiseResolveBlock, RCTPromiseRejectBlock)] = []

  // MARK: - Module setup

  @objc override static func moduleName() -> String! { "LocationService" }

  /// CLLocationManager must be created and used on a thread with a run loop, so
  /// the module is set up on the main queue and every method hops onto it.
  @objc override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    [Self.updateEvent, Self.errorEvent]
  }

  override func startObserving() { hasListeners = true }
  override func stopObserving() { hasListeners = false }

  override func invalidate() {
    manager?.stopUpdatingLocation()
    manager?.delegate = nil
    super.invalidate()
  }

  private var locationManager: CLLocationManager {
    if let manager {
      return manager
    }
    let created = CLLocationManager()
    created.delegate = self
    created.desiredAccuracy = kCLLocationAccuracyBest
    created.distanceFilter = 5  // metres between updates
    manager = created
    return created
  }

  // MARK: - Exported methods

  @objc static func __rct_export__startUpdating() -> UnsafePointer<RCTMethodInfo> {
    RCTExport.method(
      "startUpdating:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject")
  }

  @objc(startUpdating:reject:)
  func startUpdating(
    _ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { self.start(resolve, reject) }
  }

  private func start(_ resolve: @escaping RCTPromiseResolveBlock, _ reject: @escaping RCTPromiseRejectBlock) {
    switch locationManager.authorizationStatus {
    case .authorizedWhenInUse, .authorizedAlways:
      beginUpdates()
      resolve(nil)
    case .notDetermined:
      pendingStarts.append((resolve, reject))
      locationManager.requestWhenInUseAuthorization()
    default:
      reject("E_LOCATION_DENIED", "Location permission was denied", nil)
    }
  }

  @objc static func __rct_export__stopUpdating() -> UnsafePointer<RCTMethodInfo> {
    RCTExport.method("stopUpdating")
  }

  @objc(stopUpdating)
  func stopUpdating() {
    DispatchQueue.main.async {
      self.isUpdating = false
      self.manager?.stopUpdatingLocation()
    }
  }

  @objc static func __rct_export__getCurrentPosition() -> UnsafePointer<RCTMethodInfo> {
    RCTExport.method(
      "getCurrentPosition:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject")
  }

  @objc(getCurrentPosition:reject:)
  func getCurrentPosition(
    _ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { self.currentPosition(resolve, reject) }
  }

  private func currentPosition(
    _ resolve: @escaping RCTPromiseResolveBlock, _ reject: @escaping RCTPromiseRejectBlock
  ) {
    let manager = locationManager
    switch manager.authorizationStatus {
    case .authorizedWhenInUse, .authorizedAlways:
      if let location = manager.location, -location.timestamp.timeIntervalSinceNow < 10 {
        resolve(Self.serialize(location))
      } else {
        pendingPositions.append((resolve, reject))
        manager.requestLocation()
      }
    case .notDetermined:
      pendingPositions.append((resolve, reject))
      manager.requestWhenInUseAuthorization()
    default:
      reject("E_LOCATION_DENIED", "Location permission was denied", nil)
    }
  }

  // MARK: - CLLocationManagerDelegate

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    switch manager.authorizationStatus {
    case .authorizedWhenInUse, .authorizedAlways:
      if !pendingStarts.isEmpty {
        beginUpdates()
        pendingStarts.forEach { resolve, _ in resolve(nil) }
        pendingStarts.removeAll()
      }
      if !pendingPositions.isEmpty {
        manager.requestLocation()
      }
    case .denied, .restricted:
      let waiting = pendingStarts + pendingPositions
      pendingStarts.removeAll()
      pendingPositions.removeAll()
      waiting.forEach { _, reject in
        reject("E_LOCATION_DENIED", "Location permission was denied", nil)
      }
    default:
      break
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }
    let position = Self.serialize(location)
    pendingPositions.forEach { resolve, _ in resolve(position) }
    pendingPositions.removeAll()
    if isUpdating && hasListeners {
      sendEvent(withName: Self.updateEvent, body: position)
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    // kCLErrorLocationUnknown is transient; Core Location keeps trying.
    if let clError = error as? CLError, clError.code == .locationUnknown {
      return
    }
    pendingPositions.forEach { _, reject in
      reject("E_LOCATION_UNAVAILABLE", error.localizedDescription, error)
    }
    pendingPositions.removeAll()
    if hasListeners {
      sendEvent(
        withName: Self.errorEvent,
        body: ["code": "E_LOCATION_UNAVAILABLE", "message": error.localizedDescription])
    }
  }

  // MARK: - Helpers

  private func beginUpdates() {
    isUpdating = true
    locationManager.startUpdatingLocation()
  }

  static func serialize(_ location: CLLocation) -> [String: Any] {
    [
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
      "heading": location.course >= 0 ? location.course : NSNull(),
      "speed": location.speed >= 0 ? location.speed : NSNull(),
      "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
    ]
  }
}
