import {getEnvironment} from "../environment";

export interface Logger {
    debug: (tags: string[], message: string, data?: any) => void
    log: (tags: string[], message: string, data?: any) => void
    warn: (tags: string[], message: string, data?: any) => void
    error: (tags: string[], message: string, data?: any) => void
}

export const logger:Logger = {
    debug: (tags: string[], message: string, data?: any) => {
        if (!getEnvironment()?.production) {
            const tag = `[${tags.join('.')}]`
            console.debug(tag, message, data ?? '')
        }
        loggers.forEach(logger => logger.debug(tags, message, data))
    },
    log: (tags: string[], message: string, data?: any) => {
        if (!getEnvironment()?.production) {
            const tag = `[${tags.join('.')}]`
            console.log(tag, message, data ?? '')
        }
        loggers.forEach(logger => logger.log(tags, message, data))
    },
    warn: (tags: string[], message: string, data?: any) => {
        if (!getEnvironment()?.production) {
            const tag = `[${tags.join('.')}]`
            console.warn(tag, message, data ?? '')
        }
        loggers.forEach(logger => logger.warn(tags, message, data))
    },
    error: (tags: string[], message: string, data?: any) => {
        if (!getEnvironment()?.production) {
            const tag = `[${tags.join('.')}]`
            console.error(tag, message, data ?? '')
        }
        loggers.forEach(logger => logger.error(tags, message, data))
    },
}

const loggers: Logger[] = []
export const registerLogger = (logger: Logger) => loggers.push(logger)

