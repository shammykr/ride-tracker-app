import Foundation

/// `NativeModules.TripStore`: trip history persisted with Core Data.
///
/// JS API (all return promises):
///   saveTrip(trip: Trip): Promise<void>
///   getTrips(limit: number): Promise<TripSummary[]>   newest first, no route
///   getTrip(id: string): Promise<Trip | null>         includes the route
///   clearTrips(): Promise<void>
@objc(TripStore)
final class TripStore: NSObject, RCTBridgeModule {
  /// All Core Data work happens off the JS and main threads, one call at a time.
  private let queue = DispatchQueue(label: "com.shammykr.ridetracker.tripstore")
  private var repository: TripRepository?

  @objc static func moduleName() -> String! { "TripStore" }

  @objc static func requiresMainQueueSetup() -> Bool { false }

  private func withRepository(
    _ reject: @escaping RCTPromiseRejectBlock, _ work: @escaping (TripRepository) throws -> Void
  ) {
    queue.async {
      do {
        if self.repository == nil {
          self.repository = try TripRepository()
        }
        try work(self.repository!)
      } catch {
        reject("E_TRIP_STORE", "Trip store error: \(error.localizedDescription)", error)
      }
    }
  }

  // MARK: - Exported methods

  @objc static func __rct_export__saveTrip() -> UnsafePointer<RCTMethodInfo> {
    RCTExport.method(
      "saveTrip:(NSDictionary *)trip resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject"
    )
  }

  @objc(saveTrip:resolve:reject:)
  func saveTrip(
    _ trip: NSDictionary, resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let record: TripRecord
    do {
      record = try Self.decode(trip)
    } catch {
      reject("E_INVALID_TRIP", "Invalid trip: \(error)", error)
      return
    }
    withRepository(reject) { repository in
      try repository.save(record)
      resolve(nil)
    }
  }

  @objc static func __rct_export__getTrips() -> UnsafePointer<RCTMethodInfo> {
    RCTExport.method(
      "getTrips:(nonnull NSNumber *)limit resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject"
    )
  }

  @objc(getTrips:resolve:reject:)
  func getTrips(
    _ limit: NSNumber, resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    withRepository(reject) { repository in
      let trips = try repository.summaries(limit: limit.intValue)
      resolve(try trips.map { try Self.encode($0, includeRoute: false) })
    }
  }

  @objc static func __rct_export__getTrip() -> UnsafePointer<RCTMethodInfo> {
    RCTExport.method(
      "getTrip:(NSString *)tripId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject"
    )
  }

  @objc(getTrip:resolve:reject:)
  func getTrip(
    _ tripId: String, resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    withRepository(reject) { repository in
      if let trip = try repository.trip(id: tripId) {
        resolve(try Self.encode(trip, includeRoute: true))
      } else {
        resolve(nil)
      }
    }
  }

  @objc static func __rct_export__clearTrips() -> UnsafePointer<RCTMethodInfo> {
    RCTExport.method(
      "clearTrips:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject")
  }

  @objc(clearTrips:reject:)
  func clearTrips(
    _ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock
  ) {
    withRepository(reject) { repository in
      try repository.deleteAll()
      resolve(nil)
    }
  }

  // MARK: - JS <-> Swift conversion (via JSON, so Codable does the validation)

  static func decode(_ dictionary: NSDictionary) throws -> TripRecord {
    let data = try JSONSerialization.data(withJSONObject: dictionary)
    return try JSONDecoder().decode(TripRecord.self, from: data)
  }

  static func encode(_ trip: TripRecord, includeRoute: Bool) throws -> [String: Any] {
    let data = try JSONEncoder().encode(trip)
    var object = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    if !includeRoute {
      object.removeValue(forKey: "route")
    }
    return object
  }
}
