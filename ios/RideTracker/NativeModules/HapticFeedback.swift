import Foundation
import UIKit

/// `NativeModules.HapticFeedback`: impact haptics via UIImpactFeedbackGenerator.
///
/// JS API:
///   impact(style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'): void
@objc(HapticFeedback)
final class HapticFeedback: NSObject, RCTBridgeModule {
  /// Generators are reused so the Taptic Engine stays primed between calls.
  private var generators: [UIImpactFeedbackGenerator.FeedbackStyle: UIImpactFeedbackGenerator] =
    [:]

  @objc static func moduleName() -> String! { "HapticFeedback" }

  @objc static func requiresMainQueueSetup() -> Bool { false }

  static func style(named name: String) -> UIImpactFeedbackGenerator.FeedbackStyle? {
    switch name.lowercased() {
    case "light": return .light
    case "medium": return .medium
    case "heavy": return .heavy
    case "soft": return .soft
    case "rigid": return .rigid
    default: return nil
    }
  }

  @objc static func __rct_export__impact() -> UnsafePointer<RCTMethodInfo> {
    RCTExport.method("impact:(NSString *)style")
  }

  /// Unknown styles fall back to `.medium` rather than failing: haptics are a nicety.
  @objc(impact:)
  func impact(_ style: String) {
    let feedbackStyle = Self.style(named: style) ?? .medium
    DispatchQueue.main.async {
      let generator = self.generators[feedbackStyle] ?? UIImpactFeedbackGenerator(style: feedbackStyle)
      self.generators[feedbackStyle] = generator
      generator.impactOccurred()
      generator.prepare()
    }
  }
}
