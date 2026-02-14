import {INTERNAL, storeEntry} from "../types";
import {ActorSystem} from "../foundations";
import {ApplicationConfig, AppModule} from "./types";
import {requestStatusActions} from "../features/slices/requestStatus";
import {kernelCoreBaseParameters} from "../supports";


export const kernelCoreBaseModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    registerActorSystem()
}

const registerActorSystem = () => {
    ActorSystem.getInstance().registerLifecycleListener({
        onCommandStart: (actor, command) => {
            if (command.requestId && command.requestId != INTERNAL)
                storeEntry.dispatchAction(requestStatusActions.commandStart({
                    actor: actor.printName(),
                    command: command,
                    requestCleanOutTime: kernelCoreBaseParameters.requestCleanOutTime.value
                }));
        },
        onCommandComplete: (actor, command, result?: Record<string, any>) => {
            if (command.requestId && command.requestId != INTERNAL)
                storeEntry.dispatchAction(requestStatusActions.commandComplete({
                    actor: actor.printName(),
                    command: command,
                    result: result
                }));
        },
        onCommandError: (actor, command, appError) => {
            if (command.requestId && command.requestId != INTERNAL)
                storeEntry.dispatchAction(requestStatusActions.commandError({
                    actor: actor.printName(),
                    command: command,
                    appError: appError
                }));
        }
    });
}