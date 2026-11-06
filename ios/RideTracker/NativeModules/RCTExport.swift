import Foundation

/// Swift equivalent of React Native's `RCT_EXPORT_METHOD` macro.
///
/// React Native discovers a module's methods by calling every class method whose
/// selector starts with `__rct_export__`; each returns a pointer to an
/// `RCTMethodInfo` describing the Objective-C signature. The macro generates
/// those methods in Objective-C; Swift modules declare them explicitly:
///
///     @objc static func __rct_export__stop() -> UnsafePointer<RCTMethodInfo> {
///       RCTExport.method("stop")
///     }
///
/// The signature string uses the same syntax as the macro body, e.g.
/// `"getTrip:(NSString *)tripId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject"`,
/// and must match the selector of the Swift `@objc` method.
enum RCTExport {
  private static var cache: [String: UnsafePointer<RCTMethodInfo>] = [:]
  private static let lock = NSLock()

  static func method(_ signature: String, jsName: String = "", isSync: Bool = false)
    -> UnsafePointer<RCTMethodInfo>
  {
    let key = "\(jsName)|\(signature)|\(isSync)"
    lock.lock()
    defer { lock.unlock() }
    if let info = cache[key] {
      return info
    }
    // React Native keeps these pointers for the life of the app, so the strings
    // and the struct are allocated once and intentionally never freed.
    let info = UnsafeMutablePointer<RCTMethodInfo>.allocate(capacity: 1)
    info.initialize(
      to: RCTMethodInfo(
        jsName: UnsafePointer(strdup(jsName)!),
        objcName: UnsafePointer(strdup(signature)!),
        // BOOL is `bool` on iOS devices but `signed char` elsewhere; .init fits both.
        isSync: .init(isSync)
      )
    )
    let pointer = UnsafePointer(info)
    cache[key] = pointer
    return pointer
  }
}
