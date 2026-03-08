import {NativeModules} from 'react-native'
import {AppControl} from '@impos2/kernel-core-base'

const {ScreenControlModule, AppTurboModule} = NativeModules

class AppControlAdapter implements AppControl {
    isFullScreen(): Promise<boolean> {
        return ScreenControlModule.isFullscreen()
    }

    isAppLocked(): Promise<boolean> {
        return ScreenControlModule.isInLockTaskMode()
    }

    setFullScreen(isFullScreen: boolean): Promise<void> {
        return isFullScreen
            ? ScreenControlModule.enableFullscreen()
            : ScreenControlModule.disableFullscreen()
    }

    setAppLocked(isAppLocked: boolean): Promise<void> {
        return isAppLocked
            ? ScreenControlModule.startLockTask()
            : ScreenControlModule.stopLockTask()
    }

    restartApp(): Promise<void> {
        return AppTurboModule.restartApp()
    }
}

export const appControlAdapter = new AppControlAdapter()
