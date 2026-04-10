import {
    createAppError,
    nowTimestampMs,
} from '@impos2/kernel-base-contracts'
import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import type {LoggerPort} from '@impos2/kernel-base-platform-ports'
import type {
    CreateHttpRuntimeInput,
    HttpAttemptMetric,
    HttpCallInput,
    HttpCallMetric,
    HttpEndpointDefinition,
    HttpRuntime,
    HttpSuccessResponse,
    HttpTransportRequest,
} from '../types/http'
import {createServerCatalog} from './serverCatalog'
import {buildHttpUrl} from './httpEndpoint'
import {HttpExecutionController} from './httpPolicy'

const HTTP_RUNTIME_FAILED_ERROR: ErrorDefinition = {
    key: 'kernel.base.transport-runtime.http_runtime_failed',
    name: 'HTTP Runtime Failed',
    defaultTemplate: 'HTTP runtime failed for ${endpointName}',
    category: 'NETWORK',
    severity: 'MEDIUM',
    moduleName: 'kernel.base.transport-runtime',
}

const createEndpointLogger = (logger: LoggerPort): LoggerPort => {
    return logger.scope({
        subsystem: 'transport.http',
        component: 'HttpRuntime',
    })
}

export const createHttpRuntime = (
    input: CreateHttpRuntimeInput,
): HttpRuntime => {
    const serverCatalog = createServerCatalog()
    const executionController = new HttpExecutionController(input.executionPolicy)
    const runtimeLogger = createEndpointLogger(input.logger)

    const refreshServers = () => {
        const servers = input.servers ?? input.serverProvider?.() ?? []
        serverCatalog.replaceServers(servers)
    }

    const recordMetric = (
        endpoint: HttpEndpointDefinition<any, any, any, any, any>,
        startedAt: number,
        attempts: readonly HttpAttemptMetric[],
        success: boolean,
    ) => {
        const endedAt = nowTimestampMs()
        const metric: HttpCallMetric = {
            endpointName: endpoint.name,
            serverName: endpoint.serverName,
            method: endpoint.method,
            pathTemplate: endpoint.pathTemplate,
            startedAt,
            endedAt,
            durationMs: endedAt - startedAt,
            success,
            attempts,
        }
        input.metricsRecorder?.recordCall(metric)
    }

    const createFailure = (
        endpoint: HttpEndpointDefinition<any, any, any, any, any>,
        attempts: readonly HttpAttemptMetric[],
        cause: unknown,
        inputValue: HttpCallInput<any, any, any>,
    ) => {
        return createAppError(HTTP_RUNTIME_FAILED_ERROR, {
            args: {endpointName: endpoint.name},
            details: {
                endpointName: endpoint.name,
                serverName: endpoint.serverName,
                attempts,
                cause,
            },
            context: {
                requestId: inputValue.context?.requestId,
                commandId: inputValue.context?.commandId,
                sessionId: inputValue.context?.sessionId,
                nodeId: inputValue.context?.nodeId,
            },
            cause,
        })
    }

    const shouldRetry = (
        error: unknown,
        request: HttpTransportRequest<any, any, any>,
    ): boolean => {
        return input.executionPolicy?.shouldRetry?.(error, request) ?? true
    }

    const call = async <TPath, TQuery, TBody, TResponse, TError = unknown>(
        endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError>,
        rawInput: HttpCallInput<TPath, TQuery, TBody> = {},
    ): Promise<HttpSuccessResponse<TResponse>> => {
        refreshServers()
        const inputValue = rawInput as HttpCallInput<TPath, TQuery, TBody>
        const startedAt = nowTimestampMs()
        const attempts: HttpAttemptMetric[] = []
        const retryRounds = Math.max(0, input.executionPolicy?.retryRounds ?? 0)
        const failoverStrategy = input.executionPolicy?.failoverStrategy ?? 'ordered'
        let lastError: unknown
        let attemptIndex = 0

        return executionController.run(async () => {
            for (let roundIndex = 0; roundIndex <= retryRounds; roundIndex += 1) {
                const addresses = serverCatalog.resolveAddresses(endpoint.serverName)
                const roundAddresses = failoverStrategy === 'single-address' ? addresses.slice(0, 1) : addresses

                for (const address of roundAddresses) {
                    attemptIndex += 1
                    const attemptStartedAt = nowTimestampMs()
                    const request: HttpTransportRequest<TPath, TQuery, TBody> = {
                        endpoint,
                        input: inputValue,
                        url: buildHttpUrl(
                            address.baseUrl,
                            endpoint.pathTemplate,
                            inputValue.path as Record<string, unknown> | undefined,
                            inputValue.query as Record<string, unknown> | undefined,
                        ),
                        timeoutMs: endpoint.timeoutMs ?? address.timeoutMs,
                        selectedAddress: address,
                        attemptIndex,
                        roundIndex,
                    }

                    runtimeLogger.info({
                        category: 'transport.http',
                        event: 'request-started',
                        message: `HTTP request started: ${endpoint.name}`,
                        context: inputValue.context,
                        data: {
                            endpointName: endpoint.name,
                            serverName: endpoint.serverName,
                            addressName: address.addressName,
                            method: endpoint.method,
                            roundIndex,
                            attemptIndex,
                        },
                    })

                    try {
                        const response = await input.transport.execute<TPath, TQuery, TBody, TResponse>(request)
                        const endedAt = nowTimestampMs()

                        attempts.push({
                            attemptIndex,
                            roundIndex,
                            addressName: address.addressName,
                            baseUrl: address.baseUrl,
                            startedAt: attemptStartedAt,
                            endedAt,
                            durationMs: endedAt - attemptStartedAt,
                            success: true,
                        })

                        runtimeLogger.info({
                            category: 'transport.http',
                            event: 'request-completed',
                            message: `HTTP request completed: ${endpoint.name}`,
                            context: inputValue.context,
                            data: {
                                endpointName: endpoint.name,
                                serverName: endpoint.serverName,
                                addressName: address.addressName,
                                status: response.status,
                            },
                        })

                        recordMetric(endpoint, startedAt, attempts, true)
                        return response
                    } catch (error) {
                        lastError = error
                        const endedAt = nowTimestampMs()
                        attempts.push({
                            attemptIndex,
                            roundIndex,
                            addressName: address.addressName,
                            baseUrl: address.baseUrl,
                            startedAt: attemptStartedAt,
                            endedAt,
                            durationMs: endedAt - attemptStartedAt,
                            success: false,
                            errorCode: typeof error === 'object' && error && 'code' in error ? String((error as {code?: unknown}).code) : undefined,
                            errorMessage: error instanceof Error ? error.message : String(error),
                        })

                        runtimeLogger.error({
                            category: 'transport.http',
                            event: 'request-failed',
                            message: `HTTP request failed: ${endpoint.name}`,
                            context: inputValue.context,
                            data: {
                                endpointName: endpoint.name,
                                serverName: endpoint.serverName,
                                addressName: address.addressName,
                                roundIndex,
                                attemptIndex,
                            },
                            error: {
                                name: error instanceof Error ? error.name : undefined,
                                message: error instanceof Error ? error.message : String(error),
                                stack: error instanceof Error ? error.stack : undefined,
                            },
                        })

                        if (!shouldRetry(error, request)) {
                            recordMetric(endpoint, startedAt, attempts, false)
                            throw createFailure(endpoint, attempts, error, inputValue)
                        }
                    }
                }
            }

            recordMetric(endpoint, startedAt, attempts, false)
            throw createFailure(endpoint, attempts, lastError, inputValue)
        })
    }

    refreshServers()

    return {
        call,
        replaceServers(servers) {
            serverCatalog.replaceServers(servers)
        },
        getServerCatalog() {
            return serverCatalog
        },
    }
}
