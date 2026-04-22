import { getEnvironment } from "../environment";
export const logger = {
    debug: (tags, message, data) => {
        if (!getEnvironment()?.production)
            console.debug(`[${tags.join('.')}]`, message, data ?? '');
        loggers.forEach(l => l.debug(tags, message, data));
    },
    log: (tags, message, data) => {
        if (!getEnvironment()?.production)
            console.log(`[${tags.join('.')}]`, message, data ?? '');
        loggers.forEach(l => l.log(tags, message, data));
    },
    warn: (tags, message, data) => {
        if (!getEnvironment()?.production)
            console.warn(`[${tags.join('.')}]`, message, data ?? '');
        loggers.forEach(l => l.warn(tags, message, data));
    },
    error: (tags, message, data) => {
        if (!getEnvironment()?.production)
            console.error(`[${tags.join('.')}]`, message, data ?? '');
        loggers.forEach(l => l.error(tags, message, data));
    },
    getLogFiles: () => delegate('getLogFiles'),
    getLogContent: (fileName) => delegate('getLogContent', fileName),
    deleteLogFile: (fileName) => delegate('deleteLogFile', fileName),
    clearAllLogs: () => delegate('clearAllLogs'),
    getLogDirPath: () => delegate('getLogDirPath'),
};
const delegate = (method, ...args) => {
    const impl = loggers.find(l => typeof l[method] === 'function');
    if (!impl)
        return Promise.resolve(null);
    return impl[method](...args);
};
const loggers = [];
export const registerLogger = (l) => loggers.push(l);
