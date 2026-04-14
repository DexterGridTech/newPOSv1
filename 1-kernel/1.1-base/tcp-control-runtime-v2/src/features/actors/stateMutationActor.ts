import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tcpControlV2CommandDefinitions} from '../commands'
import {tcpControlV2StateActions} from '../slices'

const defineActor = createModuleActorFactory(moduleName)

export const createTcpStateMutationActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TcpStateMutationActor',
    [
        onCommand(tcpControlV2CommandDefinitions.bootstrapTcpControlSucceeded, () => ({})),
        onCommand(tcpControlV2CommandDefinitions.activateTerminalSucceeded, () => ({})),
        onCommand(tcpControlV2CommandDefinitions.credentialRefreshed, () => ({})),
        onCommand(tcpControlV2CommandDefinitions.taskResultReported, () => ({})),
        onCommand(tcpControlV2CommandDefinitions.resetTcpControl, actorContext => {
            actorContext.dispatchAction(tcpControlV2StateActions.clearActivation())
            actorContext.dispatchAction(tcpControlV2StateActions.clearCredential())
            actorContext.dispatchAction(tcpControlV2StateActions.clearBinding())
            actorContext.dispatchAction(tcpControlV2StateActions.resetRuntimeObservation())
            return {}
        }),
    ],
)
