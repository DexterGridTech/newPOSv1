import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { debug, info, warn, error as logError } from '@tauri-apps/plugin-log'
import type { Logger } from '@impos2/kernel-core-base'

export interface LogFile {
    fileName: string
    filePath: string
    fileSize: number
    lastModified: number
}

export class LoggerAdapter implements Logger {
    debug(tags: string[], message: string, data?: any): void {
        debug(`[${tags.join('.')}] ${this.buildMessage(message, data)}`)
    }

    log(tags: string[], message: string, data?: any): void {
        info(`[${tags.join('.')}] ${this.buildMessage(message, data)}`)
    }

    warn(tags: string[], message: string, data?: any): void {
        warn(`[${tags.join('.')}] ${this.buildMessage(message, data)}`)
    }

    error(tags: string[], message: string, data?: any): void {
        logError(`[${tags.join('.')}] ${this.buildMessage(message, data)}`)
    }

    async getLogFiles(): Promise<LogFile[]> {
        return invoke<LogFile[]>('plugin:log|get_log_files')
    }

    async getLogContent(fileName: string): Promise<string> {
        return invoke<string>('plugin:log|get_log_content', { fileName })
    }

    async deleteLogFile(fileName: string): Promise<boolean> {
        return invoke<boolean>('plugin:log|delete_log_file', { fileName })
    }

    async clearAllLogs(): Promise<boolean> {
        return invoke<boolean>('plugin:log|clear_all_logs')
    }

    async getLogDirPath(): Promise<string> {
        return invoke<string>('plugin:log|get_log_dir_path')
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
