import type {Logger} from '@impos2/kernel-core-base'

export interface LogFile {
    fileName: string
    filePath: string
    fileSize: number
    lastModified: number
}

// Stub: LoggerTurboModule 尚未实现，使用 console 代替
export class LoggerAdapter implements Logger {
    debug(tags: string[], message: string, data?: any): void {
        console.debug(`[${tags.join('.')}] ${this.buildMessage(message, data)}`)
    }

    log(tags: string[], message: string, data?: any): void {
        console.log(`[${tags.join('.')}] ${this.buildMessage(message, data)}`)
    }

    warn(tags: string[], message: string, data?: any): void {
        console.warn(`[${tags.join('.')}] ${this.buildMessage(message, data)}`)
    }

    error(tags: string[], message: string, data?: any): void {
        console.error(`[${tags.join('.')}] ${this.buildMessage(message, data)}`)
    }

    async getLogFiles(): Promise<LogFile[]> {
        return []
    }

    async getLogContent(_fileName: string): Promise<string> {
        return ''
    }

    async deleteLogFile(_fileName: string): Promise<boolean> {
        return false
    }

    async clearAllLogs(): Promise<boolean> {
        return false
    }

    async getLogDirPath(): Promise<string> {
        return ''
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
