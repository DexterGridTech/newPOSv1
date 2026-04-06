import type {AppControl} from '@impos2/kernel-core-base';
import {getHostBridge} from './hostBridge';

export const appControlAdapter: AppControl = {
  isFullScreen: () => getHostBridge().appControl.isFullScreen(),
  isAppLocked: () => getHostBridge().appControl.isAppLocked(),
  setFullScreen: (isFullScreen: boolean) => getHostBridge().appControl.setFullScreen(isFullScreen),
  setAppLocked: (isAppLocked: boolean) => getHostBridge().appControl.setAppLocked(isAppLocked),
  restartApp: () => getHostBridge().appControl.restartApp(),
  onAppLoadComplete: (displayIndex: number) => getHostBridge().appControl.onAppLoadComplete(displayIndex),
};
