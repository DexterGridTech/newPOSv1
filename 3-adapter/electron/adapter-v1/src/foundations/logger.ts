import type { Logger } from '@impos2/kernel-core-base'

export interface LogFile {
    fileName: string
    filePath: string
    fileSize: number
    lastModified: number
}

export class LoggerAdapter implements Logger {
    debug(tags: string[], message: string, data?: any): void {
        console.debug(`[${tags.join('.')}]`, this.buildMessage(message, data))
    }

    log(tags: string[], message: string, data?: any): void {
        console.log(`[${tags.join('.')}]`, this.buildMessage(message, data))
    }

    warn(tags: string[], message: string, data?: any): void {
        console.warn(`[${tags.join('.')}]`, this.buildMessage(message, data))
    }

    error(tags: string[], message: string, data?: any): void {
        console.error(`[${tags.join('.')}]`, this.buildMessage(message, data))
    }

    async getLogFiles(): Promise<LogFile[]> {
        // Electron: 通过 IPC 调用主进程读取日志文件列表
        return window.electronBridge.invoke('logger:getLogFiles')
    }

    async getLogContent(fileName: string): Promise<string> {
        return window.electronBridge.invoke('logger:getLogContent', fileName)
    }

    async deleteLogFile(fileName: string): Promise<boolean> {
        return window.electronBridge.invoke('logger:deleteLogFile', fileName)
    }

    async clearAllLogs(): Promise<boolean> {
        return window.electronBridge.invoke('logger:clearAllLogs')
    }

    async getLogDirPath(): Promise<string> {
        return window.electronBridge.invoke('logger:getLogDirPath')
    }

    private buildMessage(message: string, data?: any): string {
        if (data == null) return message
        if (data instanceof Error) return `${message}\n${data.stack ?? data.message}`
        if (typeof data === 'object') {
            try { return `${message}\n${JSON.stringify(data, null, 2)}` } catch { return `${message}\n[unserializable]` }
        }
        return `${message}\n${String(data)}`
    }
}

export const loggerAdapter = new LoggerAdapter()
