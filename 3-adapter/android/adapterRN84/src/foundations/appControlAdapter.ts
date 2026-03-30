import {AppControl} from '@impos2/kernel-core-base'
import AppControlModule from '../supports/apis/NativeAppControlModule'

export const appControlAdapter: AppControl = {
    isFullScreen: async () => false,
    isAppLocked: async () => false,
    setFullScreen: async (isFullScreen: boolean) => {
        await AppControlModule.setFullscreen(isFullScreen)
    },
    setAppLocked: async (isAppLocked: boolean) => {
        await AppControlModule.setKioskMode(isAppLocked)
    },
    restartApp: async () => {
        await AppControlModule.restartApp()
    },
    onAppLoadComplete: async (displayIndex: number) => {
        console.log('[appControlAdapter] onAppLoadComplete called with displayIndex:', displayIndex)
        await AppControlModule.hideLoading(displayIndex)
    },
}
