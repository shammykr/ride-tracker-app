import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppServicesProvider} from './src/context/AppServices';
import {AppCoordinator} from './src/navigation/AppCoordinator';
import {configureNotifications} from './src/services/notifications';

export default function App() {
  useEffect(() => {
    configureNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppServicesProvider>
        <AppCoordinator />
      </AppServicesProvider>
    </SafeAreaProvider>
  );
}
