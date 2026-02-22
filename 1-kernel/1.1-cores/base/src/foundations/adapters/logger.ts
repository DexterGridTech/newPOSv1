import {getEnvironment} from "../environment";

export interface LogFile {
    fileName: string
    filePath: string
    fileSize: number
    lastModified: number
}

export interface Logger {
    debug: (tags: string[], message: string, data?: any) => void
    log: (tags: string[], message: string, data?: any) => void
    warn: (tags: string[], message: string, data?: any) => void
    error: (tags: string[], message: string, data?: any) => void
    getLogFiles: () => Promise<LogFile[]>
    getLogContent: (fileName: string) => Promise<string>
    deleteLogFile: (fileName: string) => Promise<boolean>
    clearAllLogs: () => Promise<boolean>
    getLogDirPath: () => Promise<string>
}

export const logger: Logger = {
    debug: (tags, message, data?) => {
        if (!getEnvironment()?.production) console.debug(`[${tags.join('.')}]`, message, data ?? '')
        loggers.forEach(l => l.debug(tags, message, data))
    },
    log: (tags, message, data?) => {
        if (!getEnvironment()?.production) console.log(`[${tags.join('.')}]`, message, data ?? '')
        loggers.forEach(l => l.log(tags, message, data))
    },
    warn: (tags, message, data?) => {
        if (!getEnvironment()?.production) console.warn(`[${tags.join('.')}]`, message, data ?? '')
        loggers.forEach(l => l.warn(tags, message, data))
    },
    error: (tags, message, data?) => {
        if (!getEnvironment()?.production) console.error(`[${tags.join('.')}]`, message, data ?? '')
        loggers.forEach(l => l.error(tags, message, data))
    },
    getLogFiles: () => delegate('getLogFiles'),
    getLogContent: (fileName) => delegate('getLogContent', fileName),
    deleteLogFile: (fileName) => delegate('deleteLogFile', fileName),
    clearAllLogs: () => delegate('clearAllLogs'),
    getLogDirPath: () => delegate('getLogDirPath'),
}

const delegate = (method: keyof Logger, ...args: any[]): Promise<any> => {
    const impl = loggers.find(l => typeof (l as any)[method] === 'function')
    if (!impl) return Promise.resolve(null)
    return (impl as any)[method](...args)
}

const loggers: Logger[] = []
export const registerLogger = (l: Logger) => loggers.push(l)
