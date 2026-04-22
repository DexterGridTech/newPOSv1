export interface AppControl {
    isFullScreen(): Promise<boolean>;
    isAppLocked(): Promise<boolean>;
    setFullScreen(isFullScreen: boolean): Promise<void>;
    setAppLocked(isAppLocked: boolean): Promise<void>;
    restartApp(): Promise<void>;
}
export declare const appControl: AppControl;
export declare function registerAppControl(appControl: AppControl): void;
//# sourceMappingURL=appControl.d.ts.map