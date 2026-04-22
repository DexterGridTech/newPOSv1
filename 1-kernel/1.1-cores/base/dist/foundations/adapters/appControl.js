export const appControl = {
    isAppLocked: () => registeredAppControl ? registeredAppControl.isAppLocked() : Promise.resolve(false),
    isFullScreen: () => registeredAppControl ? registeredAppControl.isFullScreen() : Promise.resolve(false),
    setAppLocked: (v) => registeredAppControl ? registeredAppControl.setAppLocked(v) : Promise.resolve(),
    setFullScreen: (v) => registeredAppControl ? registeredAppControl.setFullScreen(v) : Promise.resolve(),
    restartApp: () => registeredAppControl ? registeredAppControl.restartApp() : Promise.resolve(),
};
let registeredAppControl = null;
export function registerAppControl(appControl) {
    registeredAppControl = appControl;
}
