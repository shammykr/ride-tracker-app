import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Ride: undefined;
  History: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList>;
  TripDetail: { tripId: string };
};
