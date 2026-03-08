import { AppControl } from '@impos2/kernel-core-base'

class AppControlAdapter implements AppControl {
    isFullScreen(): Promise<boolean> {
        return window.electronBridge.invoke('appControl:isFullScreen')
    }

    setFullScreen(isFullScreen: boolean): Promise<void> {
        return window.electronBridge.invoke('appControl:setFullScreen', isFullScreen)
    }

    isAppLocked(): Promise<boolean> {
        return window.electronBridge.invoke('appControl:isAppLocked')
    }

    setAppLocked(isAppLocked: boolean): Promise<void> {
        return window.electronBridge.invoke('appControl:setAppLocked', isAppLocked)
    }

    restartApp(): Promise<void> {
        return window.electronBridge.invoke('appControl:restartApp')
    }
}

export const appControlAdapter = new AppControlAdapter()
