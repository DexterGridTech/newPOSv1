import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    isFullScreen(): Promise<boolean>
    isAppLocked(): Promise<boolean>
    setFullScreen(isFullScreen: boolean): Promise<void>
    setAppLocked(isAppLocked: boolean): Promise<void>
    restartApp(): Promise<void>
    onAppLoadComplete(displayIndex: number): Promise<void>
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppControlModule')
