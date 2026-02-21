import {NativeModules} from 'react-native'
import type {Logger} from '@impos2/kernel-core-base'

const {LoggerTurboModule} = NativeModules

const callModule = (method: string, ...args: any[]) => {
    if (!LoggerTurboModule) return
    LoggerTurboModule[method](...args)
}

export interface LogFile {
    fileName: string
    filePath: string
    fileSize: number
    lastModified: number
}

export class LoggerAdapter implements Logger {
    debug(tags: string[], message: string, data?: any): void {
        callModule('debug', tags.join('.'), this.buildMessage(message, data))
    }

    log(tags: string[], message: string, data?: any): void {
        callModule('log', tags.join('.'), this.buildMessage(message, data))
    }

    warn(tags: string[], message: string, data?: any): void {
        callModule('warn', tags.join('.'), this.buildMessage(message, data))
    }

    error(tags: string[], message: string, data?: any): void {
        callModule('error', tags.join('.'), this.buildMessage(message, data))
    }

    async getLogFiles(): Promise<LogFile[]> {
        if (!LoggerTurboModule) throw new Error('LoggerTurboModule not available')
        return LoggerTurboModule.getLogFiles()
    }

    async getLogContent(fileName: string): Promise<string> {
        if (!LoggerTurboModule) throw new Error('LoggerTurboModule not available')
        return LoggerTurboModule.getLogContent(fileName)
    }

    async deleteLogFile(fileName: string): Promise<boolean> {
        if (!LoggerTurboModule) throw new Error('LoggerTurboModule not available')
        return LoggerTurboModule.deleteLogFile(fileName)
    }

    async clearAllLogs(): Promise<boolean> {
        if (!LoggerTurboModule) throw new Error('LoggerTurboModule not available')
        return LoggerTurboModule.clearAllLogs()
    }

    async getLogDirPath(): Promise<string> {
        if (!LoggerTurboModule) throw new Error('LoggerTurboModule not available')
        return LoggerTurboModule.getLogDirPath()
    }

    private buildMessage(message: string, data?: any): string {
        if (data == null) return message
        if (data instanceof Error) return `${message}\n${data.stack ?? data.message}`
        if (typeof data === 'object') {
            try {
                return `${message}\n${JSON.stringify(data, null, 2)}`
            } catch {
                return `${message}\n[unserializable]`
            }
        }
        return `${message}\n${String(data)}`
    }
}

export const loggerAdapter = new LoggerAdapter()
