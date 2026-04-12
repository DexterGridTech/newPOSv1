import {createAppError, nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import {
    createHttpRuntime,
    type HttpTransport,
} from '@impos2/kernel-base-transport-runtime'
import {moduleName} from '../moduleName'
import {packageVersion} from '../generated/packageVersion'
import {tcpControlCommandNames} from '../features/commands'
import {tcpControlStateActions, tcpControlStateSlices} from '../features/slices'
import {
    selectTcpCredentialSnapshot,
    selectTcpIdentitySnapshot,
    selectTcpTerminalId,
} from '../selectors'
import {
    tcpControlErrorDefinitionList,
    tcpControlErrorDefinitions,
    tcpControlParameterDefinitionList,
} from '../supports'
import {createTcpControlHttpService} from './httpService'
import type {
    CreateTcpControlRuntimeModuleInput,
    TcpDeviceInfo,
    TcpTaskResultReportRuntimePayload,
} from '../types'

const createFetchHttpTransport = (): HttpTransport => {
    return {
        async execute(request) {
            const response = await fetch(request.url, {
                method: request.endpoint.method,
                headers: {
                    'content-type': 'application/json',
                    ...(request.input.headers ?? {}),
                },
                body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
            })

            return {
                data: await response.json(),
                status: response.status,
                statusText: response.statusText,
                headers: (() => {
                    const headers: Record<string, string> = {}
                    response.headers.forEach((value, key) => {
                        headers[key] = value
                    })
                    return headers
                })(),
            }
        },
    }
}

const createDefaultHttpRuntime = (
    context: Parameters<NonNullable<KernelRuntimeModule['install']>>[0],
) => {
    return createHttpRuntime({
        logger: context.platformPorts.logger.scope({
            moduleName,
            subsystem: 'transport.http',
            component: 'TcpControlHttpRuntime',
        }),
        transport: createFetchHttpTransport(),
        servers: [
            {
                serverName: 'mock-terminal-platform',
                addresses: [
                    {
                        addressName: 'local-default',
                        baseUrl: 'http://127.0.0.1:5810',
                    },
                ],
            },
        ],
    })
}

export const createTcpControlRuntimeModule = (
    input: CreateTcpControlRuntimeModuleInput = {},
): KernelRuntimeModule => {
    return {
        moduleName,
        packageVersion,
        stateSlices: tcpControlStateSlices,
        commands: [
            {name: tcpControlCommandNames.bootstrapTcpControl, visibility: 'internal'},
            {name: tcpControlCommandNames.bootstrapTcpControlSucceeded, visibility: 'internal'},
            {name: tcpControlCommandNames.activateTerminal, visibility: 'public'},
            {name: tcpControlCommandNames.activateTerminalSucceeded, visibility: 'internal'},
            {name: tcpControlCommandNames.refreshCredential, visibility: 'public'},
            {name: tcpControlCommandNames.credentialRefreshed, visibility: 'internal'},
            {name: tcpControlCommandNames.reportTaskResult, visibility: 'public'},
            {name: tcpControlCommandNames.taskResultReported, visibility: 'internal'},
            {name: tcpControlCommandNames.resetTcpControl, visibility: 'public'},
        ],
        errorDefinitions: tcpControlErrorDefinitionList,
        parameterDefinitions: tcpControlParameterDefinitionList,
        install(context) {
            const httpService = createTcpControlHttpService(
                input.assembly?.createHttpRuntime(context) ?? createDefaultHttpRuntime(context),
            )

            context.platformPorts.logger.info({
                category: 'runtime.load',
                event: 'tcp-control-runtime-install',
                message: 'install tcp control runtime contents',
                data: {
                    moduleName,
                    stateSlices: tcpControlStateSlices.map(slice => slice.name),
                    commandNames: Object.values(tcpControlCommandNames),
                },
            })

            context.registerHandler(
                tcpControlCommandNames.bootstrapTcpControl,
                async handlerContext => {
                    const payload = (handlerContext.command.payload ?? {}) as {
                        deviceInfo?: TcpDeviceInfo
                        deviceFingerprint?: string
                    }
                    const identity = selectTcpIdentitySnapshot(handlerContext.getState())
                    const nextDeviceInfo = payload.deviceInfo ?? identity.deviceInfo
                    const nextDeviceFingerprint =
                        payload.deviceFingerprint
                        ?? identity.deviceFingerprint
                        ?? nextDeviceInfo?.id

                    if (nextDeviceInfo) {
                        context.dispatchAction(
                            tcpControlStateActions.setDeviceInfo(nextDeviceInfo),
                        )
                    }
                    if (nextDeviceFingerprint) {
                        context.dispatchAction(
                            tcpControlStateActions.setDeviceFingerprint(nextDeviceFingerprint),
                        )
                    }
                    context.dispatchAction(tcpControlStateActions.setBootstrapped(true))
                    context.dispatchAction(tcpControlStateActions.setLastError(null))

                    await handlerContext.dispatchChild({
                        commandName: tcpControlCommandNames.bootstrapTcpControlSucceeded,
                        payload: {},
                        internal: true,
                    })

                    return {
                        deviceFingerprint: nextDeviceFingerprint,
                    }
                },
            )

            context.registerHandler(
                tcpControlCommandNames.bootstrapTcpControlSucceeded,
                async () => ({}),
            )

            context.registerHandler(
                tcpControlCommandNames.activateTerminal,
                async handlerContext => {
                    const payload = (handlerContext.command.payload ?? {}) as {
                        activationCode: string
                        deviceInfo?: TcpDeviceInfo
                        deviceFingerprint?: string
                    }
                    const identity = selectTcpIdentitySnapshot(handlerContext.getState())
                    const deviceInfo = payload.deviceInfo ?? identity.deviceInfo
                    const deviceFingerprint =
                        payload.deviceFingerprint
                        ?? identity.deviceFingerprint
                        ?? deviceInfo?.id

                    if (!deviceInfo || !deviceFingerprint) {
                        const appError = createAppError(
                            tcpControlErrorDefinitions.bootstrapHydrationFailed,
                            {
                                args: {error: 'device info is missing'},
                                context: {
                                    commandName: handlerContext.command.commandName,
                                    commandId: handlerContext.command.commandId,
                                    requestId: handlerContext.command.requestId,
                                    sessionId: handlerContext.command.sessionId,
                                    nodeId: context.localNodeId as any,
                                },
                            },
                        )
                        context.dispatchAction(tcpControlStateActions.setLastError(appError))
                        throw appError
                    }

                    context.dispatchAction(tcpControlStateActions.setDeviceInfo(deviceInfo))
                    context.dispatchAction(tcpControlStateActions.setDeviceFingerprint(deviceFingerprint))
                    context.dispatchAction(tcpControlStateActions.setActivationStatus('ACTIVATING'))
                    context.dispatchAction(
                        tcpControlStateActions.setLastActivationRequestId(handlerContext.command.requestId),
                    )

                    try {
                        const result = await httpService.activateTerminal({
                            activationCode: payload.activationCode,
                            deviceFingerprint,
                            deviceInfo,
                        })
                        const now = nowTimestampMs()
                        const expiresAt = (now + result.expiresIn * 1_000) as any
                        const refreshExpiresAt = result.refreshExpiresIn == null
                            ? undefined
                            : (now + result.refreshExpiresIn * 1_000) as any

                        context.dispatchAction(
                            tcpControlStateActions.setActivatedIdentity({
                                terminalId: result.terminalId,
                                activatedAt: now,
                            }),
                        )
                        context.dispatchAction(
                            tcpControlStateActions.setCredential({
                                accessToken: result.token,
                                refreshToken: result.refreshToken,
                                expiresAt,
                                refreshExpiresAt,
                                updatedAt: now,
                            }),
                        )
                        context.dispatchAction(
                            tcpControlStateActions.replaceBinding(result.binding ?? {}),
                        )
                        context.dispatchAction(tcpControlStateActions.setLastError(null))

                        await handlerContext.dispatchChild({
                            commandName: tcpControlCommandNames.activateTerminalSucceeded,
                            payload: {
                                terminalId: result.terminalId,
                                accessToken: result.token,
                            },
                            internal: true,
                        })

                        return {
                            terminalId: result.terminalId,
                        }
                    } catch (error) {
                        context.dispatchAction(tcpControlStateActions.setActivationStatus('FAILED'))
                        context.dispatchAction(tcpControlStateActions.setLastError(error as any))
                        throw error
                    }
                },
            )

            context.registerHandler(
                tcpControlCommandNames.activateTerminalSucceeded,
                async () => ({}),
            )

            context.registerHandler(
                tcpControlCommandNames.refreshCredential,
                async handlerContext => {
                    const credential = selectTcpCredentialSnapshot(handlerContext.getState())
                    if (!credential.refreshToken) {
                        const appError = createAppError(
                            tcpControlErrorDefinitions.credentialMissing,
                            {
                                context: {
                                    commandName: handlerContext.command.commandName,
                                    commandId: handlerContext.command.commandId,
                                    requestId: handlerContext.command.requestId,
                                    sessionId: handlerContext.command.sessionId,
                                    nodeId: context.localNodeId as any,
                                },
                            },
                        )
                        context.dispatchAction(tcpControlStateActions.setLastError(appError))
                        throw appError
                    }

                    context.dispatchAction(tcpControlStateActions.setCredentialStatus('REFRESHING'))
                    context.dispatchAction(
                        tcpControlStateActions.setLastRefreshRequestId(handlerContext.command.requestId),
                    )

                    try {
                        const result = await httpService.refreshCredential({
                            refreshToken: credential.refreshToken,
                        })
                        const now = nowTimestampMs()
                        const expiresAt = (now + result.expiresIn * 1_000) as any

                        context.dispatchAction(
                            tcpControlStateActions.setCredential({
                                accessToken: result.token,
                                refreshToken: credential.refreshToken,
                                expiresAt,
                                refreshExpiresAt: credential.refreshExpiresAt,
                                updatedAt: now,
                            }),
                        )
                        context.dispatchAction(tcpControlStateActions.setLastError(null))

                        await handlerContext.dispatchChild({
                            commandName: tcpControlCommandNames.credentialRefreshed,
                            payload: {
                                accessToken: result.token,
                                expiresAt,
                            },
                            internal: true,
                        })

                        return {
                            accessToken: result.token,
                        }
                    } catch (error) {
                        context.dispatchAction(tcpControlStateActions.setLastError(error as any))
                        throw error
                    }
                },
            )

            context.registerHandler(
                tcpControlCommandNames.credentialRefreshed,
                async () => ({}),
            )

            context.registerHandler(
                tcpControlCommandNames.reportTaskResult,
                async handlerContext => {
                    const payload = (handlerContext.command.payload ?? {}) as TcpTaskResultReportRuntimePayload
                    const terminalId = payload.terminalId ?? selectTcpTerminalId(handlerContext.getState())
                    if (!terminalId) {
                        const appError = createAppError(
                            tcpControlErrorDefinitions.bootstrapHydrationFailed,
                            {
                                args: {error: 'terminalId is missing'},
                                context: {
                                    commandName: handlerContext.command.commandName,
                                    commandId: handlerContext.command.commandId,
                                    requestId: handlerContext.command.requestId,
                                    sessionId: handlerContext.command.sessionId,
                                    nodeId: context.localNodeId as any,
                                },
                            },
                        )
                        context.dispatchAction(tcpControlStateActions.setLastError(appError))
                        throw appError
                    }

                    context.dispatchAction(
                        tcpControlStateActions.setLastTaskReportRequestId(handlerContext.command.requestId),
                    )

                    try {
                        const result = await httpService.reportTaskResult(
                            terminalId,
                            payload.instanceId,
                            {
                                status: payload.status,
                                result: payload.result,
                                error: payload.error,
                            },
                        )
                        context.dispatchAction(tcpControlStateActions.setLastError(null))

                        await handlerContext.dispatchChild({
                            commandName: tcpControlCommandNames.taskResultReported,
                            payload: {
                                instanceId: result.instanceId,
                                status: result.status,
                            },
                            internal: true,
                        })

                        return {
                            instanceId: result.instanceId,
                            status: result.status,
                            finishedAt: result.finishedAt,
                        }
                    } catch (error) {
                        context.dispatchAction(tcpControlStateActions.setLastError(error as any))
                        throw error
                    }
                },
            )

            context.registerHandler(
                tcpControlCommandNames.taskResultReported,
                async () => ({}),
            )

            context.registerHandler(
                tcpControlCommandNames.resetTcpControl,
                async () => {
                    context.dispatchAction(tcpControlStateActions.clearActivation())
                    context.dispatchAction(tcpControlStateActions.clearCredential())
                    context.dispatchAction(tcpControlStateActions.clearBinding())
                    context.dispatchAction(tcpControlStateActions.resetRuntimeObservation())
                    return {}
                },
            )
        },
    }
}
