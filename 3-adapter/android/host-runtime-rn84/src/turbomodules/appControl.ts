import NativeAppControlTurboModule from './specs/NativeAppControlTurboModule'

export const nativeAppControl = {
    showLoading(message: string): Promise<void> {
        return NativeAppControlTurboModule.showLoading(message)
    },
    hideLoading(displayIndex: number): Promise<void> {
        return NativeAppControlTurboModule.hideLoading(displayIndex)
    },
    onAppLoadComplete(displayIndex: number): Promise<void> {
        return NativeAppControlTurboModule.hideLoading(displayIndex)
    },
    restartApp(): Promise<void> {
        return NativeAppControlTurboModule.restartApp()
    },
    exitApp(): Promise<void> {
        return NativeAppControlTurboModule.exitApp()
    },
    setFullScreen(enabled: boolean): Promise<void> {
        return NativeAppControlTurboModule.setFullscreen(enabled)
    },
    setAppLocked(enabled: boolean): Promise<void> {
        return NativeAppControlTurboModule.setKioskMode(enabled)
    },
    isFullScreen(): Promise<boolean> {
        return NativeAppControlTurboModule.isFullscreen()
    },
    isAppLocked(): Promise<boolean> {
        return NativeAppControlTurboModule.isKioskMode()
    },
}
