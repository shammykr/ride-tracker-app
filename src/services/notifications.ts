import PushNotificationIOS from '@react-native-community/push-notification-ios';
import {Platform} from 'react-native';
import PushNotification from 'react-native-push-notification';

const CHANNEL_ID = 'ride-updates';
let configured = false;
let deviceToken: string | null = null;

/**
 * Sets up react-native-push-notification. Local notifications are used for ride
 * updates in the demo. `onRegister` receives the APNs device token once the
 * user grants permission, which is where a real backend would be told where
 * to send remote pushes.
 */
export function configureNotifications(): void {
  if (configured) {
    return;
  }
  configured = true;
  PushNotification.configure({
    onRegister: ({token}) => {
      deviceToken = token;
      // A real app would POST this token to its backend for APNs delivery.
      console.log('[notifications] APNs device token', token);
    },
    onNotification: notification => {
      notification.finish(PushNotificationIOS.FetchResult.NoData);
    },
    onRegistrationError: error => {
      console.warn('[notifications] registration failed', error.message);
    },
    permissions: {alert: true, badge: true, sound: true},
    popInitialNotification: true,
    requestPermissions: Platform.OS === 'ios',
  });
  if (Platform.OS === 'android') {
    PushNotification.createChannel(
      {channelId: CHANNEL_ID, channelName: 'Ride updates'},
      () => {},
    );
  }
}

export function getDeviceToken(): string | null {
  return deviceToken;
}

export function notify(title: string, message: string): void {
  PushNotification.localNotification({channelId: CHANNEL_ID, title, message});
}
