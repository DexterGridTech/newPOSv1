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
        throw new Error("App control not registered")
    },
    isFullScreen(): Promise<boolean> {
        if (registeredAppControl)
            return registeredAppControl.isFullScreen()
        throw new Error("App control not registered")
    },
    setAppLocked(isAppLocked: boolean): Promise<void> {
        if (registeredAppControl)
            return registeredAppControl.setAppLocked(isAppLocked)
        throw new Error("App control not registered")
    },
    setFullScreen(isFullScreen: boolean): Promise<void> {
        if (registeredAppControl)
            return registeredAppControl.setFullScreen(isFullScreen)
        throw new Error("App control not registered")
    },
    restartApp(): Promise<void> {
        if (registeredAppControl)
            return registeredAppControl.restartApp()
        throw new Error("App control not registered")
    }
}

let registeredAppControl: AppControl | null = null

export function registerAppControl(appControl: AppControl): void {
    registeredAppControl = appControl
}
