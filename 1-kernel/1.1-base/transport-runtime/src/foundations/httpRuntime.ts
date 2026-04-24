import {
    createAppError,
    nowTimestampMs,
} from '@next/kernel-base-contracts'
import type {LoggerPort} from '@next/kernel-base-platform-ports'
import type {
    CreateHttpRuntimeInput,
    HttpAttemptMetric,
    HttpCallInput,
    HttpCallMetric,
    HttpExecutionPolicy,
    HttpEndpointDefinition,
    HttpRuntime,
    HttpSuccessResponse,
    HttpTransportRequest,
} from '../types/http'
import {createServerCatalog} from './serverCatalog'
import {buildHttpUrl} from './httpEndpoint'
import {createTransportNetworkError} from './shared'
import {transportRuntimeErrorDefinitions} from '../supports'

/**
 * 设计意图：
 * HTTP runtime 统一处理 transport 层策略，例如地址挑选、失败切换、并发控制和有效地址保持。
 * 它故意不解释业务 envelope 成功/失败语义，避免 transport 和业务完成语义再次混在一起。
 */
class HttpExecutionController {
    private activeCount = 0
    private readonly queue: Array<() => void> = []
    private readonly timestamps: number[] = []

    constructor(private readonly policy: HttpExecutionPolicy = {}) {}

    async run<T>(task: () => Promise<T>): Promise<T> {
        this.enforceRateLimit()
        await this.acquireSlot()
        this.recordRequest()

        try {
            return await task()
        } finally {
            this.releaseSlot()
        }
    }

    private async acquireSlot(): Promise<void> {
        const maxConcurrent = this.policy.maxConcurrent
        if (!maxConcurrent || maxConcurrent <= 0) {
            this.activeCount += 1
            return
        }

        if (this.activeCount < maxConcurrent) {
            this.activeCount += 1
            return
        }

        await new Promise<void>(resolve => {
            this.queue.push(() => {
                this.activeCount += 1
                resolve()
            })
        })
    }

    private releaseSlot(): void {
        this.activeCount = Math.max(0, this.activeCount - 1)
        const next = this.queue.shift()
        next?.()
    }

    private enforceRateLimit(): void {
        const windowMs = this.policy.rateLimitWindowMs
        const maxRequests = this.policy.rateLimitMaxRequests
        if (!windowMs || !maxRequests || maxRequests <= 0) {
            return
        }

        const now = nowTimestampMs()
        while (this.timestamps.length && now - this.timestamps[0] >= windowMs) {
            this.timestamps.shift()
        }

        if (this.timestamps.length >= maxRequests) {
            throw createTransportNetworkError('HTTP request hit rate limit', {
                windowMs,
                maxRequests,
                activeCount: this.activeCount,
            })
        }
    }

    private recordRequest(): void {
        if (!this.policy.rateLimitWindowMs || !this.policy.rateLimitMaxRequests) {
            return
        }

        this.timestamps.push(nowTimestampMs())
    }
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
    const preferredAddressByServer = new Map<string, string>()
    let currentServers = input.servers

    const refreshServers = () => {
        const servers = currentServers ?? input.serverProvider?.() ?? []
        serverCatalog.replaceServers(servers)
    }

    const resolveRoundAddresses = (serverName: string) => {
        const addresses = serverCatalog.resolveAddresses(serverName)
        const preferredAddressName = preferredAddressByServer.get(serverName)
        if (preferredAddressName == null) {
            return [...addresses]
        }
        const preferredAddress = addresses.find(address => address.addressName === preferredAddressName)
        if (preferredAddress == null) {
            preferredAddressByServer.delete(serverName)
            return [...addresses]
        }
        return [
            preferredAddress,
            ...addresses.filter(address => address.addressName !== preferredAddressName),
        ]
    }

    const rememberPreferredAddress = (serverName: string, addressName: string) => {
        preferredAddressByServer.set(serverName, addressName)
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
        return createAppError(transportRuntimeErrorDefinitions.httpRuntimeFailed, {
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
                const addresses = resolveRoundAddresses(endpoint.serverName)
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

                        rememberPreferredAddress(endpoint.serverName, address.addressName)
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
            currentServers = servers
            preferredAddressByServer.clear()
        },
        getServerCatalog() {
            return serverCatalog
        },
    }
}
