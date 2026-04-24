import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {createAppError} from '@next/kernel-base-contracts'
import {selectTcpAccessToken, selectTcpSandboxId, selectTcpTerminalId} from '@next/kernel-base-tcp-control-runtime-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2ErrorDefinitions} from '../../supports'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {tdpSyncV2DomainActions} from '../slices'

const defineActor = createModuleActorFactory(moduleName)

export const createTdpBootstrapActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpBootstrapActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.bootstrapTdpSync, async context => {
            const state = context.getState()
            const terminalId = selectTcpTerminalId(state)
            const accessToken = selectTcpAccessToken(state)
            const sandboxId = selectTcpSandboxId(state)
            if ((terminalId || accessToken) && !sandboxId) {
                throw createAppError(tdpSyncV2ErrorDefinitions.credentialMissing, {
                    args: {error: 'sandboxId is missing'},
                    context: {
                        commandName: tdpSyncV2CommandDefinitions.bootstrapTdpSync.commandName,
                        nodeId: context.localNodeId,
                    },
                })
            }
            context.dispatchAction(tdpSyncV2DomainActions.bootstrapResetRuntime())

            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.bootstrapTdpSyncSucceeded, {}))
            return {
                lastCursor: (context.getState() as any)?.[`${moduleName}.sync`]?.lastCursor,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.bootstrapTdpSyncSucceeded, () => {
            return {}
        }),
    ],
)
