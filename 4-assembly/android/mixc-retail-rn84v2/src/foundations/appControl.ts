import type {AppControl} from '@impos2/kernel-core-base';
import NativeAppControlTurboModule from '../supports/apis/NativeAppControlTurboModule';

export const appControlAdapter: AppControl = {
  isFullScreen: async () => NativeAppControlTurboModule.isFullscreen(),
  isAppLocked: async () => NativeAppControlTurboModule.isKioskMode(),
  setFullScreen: async (isFullScreen: boolean) => {
    await NativeAppControlTurboModule.setFullscreen(isFullScreen);
  },
  setAppLocked: async (isAppLocked: boolean) => {
    await NativeAppControlTurboModule.setKioskMode(isAppLocked);
  },
  restartApp: async () => {
    await NativeAppControlTurboModule.restartApp();
  },
  onAppLoadComplete: async (displayIndex: number) => {
    await NativeAppControlTurboModule.hideLoading(displayIndex);
  },
};
