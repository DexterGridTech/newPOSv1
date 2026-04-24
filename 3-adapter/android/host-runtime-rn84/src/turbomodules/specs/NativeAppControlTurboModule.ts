import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    showLoading(message: string): Promise<void>
    hideLoading(displayIndex: number): Promise<void>
    restartApp(): Promise<void>
    exitApp(): Promise<void>
    setFullscreen(enabled: boolean): Promise<void>
    setKioskMode(enabled: boolean): Promise<void>
    isFullscreen(): Promise<boolean>
    isKioskMode(): Promise<boolean>
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppControlTurboModule')
