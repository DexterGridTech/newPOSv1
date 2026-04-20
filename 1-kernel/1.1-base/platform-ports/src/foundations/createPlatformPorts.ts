import type {CreatePlatformPortsInput, PlatformPorts} from '../types/ports'

const assertPlatformPortsInput = (
    input: CreatePlatformPortsInput,
) => {
    if (!input.environmentMode) {
        throw new Error('[createPlatformPorts] environmentMode is required')
    }

    const logger = input.logger as Partial<PlatformPorts['logger']> | undefined
    if (!logger) {
        throw new Error('[createPlatformPorts] logger is required')
    }

    const requiredLoggerMethods: Array<keyof NonNullable<PlatformPorts['logger']>> = [
        'emit',
        'debug',
        'info',
        'warn',
        'error',
        'scope',
        'withContext',
    ]

    for (const methodName of requiredLoggerMethods) {
        if (typeof logger[methodName] !== 'function') {
            throw new Error(`[createPlatformPorts] logger.${methodName} must be a function`)
        }
    }
}

export const createPlatformPorts = (
    input: CreatePlatformPortsInput,
): PlatformPorts => {
    assertPlatformPortsInput(input)

    return Object.freeze({
        ...input,
    })
}
