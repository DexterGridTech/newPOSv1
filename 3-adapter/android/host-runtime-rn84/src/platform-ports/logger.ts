import {createLoggerPort} from '@impos2/kernel-base-platform-ports'
import type {LogEnvironmentMode, LogEvent} from '@impos2/kernel-base-platform-ports'
import {nativeLogger} from '../turbomodules'

const stringifyLogEvent = (event: LogEvent): string => {
    const message = event.message ?? event.event
    const data = event.data ? ` ${JSON.stringify(event.data)}` : ''
    return `[${event.category}] ${message}${data}`
}

export const createAssemblyLogger = (
    environmentMode: LogEnvironmentMode,
) => createLoggerPort({
    environmentMode,
    scope: {
        moduleName: 'adapter.android.host-runtime-rn84',
        layer: 'assembly',
    },
    write(event) {
        const tag = [
            event.scope.layer,
            event.scope.moduleName,
            event.scope.subsystem,
            event.scope.component,
        ].filter(Boolean).join('.')
        const message = stringifyLogEvent(event)
        if (event.level === 'debug') {
            nativeLogger.debug(tag, message)
            return
        }
        if (event.level === 'warn') {
            nativeLogger.warn(tag, message)
            return
        }
        if (event.level === 'error') {
            nativeLogger.error(tag, message)
            return
        }
        nativeLogger.log(tag, message)
    },
})
