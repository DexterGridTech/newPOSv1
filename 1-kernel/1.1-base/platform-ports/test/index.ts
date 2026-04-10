import {createLoggerPort, createPlatformPorts, packageVersion, type LogEvent} from '../src'

const events: LogEvent[] = []

const logger = createLoggerPort({
    environmentMode: 'PROD',
    write: event => {
        events.push(event)
    },
    scope: {
        moduleName: 'kernel.base.platform-ports.test',
        layer: 'kernel',
    },
})

logger.info({
    category: 'runtime.lifecycle',
    event: 'test-verification',
    message: 'hello',
    data: {token: 'secret-token'},
})

const ports = createPlatformPorts({
    environmentMode: 'PROD',
    logger,
})

if (!ports.logger) {
    throw new Error('PlatformPorts logger missing')
}

if (events[0]?.security.maskingMode !== 'masked') {
    throw new Error('PROD logging should be masked')
}

if (events[0]?.data?.token !== '[MASKED]') {
    throw new Error('Sensitive payload should be masked in PROD')
}

console.log('[platform-ports-test-scenario]', {
    packageName: '@impos2/kernel-base-platform-ports',
    packageVersion,
    eventCount: events.length,
    firstEvent: events[0],
})
