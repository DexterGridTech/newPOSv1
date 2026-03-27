export interface AppControl {
    isFullScreen(): Promise<boolean>
    isAppLocked(): Promise<boolean>
    setFullScreen(isFullScreen: boolean): Promise<void>
    setAppLocked(isAppLocked: boolean): Promise<void>
    restartApp(): Promise<void>
}

export const appControl: AppControl = {
    isAppLocked: () => registeredAppControl ? registeredAppControl.isAppLocked() : Promise.resolve(false),
    isFullScreen: () => registeredAppControl ? registeredAppControl.isFullScreen() : Promise.resolve(false),
    setAppLocked: (v) => registeredAppControl ? registeredAppControl.setAppLocked(v) : Promise.resolve(),
    setFullScreen: (v) => registeredAppControl ? registeredAppControl.setFullScreen(v) : Promise.resolve(),
    restartApp: () => registeredAppControl ? registeredAppControl.restartApp() : Promise.resolve(),
}

let registeredAppControl: AppControl | null = null

export function registerAppControl(appControl: AppControl): void {
    registeredAppControl = appControl
}
