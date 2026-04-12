import {
    INTERNAL_REQUEST_ID,
    createAppError,
    createCommandId,
    createRequestId,
    createRuntimeInstanceId,
    integerAtLeast,
    formatTimestampMs,
    nonEmptyString,
    nowTimestampMs,
    packageVersion,
    positiveFiniteNumber,
    protocolVersion,
} from '../src'

const runtimeId = createRuntimeInstanceId()
const requestId = createRequestId()
const commandId = createCommandId()
const timestamp = nowTimestampMs()

if (!runtimeId || !requestId || !commandId) {
    throw new Error('Runtime ID generation failed')
}

if (!formatTimestampMs(timestamp)) {
    throw new Error('Timestamp formatting failed')
}

const appError = createAppError(
    {
        key: 'kernel.base.contracts.test_error',
        name: 'Test Error',
        defaultTemplate: 'request ${requestId} failed',
        category: 'SYSTEM',
        severity: 'LOW',
    },
    {
        args: {requestId},
        context: {requestId, commandId},
    },
)

if (appError.requestId !== requestId) {
    throw new Error('AppError context binding failed')
}

if (!positiveFiniteNumber(1)) {
    throw new Error('positiveFiniteNumber validation failed')
}

if (positiveFiniteNumber(0)) {
    throw new Error('positiveFiniteNumber should reject zero')
}

if (!integerAtLeast(2)(2)) {
    throw new Error('integerAtLeast validation failed')
}

if (!nonEmptyString('ok')) {
    throw new Error('nonEmptyString validation failed')
}

if (nonEmptyString('   ')) {
    throw new Error('nonEmptyString should reject blank string')
}

console.log('[contracts-test-scenario]', {
    packageName: '@impos2/kernel-base-contracts',
    packageVersion,
    protocolVersion,
    runtimeId,
    requestId,
    commandId,
    internalRequestId: INTERNAL_REQUEST_ID,
    timestamp,
    formattedTimestamp: formatTimestampMs(timestamp),
    errorMessage: appError.message,
})
