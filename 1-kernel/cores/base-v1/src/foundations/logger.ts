import {getEnvironment} from "./environment";

export const logger = {
    debug: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        if (!getEnvironment()?.production) {
            console.debug(tag, message, data ?? '')
        }
        loggers.forEach(logger => logger.debug(tags, message, data))
    },
    log: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        if (!getEnvironment()?.production) {
            console.log(tag, message, data ?? '')
        }
        loggers.forEach(logger => logger.log(tags, message, data))
    },
    warn: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        if (!getEnvironment()?.production) {
            console.warn(tag, message, data ?? '')
        }
        loggers.forEach(logger => logger.warn(tags, message, data))
    },
    error: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        if (!getEnvironment()?.production) {
            console.error(tag, message, data ?? '')
        }
        loggers.forEach(logger => logger.error(tags, message, data))
    },
}

const loggers: ILogger[] = []
export const registerLogger = (logger: ILogger) => loggers.push(logger)

export interface ILogger {
    debug: (tags: string[], message: string, data?: any) => void
    log: (tags: string[], message: string, data?: any) => void
    warn: (tags: string[], message: string, data?: any) => void
    error: (tags: string[], message: string, data?: any) => void
}