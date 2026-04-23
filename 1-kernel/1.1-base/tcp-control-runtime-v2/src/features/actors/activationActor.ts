import {createAppError, nowTimestampMs} from '@impos2/kernel-base-contracts'
import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {selectTcpIdentitySnapshot} from '../../selectors'
import {tcpControlV2ErrorDefinitions} from '../../supports'
import {tcpControlV2CommandDefinitions} from '../commands'
import {tcpControlV2StateActions} from '../slices'
import {requireTcpControlHttpService, type TcpControlServiceRefV2} from './serviceRef'

const defineActor = createModuleActorFactory(moduleName)

export const createTcpActivationActorDefinitionV2 = (
    serviceRef: TcpControlServiceRefV2,
): ActorDefinition => defineActor('TcpActivationActor', [
    onCommand(tcpControlV2CommandDefinitions.activateTerminal, async actorContext => {
        const httpService = requireTcpControlHttpService(serviceRef)
        const identity = selectTcpIdentitySnapshot(actorContext.getState())
        const sandboxId = actorContext.command.payload.sandboxId?.trim()
        const deviceInfo = actorContext.command.payload.deviceInfo ?? identity.deviceInfo
        const deviceFingerprint =
            actorContext.command.payload.deviceFingerprint
                ?? identity.deviceFingerprint
                ?? deviceInfo?.id

        if (!sandboxId || !deviceInfo || !deviceFingerprint) {
            const appError = createAppError(
                tcpControlV2ErrorDefinitions.bootstrapHydrationFailed,
                {
                    args: {error: !sandboxId ? 'sandbox id is missing' : 'device info is missing'},
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

        actorContext.dispatchAction(tcpControlV2StateActions.setDeviceInfo(deviceInfo))
        actorContext.dispatchAction(tcpControlV2StateActions.setDeviceFingerprint(deviceFingerprint))
        actorContext.dispatchAction(tcpControlV2StateActions.setActivationStatus('ACTIVATING'))
        actorContext.dispatchAction(
            tcpControlV2StateActions.setLastActivationRequestId(actorContext.command.requestId),
        )

        try {
            const result = await httpService.activateTerminal({
                sandboxId,
                activationCode: actorContext.command.payload.activationCode,
                deviceFingerprint,
                deviceInfo,
            })
            const now = nowTimestampMs()
            const expiresAt = (now + result.expiresIn * 1_000) as any
            const refreshExpiresAt = result.refreshExpiresIn == null
                ? undefined
                : (now + result.refreshExpiresIn * 1_000) as any

            actorContext.dispatchAction(
                tcpControlV2StateActions.setSandbox({
                    sandboxId,
                    updatedAt: now,
                }),
            )
            actorContext.dispatchAction(
                tcpControlV2StateActions.setActivatedIdentity({
                    terminalId: result.terminalId,
                    activatedAt: now,
                }),
            )
            actorContext.dispatchAction(
                tcpControlV2StateActions.setCredential({
                    accessToken: result.token,
                    refreshToken: result.refreshToken,
                    expiresAt,
                    refreshExpiresAt,
                    updatedAt: now,
                }),
            )
            actorContext.dispatchAction(
                tcpControlV2StateActions.replaceBinding(result.binding ?? {}),
            )
            actorContext.dispatchAction(tcpControlV2StateActions.setLastError(null))
            console.info('[tcp-activation-state-written]', JSON.stringify({
                nodeId: actorContext.localNodeId,
                sandboxId,
                terminalId: result.terminalId,
                bindingKeys: Object.keys(result.binding ?? {}),
                activatedAt: now,
            }))

            await actorContext.dispatchCommand(
                createCommand(
                    tcpControlV2CommandDefinitions.activateTerminalSucceeded,
                    {
                        terminalId: result.terminalId,
                        accessToken: result.token,
                    },
                ),
            )

            return {
                terminalId: result.terminalId,
            }
        } catch (error) {
            actorContext.dispatchAction(tcpControlV2StateActions.setActivationStatus('FAILED'))
            actorContext.dispatchAction(tcpControlV2StateActions.setLastError(error as any))
            throw error
        }
    }),
])
