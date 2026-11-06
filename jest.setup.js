/* global jest */
// Native-only libraries are replaced with inert mocks in Jest.
jest.mock('react-native-push-notification', () => ({
  configure: jest.fn(),
  createChannel: jest.fn(),
  localNotification: jest.fn(),
}));

jest.mock('@react-native-community/push-notification-ios', () => ({
  FetchResult: { NoData: 'UIBackgroundFetchResultNoData' },
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mock = name => {
    const Component = props =>
      React.createElement(View, { ...props, testID: props.testID ?? name });
    Component.displayName = name;
    return Component;
  };
  return {
    __esModule: true,
    default: mock('MapView'),
    Marker: mock('Marker'),
    Polyline: mock('Polyline'),
  };
});
