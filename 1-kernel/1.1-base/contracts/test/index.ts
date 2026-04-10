import {
    INTERNAL_REQUEST_ID,
    createAppError,
    createCommandId,
    createRequestId,
    createRuntimeInstanceId,
    formatTimestampMs,
    nowTimestampMs,
    packageVersion,
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
