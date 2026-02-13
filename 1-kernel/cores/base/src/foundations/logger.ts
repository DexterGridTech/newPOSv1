import {getEnvironment} from "./environment";

export const logger = {
    debug: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        if (!getEnvironment()?.production) {
            console.debug(tag, message, data ?? '')
        }
        loggers.getLoggers().forEach(logger => logger.debug(tags, message, data))
    },
    log: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        if (!getEnvironment()?.production) {
            console.log(tag, message, data ?? '')
        }
        loggers.getLoggers().forEach(logger => logger.log(tags, message, data))
    },
    warn: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        if (!getEnvironment()?.production) {
            console.warn(tag, message, data ?? '')
        }
        loggers.getLoggers().forEach(logger => logger.warn(tags, message, data))
    },
    error: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        if (!getEnvironment()?.production) {
            console.error(tag, message, data ?? '')
        }
        loggers.getLoggers().forEach(logger => logger.error(tags, message, data))
    },
}

class Loggers {
    loggers: ILogger[] = []

    registerLogger(logger: ILogger) {
        this.loggers.push(logger)
    }

    getLoggers() {
        return this.loggers
    }
}

export const loggers = new Loggers()

export interface ILogger {
    debug: (tags: string[], message: string, data?: any) => void
    log: (tags: string[], message: string, data?: any) => void
    warn: (tags: string[], message: string, data?: any) => void
    error: (tags: string[], message: string, data?: any) => void
}