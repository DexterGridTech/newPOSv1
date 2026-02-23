export interface AppControl {
    isFullScreen(): Promise<boolean>

    isAppLocked(): Promise<boolean>

    setFullScreen(isFullScreen: boolean): Promise<void>

    setAppLocked(isAppLocked: boolean): Promise<void>

    restartApp(): Promise<void>
}

export const appControl: AppControl = {
    isAppLocked(): Promise<boolean> {
        if (registeredAppControl)
            return registeredAppControl.isAppLocked()
        return Promise.resolve(false)
    },
    isFullScreen(): Promise<boolean> {
        if (registeredAppControl)
            return registeredAppControl.isFullScreen()
        return Promise.resolve(false)
    },
    setAppLocked(isAppLocked: boolean): Promise<void> {
        if (registeredAppControl)
            return registeredAppControl.setAppLocked(isAppLocked)
        return Promise.resolve()
    },
    setFullScreen(isFullScreen: boolean): Promise<void> {
        if (registeredAppControl)
            return registeredAppControl.setFullScreen(isFullScreen)
        return Promise.resolve()
    },
    restartApp(): Promise<void> {
        if (registeredAppControl)
            return registeredAppControl.restartApp()
        return Promise.resolve()
    }
}

let registeredAppControl: AppControl | null = null

export function registerAppControl(appControl: AppControl): void {
    registeredAppControl = appControl
}
