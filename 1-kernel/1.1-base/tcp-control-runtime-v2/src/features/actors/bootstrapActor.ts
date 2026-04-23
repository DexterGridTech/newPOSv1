import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tcpControlV2CommandDefinitions} from '../commands'
import {tcpControlV2StateActions} from '../slices'
import {selectTcpIdentitySnapshot} from '../../selectors'
import type {TcpControlServiceRefV2} from './serviceRef'

const defineActor = createModuleActorFactory(moduleName)

export const createTcpBootstrapActorDefinitionV2 = (
    _serviceRef: TcpControlServiceRefV2,
): ActorDefinition => defineActor('TcpBootstrapActor', [
    onCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, async actorContext => {
            const identity = selectTcpIdentitySnapshot(actorContext.getState())
            const nextDeviceInfo = actorContext.command.payload.deviceInfo ?? identity.deviceInfo
            const nextDeviceFingerprint =
                actorContext.command.payload.deviceFingerprint
                ?? identity.deviceFingerprint
                ?? nextDeviceInfo?.id

            if (nextDeviceInfo) {
                actorContext.dispatchAction(
                    tcpControlV2StateActions.setDeviceInfo(nextDeviceInfo),
                )
            }
            if (nextDeviceFingerprint) {
                actorContext.dispatchAction(
                    tcpControlV2StateActions.setDeviceFingerprint(nextDeviceFingerprint),
                )
            }
            console.info('[tcp-bootstrap-state-written]', JSON.stringify({
                nodeId: actorContext.localNodeId,
                runtimeId: actorContext.runtimeId,
                displayIndex: actorContext.displayContext.displayIndex ?? null,
                requestId: actorContext.command.requestId,
                commandId: actorContext.command.commandId,
                nextDeviceFingerprint: nextDeviceFingerprint ?? null,
                nextDeviceInfo: nextDeviceInfo ?? null,
                previousIdentity: identity,
            }))
            actorContext.dispatchAction(tcpControlV2StateActions.setBootstrapped(true))
            actorContext.dispatchAction(tcpControlV2StateActions.setLastError(null))

            await actorContext.dispatchCommand(
                createCommand(
                    tcpControlV2CommandDefinitions.bootstrapTcpControlSucceeded,
                    {},
                ),
            )

            return {
                deviceFingerprint: nextDeviceFingerprint,
            }
        }),
])
