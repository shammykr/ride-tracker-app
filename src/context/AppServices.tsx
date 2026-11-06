import React, { createContext, useContext, useMemo } from 'react';
import { SERVER_URL } from '../config';
import { HapticFeedback, type ImpactStyle } from '../native/HapticFeedback';
import { LocationService } from '../native/LocationService';
import { tripStore, type TripStore } from '../native/TripStore';
import { RideSocket } from '../services/RideSocket';
import { notify } from '../services/notifications';

/** Everything the ViewModels talk to, injected so tests can swap in fakes. */
export interface AppServices {
  socket: RideSocket;
  tripStore: TripStore;
  location: Pick<
    typeof LocationService,
    'getCurrentPosition' | 'watchPosition'
  >;
  haptics: { impact(style?: ImpactStyle): void };
  notify(title: string, message: string): void;
}

const AppServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({
  services,
  children,
}: {
  services?: Partial<AppServices>;
  children: React.ReactNode;
}) {
  const value = useMemo<AppServices>(
    () => ({
      socket: services?.socket ?? new RideSocket(SERVER_URL),
      tripStore: services?.tripStore ?? tripStore,
      location: services?.location ?? LocationService,
      haptics: services?.haptics ?? HapticFeedback,
      notify: services?.notify ?? notify,
    }),
    // Services are created once for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <AppServicesContext.Provider value={value}>
      {children}
    </AppServicesContext.Provider>
  );
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) {
    throw new Error('useAppServices must be used inside <AppServicesProvider>');
  }
  return services;
}
