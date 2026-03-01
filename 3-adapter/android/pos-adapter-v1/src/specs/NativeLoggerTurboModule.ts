import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface LogFile {
    fileName: string
    filePath: string
    fileSize: number
    lastModified: number
}

export interface Spec extends TurboModule {
    debug(tag: string, message: string): void
    log(tag: string, message: string): void
    warn(tag: string, message: string): void
    error(tag: string, message: string): void
    getLogFiles(): Promise<LogFile[]>
    getLogContent(fileName: string): Promise<string>
    deleteLogFile(fileName: string): Promise<boolean>
    clearAllLogs(): Promise<boolean>
    getLogDirPath(): Promise<string>
    sendLogFileToServer(dateStr: string, serverURL: string, paramsJson: string): Promise<boolean>
}

export default TurboModuleRegistry.getEnforcing<Spec>('LoggerTurboModule')
