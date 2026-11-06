import XCTest

@testable import RideTracker

final class TripRepositoryTests: XCTestCase {
  private func makeTrip(_ id: String, completedAt: Double, fare: Double = 12.5) -> TripRecord {
    TripRecord(
      id: id, driverName: "Maya", vehicle: "Toyota Prius · 7ABC123",
      pickup: TripCoordinate(latitude: 37.77, longitude: -122.42),
      dropoff: TripCoordinate(latitude: 37.79, longitude: -122.40),
      fare: fare, currency: "USD", distanceKm: 2.8, durationSeconds: 540,
      startedAt: completedAt - 540_000, completedAt: completedAt,
      route: [
        TripCoordinate(latitude: 37.77, longitude: -122.42),
        TripCoordinate(latitude: 37.79, longitude: -122.40),
      ])
  }

  func testSummariesAreNewestFirstAndOmitRoutes() throws {
    let repository = try TripRepository(inMemory: true)
    try repository.save(makeTrip("a", completedAt: 1_000_000))
    try repository.save(makeTrip("b", completedAt: 3_000_000))
    try repository.save(makeTrip("c", completedAt: 2_000_000))

    let summaries = try repository.summaries(limit: 10)
    XCTAssertEqual(summaries.map(\.id), ["b", "c", "a"])
    XCTAssertTrue(summaries.allSatisfy { $0.route.isEmpty })
    XCTAssertEqual(try repository.summaries(limit: 2).count, 2)
  }

  func testTripDetailRoundTripsIncludingRoute() throws {
    let repository = try TripRepository(inMemory: true)
    let trip = makeTrip("a", completedAt: 1_000_000)
    try repository.save(trip)
    XCTAssertEqual(try repository.trip(id: "a"), trip)
    XCTAssertNil(try repository.trip(id: "missing"))
  }

  func testSavingSameIdReplacesTrip() throws {
    let repository = try TripRepository(inMemory: true)
    try repository.save(makeTrip("a", completedAt: 1_000_000, fare: 10))
    try repository.save(makeTrip("a", completedAt: 1_000_000, fare: 20))
    let summaries = try repository.summaries(limit: 10)
    XCTAssertEqual(summaries.count, 1)
    XCTAssertEqual(summaries.first?.fare, 20)
  }

  func testDeleteAll() throws {
    let repository = try TripRepository(inMemory: true)
    try repository.save(makeTrip("a", completedAt: 1_000_000))
    try repository.deleteAll()
    XCTAssertTrue(try repository.summaries(limit: 10).isEmpty)
  }
}

final class NativeModuleTests: XCTestCase {
  func testTripStoreDecodesJavaScriptTrip() throws {
    let dictionary: NSDictionary = [
      "id": "ride-1", "driverName": "Leo", "vehicle": "Kia Niro",
      "pickup": ["latitude": 1.0, "longitude": 2.0],
      "dropoff": ["latitude": 3.0, "longitude": 4.0],
      "fare": 9.5, "currency": "USD", "distanceKm": 1.2, "durationSeconds": 300,
      "startedAt": 1_000, "completedAt": 301_000,
      "route": [["latitude": 1.0, "longitude": 2.0]],
    ]
    let trip = try TripStore.decode(dictionary)
    XCTAssertEqual(trip.driverName, "Leo")
    XCTAssertEqual(trip.route.count, 1)
    XCTAssertNil(try TripStore.encode(trip, includeRoute: false)["route"])
  }

  func testHapticStyleNames() {
    XCTAssertEqual(HapticFeedback.style(named: "Heavy"), .heavy)
    XCTAssertEqual(HapticFeedback.style(named: "rigid"), .rigid)
    XCTAssertNil(HapticFeedback.style(named: "explode"))
  }

  func testExportedMethodsMatchSwiftSelectors() {
    // Every __rct_export__ signature must resolve to a selector the class implements,
    // otherwise React Native fails when JS calls the method.
    let exports: [(AnyClass, UnsafePointer<RCTMethodInfo>)] = [
      (LocationService.self, LocationService.__rct_export__startUpdating()),
      (LocationService.self, LocationService.__rct_export__stopUpdating()),
      (LocationService.self, LocationService.__rct_export__getCurrentPosition()),
      (HapticFeedback.self, HapticFeedback.__rct_export__impact()),
      (TripStore.self, TripStore.__rct_export__saveTrip()),
      (TripStore.self, TripStore.__rct_export__getTrips()),
      (TripStore.self, TripStore.__rct_export__getTrip()),
      (TripStore.self, TripStore.__rct_export__clearTrips()),
    ]
    for (moduleClass, info) in exports {
      let signature = String(cString: info.pointee.objcName)
      // "getTrip:(NSString *)tripId resolve:(...)resolve" -> "getTrip:resolve:"
      let withoutTypes = signature.replacingOccurrences(
        of: "\\([^)]*\\)", with: "", options: .regularExpression)
      let selector = withoutTypes.split(separator: " ")
        .map { part -> String in
          guard let colon = part.firstIndex(of: ":") else { return String(part) }
          return String(part[...colon])
        }
        .joined()
      XCTAssertTrue(
        moduleClass.instancesRespond(to: NSSelectorFromString(selector)),
        "\(moduleClass) does not implement \(selector)")
    }
  }
}
