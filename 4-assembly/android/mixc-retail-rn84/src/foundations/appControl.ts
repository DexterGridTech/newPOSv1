import {AppControl} from '@impos2/kernel-core-base'
import NativeAppControlModule from '../supports/apis/NativeAppControlModule'

class AppControlAdapter implements AppControl {
    isFullScreen(): Promise<boolean> {
        return NativeAppControlModule.isFullScreen()
    }

    isAppLocked(): Promise<boolean> {
        return NativeAppControlModule.isAppLocked()
    }

    setFullScreen(isFullScreen: boolean): Promise<void> {
        return NativeAppControlModule.setFullScreen(isFullScreen)
    }

    setAppLocked(isAppLocked: boolean): Promise<void> {
        return NativeAppControlModule.setAppLocked(isAppLocked)
    }

    restartApp(): Promise<void> {
        return NativeAppControlModule.restartApp()
    }

    onAppLoadComplete(displayIndex: number): Promise<void> {
        return NativeAppControlModule.onAppLoadComplete(displayIndex)
    }
}

export const appControlAdapter = new AppControlAdapter()
