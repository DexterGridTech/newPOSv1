import {createAppError, nowTimestampMs} from '@next/kernel-base-contracts'
import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {selectTcpCredentialSnapshot, selectTcpSandboxId} from '../../selectors'
import {tcpControlV2ErrorDefinitions} from '../../supports'
import {tcpControlV2CommandDefinitions} from '../commands'
import {tcpControlV2StateActions} from '../slices'
import {requireTcpControlHttpService, type TcpControlServiceRefV2} from './serviceRef'

const defineActor = createModuleActorFactory(moduleName)

export const createTcpCredentialActorDefinitionV2 = (
    serviceRef: TcpControlServiceRefV2,
): ActorDefinition => defineActor('TcpCredentialActor', [
    onCommand(tcpControlV2CommandDefinitions.refreshCredential, async actorContext => {
            const httpService = requireTcpControlHttpService(serviceRef)
            const credential = selectTcpCredentialSnapshot(actorContext.getState())
            const sandboxId = selectTcpSandboxId(actorContext.getState())
            if (!sandboxId) {
                const appError = createAppError(
                    tcpControlV2ErrorDefinitions.credentialMissing,
                    {
                        args: {error: 'sandboxId is missing'},
                        context: {
                            commandName: actorContext.command.commandName,
                            commandId: actorContext.command.commandId,
                            requestId: actorContext.command.requestId,
                            nodeId: actorContext.localNodeId,
                        },
                    },
                )
                actorContext.dispatchAction(tcpControlV2StateActions.setLastError(appError))
                throw appError
            }
            if (!credential.refreshToken) {
                const appError = createAppError(
                    tcpControlV2ErrorDefinitions.credentialMissing,
                    {
                        context: {
                            commandName: actorContext.command.commandName,
                            commandId: actorContext.command.commandId,
                            requestId: actorContext.command.requestId,
                            nodeId: actorContext.localNodeId,
                        },
                    },
                )
                actorContext.dispatchAction(tcpControlV2StateActions.setLastError(appError))
                throw appError
            }

            actorContext.dispatchAction(tcpControlV2StateActions.setCredentialStatus('REFRESHING'))
            actorContext.dispatchAction(
                tcpControlV2StateActions.setLastRefreshRequestId(actorContext.command.requestId),
            )

            try {
                const result = await httpService.refreshCredential({
                    sandboxId,
                    refreshToken: credential.refreshToken,
                })
                const now = nowTimestampMs()
                const expiresAt = (now + result.expiresIn * 1_000) as any

                actorContext.dispatchAction(
                    tcpControlV2StateActions.setCredential({
                        accessToken: result.token,
                        refreshToken: credential.refreshToken,
                        expiresAt,
                        refreshExpiresAt: credential.refreshExpiresAt,
                        updatedAt: now,
                    }),
                )
                actorContext.dispatchAction(tcpControlV2StateActions.setLastError(null))

                await actorContext.dispatchCommand(
                    createCommand(
                        tcpControlV2CommandDefinitions.credentialRefreshed,
                        {
                            accessToken: result.token,
                            expiresAt,
                        },
                    ),
                )

                return {
                    accessToken: result.token,
                }
            } catch (error) {
                actorContext.dispatchAction(tcpControlV2StateActions.setCredentialStatus('EMPTY'))
                actorContext.dispatchAction(tcpControlV2StateActions.setLastError(error as any))
                throw error
            }
        }),
])
