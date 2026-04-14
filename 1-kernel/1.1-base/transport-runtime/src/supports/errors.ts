import {createAppError, isAppError} from '@impos2/kernel-base-contracts'
import type {AppError, ErrorDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

export const transportRuntimeErrorDefinitions = {
    configuration: {
        key: 'kernel.base.transport-runtime.configuration_error',
        name: 'Transport Configuration Error',
        defaultTemplate: '${message}',
        category: 'SYSTEM',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    network: {
        key: 'kernel.base.transport-runtime.network_error',
        name: 'Transport Network Error',
        defaultTemplate: '${message}',
        category: 'NETWORK',
        severity: 'MEDIUM',
        moduleName,
    } satisfies ErrorDefinition,
    parse: {
        key: 'kernel.base.transport-runtime.parse_error',
        name: 'Transport Parse Error',
        defaultTemplate: '${message}',
        category: 'VALIDATION',
        severity: 'MEDIUM',
        moduleName,
    } satisfies ErrorDefinition,
    httpRuntimeFailed: {
        key: 'kernel.base.transport-runtime.http_runtime_failed',
        name: 'HTTP Runtime Failed',
        defaultTemplate: 'HTTP runtime failed for ${endpointName}',
        category: 'NETWORK',
        severity: 'MEDIUM',
        moduleName,
    } satisfies ErrorDefinition,
    socketRuntimeFailed: {
        key: 'kernel.base.transport-runtime.socket_runtime_failed',
        name: 'Socket Runtime Failed',
        defaultTemplate: 'Socket runtime failed for ${profileName}',
        category: 'NETWORK',
        severity: 'MEDIUM',
        moduleName,
    } satisfies ErrorDefinition,
} as const

export const transportRuntimeErrorDefinitionList: readonly ErrorDefinition[] = Object.values(
    transportRuntimeErrorDefinitions,
)

export const createTransportConfigurationError = (message: string, details?: unknown) => {
    return createAppError(transportRuntimeErrorDefinitions.configuration, {
        args: {message},
        details,
    })
}

export const createTransportNetworkError = (message: string, details?: unknown) => {
    return createAppError(transportRuntimeErrorDefinitions.network, {
        args: {message},
        details,
    })
}

export const createTransportParseError = (message: string, details?: unknown) => {
    return createAppError(transportRuntimeErrorDefinitions.parse, {
        args: {message},
        details,
    })
}

export const normalizeTransportError = (error: unknown): AppError => {
    if (isAppError(error)) {
        return error
    }

    if (error instanceof SyntaxError) {
        return createTransportParseError(error.message, {
            cause: {
                name: error.name,
                message: error.message,
            },
        })
    }

    if (error instanceof TypeError) {
        return createTransportNetworkError(error.message, {
            cause: {
                name: error.name,
                message: error.message,
            },
        })
    }

    if (error instanceof Error) {
        return createTransportNetworkError(error.message, {
            cause: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
        })
    }

    return createTransportNetworkError('unknown transport error', {
        cause: error,
    })
}
