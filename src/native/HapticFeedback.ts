import { NativeModules } from 'react-native';

export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';

interface HapticFeedbackNative {
  impact(style: ImpactStyle): void;
}

/** Swift module (ios/RideTracker/NativeModules/HapticFeedback.swift). No-op elsewhere. */
const native: HapticFeedbackNative | undefined = NativeModules.HapticFeedback;

export const HapticFeedback = {
  impact(style: ImpactStyle = 'medium'): void {
    native?.impact(style);
  },
};
