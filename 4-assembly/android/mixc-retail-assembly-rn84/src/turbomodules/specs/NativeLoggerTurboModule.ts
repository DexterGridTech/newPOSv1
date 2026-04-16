import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
    debug(tag: string, message: string): void
    log(tag: string, message: string): void
    warn(tag: string, message: string): void
    error(tag: string, message: string): void
    getLogFiles(): Promise<ReadonlyArray<Record<string, unknown>>>
    getLogContent(fileName: string, maxBytes: number): Promise<string>
    deleteLogFile(fileName: string): Promise<boolean>
    clearAllLogs(): Promise<boolean>
    getLogDirPath(): Promise<string>
    addListener(eventName: string): void
    removeListeners(count: number): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('LoggerTurboModule')
