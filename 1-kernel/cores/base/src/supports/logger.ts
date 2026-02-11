
export const logger = {
    debug: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        console.debug(tag, message, data??'')
        // getNativeAdapter()?.logger.debug(tag, message, data)
    },
    log: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        console.log(tag, message, data??'')
        // getNativeAdapter()?.logger.log(tag, message, data)
    },
    warn: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        console.warn(tag, message, data??'')
        // getNativeAdapter()?.logger.warn(tag, message, data)
    },
    error: (tags: string[], message: string, data?: any) => {
        const tag = `[${tags.join('.')}]`
        console.error(tag, message, data??'')
        // getNativeAdapter()?.logger.error(tag, message, data)
    },
}