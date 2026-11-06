import Foundation

/// Registers the app's Swift native modules with React Native.
///
/// Objective-C modules do this with the `RCT_EXPORT_MODULE` macro, which calls
/// `RCTRegisterModule` from `+load`. Swift has no `+load`, so the app delegate
/// calls `registerAll()` before React Native starts. The New Architecture's
/// interop layer looks legacy modules up in this same registry.
enum NativeModuleRegistry {
  static let modules: [AnyClass] = [
    LocationService.self,
    HapticFeedback.self,
    TripStore.self,
  ]

  private static var registered = false

  static func registerAll() {
    guard !registered else { return }
    registered = true
    modules.forEach { RCTRegisterModule($0) }
  }
}
