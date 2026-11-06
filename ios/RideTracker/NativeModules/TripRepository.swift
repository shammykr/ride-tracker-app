import CoreData
import Foundation

struct TripCoordinate: Codable, Equatable {
  let latitude: Double
  let longitude: Double
}

/// A completed trip. Timestamps are Unix epoch milliseconds, as in JavaScript.
struct TripRecord: Codable, Equatable {
  let id: String
  let driverName: String
  let vehicle: String
  let pickup: TripCoordinate
  let dropoff: TripCoordinate
  let fare: Double
  let currency: String
  let distanceKm: Double
  let durationSeconds: Double
  let startedAt: Double
  let completedAt: Double
  /// The driven route; only loaded by `trip(id:)`, never by `summaries`.
  let route: [TripCoordinate]
}

enum TripRepositoryError: Error {
  case storeLoadFailed(Error)
}

/// Core Data persistence for trip history.
///
/// The managed object model is defined in code (one `Trip` entity) so the
/// project needs no .xcdatamodeld bundle. The route is stored as JSON in a
/// binary attribute and is excluded from list fetches.
final class TripRepository {
  static let entityName = "Trip"

  /// One model instance per process: Core Data warns (and misbehaves) when
  /// several models describe the same entity.
  static let model: NSManagedObjectModel = {
    func attribute(
      _ name: String, _ type: NSAttributeType, optional: Bool = false
    ) -> NSAttributeDescription {
      let attribute = NSAttributeDescription()
      attribute.name = name
      attribute.attributeType = type
      attribute.isOptional = optional
      return attribute
    }

    let entity = NSEntityDescription()
    entity.name = entityName
    entity.managedObjectClassName = NSStringFromClass(NSManagedObject.self)
    entity.properties = [
      attribute("id", .stringAttributeType),
      attribute("driverName", .stringAttributeType),
      attribute("vehicle", .stringAttributeType),
      attribute("pickupLatitude", .doubleAttributeType),
      attribute("pickupLongitude", .doubleAttributeType),
      attribute("dropoffLatitude", .doubleAttributeType),
      attribute("dropoffLongitude", .doubleAttributeType),
      attribute("fare", .doubleAttributeType),
      attribute("currency", .stringAttributeType),
      attribute("distanceKm", .doubleAttributeType),
      attribute("durationSeconds", .doubleAttributeType),
      attribute("startedAt", .dateAttributeType),
      attribute("completedAt", .dateAttributeType),
      attribute("route", .binaryDataAttributeType, optional: true),
    ]
    entity.uniquenessConstraints = [["id"]]

    let index = NSFetchIndexDescription(
      name: "byCompletedAt",
      elements: [
        NSFetchIndexElementDescription(
          property: entity.propertiesByName["completedAt"]!, collationType: .binary)
      ])
    entity.indexes = [index]

    let model = NSManagedObjectModel()
    model.entities = [entity]
    return model
  }()

  private let container: NSPersistentContainer
  private let context: NSManagedObjectContext

  /// - Parameter inMemory: keep data in memory only (tests).
  init(inMemory: Bool = false) throws {
    container = NSPersistentContainer(name: "RideTracker", managedObjectModel: Self.model)
    if inMemory, let description = container.persistentStoreDescriptions.first {
      description.url = URL(fileURLWithPath: "/dev/null")
    }
    var loadError: Error?
    container.loadPersistentStores { _, error in loadError = error }
    if let loadError {
      throw TripRepositoryError.storeLoadFailed(loadError)
    }
    context = container.newBackgroundContext()
    // Saving a trip with an existing id replaces it.
    context.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
  }

  /// Inserts or replaces a trip.
  func save(_ trip: TripRecord) throws {
    try context.performAndWait {
      let object = NSManagedObject(
        entity: Self.model.entitiesByName[Self.entityName]!, insertInto: context)
      object.setValue(trip.id, forKey: "id")
      object.setValue(trip.driverName, forKey: "driverName")
      object.setValue(trip.vehicle, forKey: "vehicle")
      object.setValue(trip.pickup.latitude, forKey: "pickupLatitude")
      object.setValue(trip.pickup.longitude, forKey: "pickupLongitude")
      object.setValue(trip.dropoff.latitude, forKey: "dropoffLatitude")
      object.setValue(trip.dropoff.longitude, forKey: "dropoffLongitude")
      object.setValue(trip.fare, forKey: "fare")
      object.setValue(trip.currency, forKey: "currency")
      object.setValue(trip.distanceKm, forKey: "distanceKm")
      object.setValue(trip.durationSeconds, forKey: "durationSeconds")
      object.setValue(Self.date(trip.startedAt), forKey: "startedAt")
      object.setValue(Self.date(trip.completedAt), forKey: "completedAt")
      object.setValue(try JSONEncoder().encode(trip.route), forKey: "route")
      try context.save()
      context.reset()
    }
  }

  /// Most recent trips first, without their routes.
  func summaries(limit: Int) throws -> [TripRecord] {
    try context.performAndWait {
      let request = NSFetchRequest<NSManagedObject>(entityName: Self.entityName)
      request.sortDescriptors = [NSSortDescriptor(key: "completedAt", ascending: false)]
      request.fetchLimit = max(0, limit)
      request.propertiesToFetch = Self.model.entitiesByName[Self.entityName]!.properties
        .filter { $0.name != "route" }
      let objects = try context.fetch(request)
      defer { context.reset() }
      return objects.map { Self.record(from: $0, includeRoute: false) }
    }
  }

  /// One trip including its route, or nil.
  func trip(id: String) throws -> TripRecord? {
    try context.performAndWait {
      let request = NSFetchRequest<NSManagedObject>(entityName: Self.entityName)
      request.predicate = NSPredicate(format: "id == %@", id)
      request.fetchLimit = 1
      defer { context.reset() }
      return try context.fetch(request).first.map { Self.record(from: $0, includeRoute: true) }
    }
  }

  func deleteAll() throws {
    try context.performAndWait {
      let request = NSFetchRequest<NSManagedObject>(entityName: Self.entityName)
      for object in try context.fetch(request) {
        context.delete(object)
      }
      try context.save()
      context.reset()
    }
  }

  // MARK: - Mapping

  private static func date(_ milliseconds: Double) -> Date {
    Date(timeIntervalSince1970: milliseconds / 1000)
  }

  private static func milliseconds(_ date: Any?) -> Double {
    ((date as? Date)?.timeIntervalSince1970 ?? 0) * 1000
  }

  private static func record(from object: NSManagedObject, includeRoute: Bool) -> TripRecord {
    var route: [TripCoordinate] = []
    if includeRoute, let data = object.value(forKey: "route") as? Data {
      route = (try? JSONDecoder().decode([TripCoordinate].self, from: data)) ?? []
    }
    return TripRecord(
      id: object.value(forKey: "id") as? String ?? "",
      driverName: object.value(forKey: "driverName") as? String ?? "",
      vehicle: object.value(forKey: "vehicle") as? String ?? "",
      pickup: TripCoordinate(
        latitude: object.value(forKey: "pickupLatitude") as? Double ?? 0,
        longitude: object.value(forKey: "pickupLongitude") as? Double ?? 0),
      dropoff: TripCoordinate(
        latitude: object.value(forKey: "dropoffLatitude") as? Double ?? 0,
        longitude: object.value(forKey: "dropoffLongitude") as? Double ?? 0),
      fare: object.value(forKey: "fare") as? Double ?? 0,
      currency: object.value(forKey: "currency") as? String ?? "USD",
      distanceKm: object.value(forKey: "distanceKm") as? Double ?? 0,
      durationSeconds: object.value(forKey: "durationSeconds") as? Double ?? 0,
      startedAt: milliseconds(object.value(forKey: "startedAt")),
      completedAt: milliseconds(object.value(forKey: "completedAt")),
      route: route
    )
  }
}
