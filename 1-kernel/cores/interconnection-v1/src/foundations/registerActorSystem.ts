import {ActorSystem, INTERNAL, kernelCoreBaseParameters} from "@impos2/kernel-core-base-v1";
import {dispatchInstanceModeAction} from "./instanceMode";
import {requestStatusActions} from "../features/slices/requestStatus";

export const registerActorSystem = () => {

    ActorSystem.getInstance().registerLifecycleListener({
        onCommandStart: (actor, command) => {
            if (command.requestId && command.requestId !== INTERNAL)
                dispatchInstanceModeAction(requestStatusActions.commandStart({
                    actor: actor.printName(),
                    command: command,
                    requestCleanOutTime: kernelCoreBaseParameters.requestCleanOutTime.value
                }), command)
        },
        onCommandComplete: (actor, command, result?: Record<string, any>) => {
            if (command.requestId && command.requestId !== INTERNAL)
                dispatchInstanceModeAction(requestStatusActions.commandComplete({
                    actor: actor.printName(),
                    command: command,
                    result: result
                }), command)
        },
        onCommandError: (actor, command, appError) => {
            if (command.requestId && command.requestId !== INTERNAL)
                dispatchInstanceModeAction(requestStatusActions.commandError({
                    actor: actor.printName(),
                    command: command,
                    appError: appError
                }), command)
        }
    });
}