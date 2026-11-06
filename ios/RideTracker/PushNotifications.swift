import Foundation
import UIKit
import UserNotifications

/// Connects iOS notification callbacks to `@react-native-community/push-notification-ios`,
/// which `react-native-push-notification` uses on iOS.
///
/// Local notifications work out of the box. For remote (APNs) notifications the
/// app registers for a device token (forwarded to JS as the `register` event);
/// sending pushes needs an APNs key and the `aps-environment` entitlement
/// (already in RideTracker.entitlements).
final class PushNotifications: NSObject, UNUserNotificationCenterDelegate {
  static let shared = PushNotifications()

  func configure() {
    UNUserNotificationCenter.current().delegate = self
  }

  // MARK: - APNs registration (forwarded from the app delegate)

  func didRegister(deviceToken: Data) {
    RNCPushNotificationIOS.didRegisterForRemoteNotifications(withDeviceToken: deviceToken)
  }

  func didFailToRegister(error: Error) {
    RNCPushNotificationIOS.didFailToRegisterForRemoteNotificationsWithError(error)
  }

  func didReceiveRemote(
    _ userInfo: [AnyHashable: Any],
    completion: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    RNCPushNotificationIOS.didReceiveRemoteNotification(userInfo, fetchCompletionHandler: completion)
  }

  // MARK: - UNUserNotificationCenterDelegate

  /// Show ride updates as banners even while the app is in the foreground.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .list, .sound, .badge])
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    RNCPushNotificationIOS.didReceive(response)
    completionHandler()
  }
}
