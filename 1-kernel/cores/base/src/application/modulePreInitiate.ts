import {INTERNAL, LOG_TAGS, storeEntry} from "../types";
import {ActorSystem, logger} from "../foundations";
import {moduleName} from "../moduleName";
import {ApplicationConfig, AppModule} from "./types";
import {requestStatusActions} from "../features/slices/requestStatus";


export const kernelCoreBaseModulePreInitiate = async (config: ApplicationConfig, allModules: AppModule[]) => {
    registerActorSystem()
    logger.log([moduleName, LOG_TAGS.System, 'PreInitiate'], 'setup completed.')
}

const registerActorSystem = () => {
    logger.log([moduleName, LOG_TAGS.System, 'PreInitiate'], 'register actor system lifecycle listener')
    ActorSystem.getInstance().registerLifecycleListener({
        onCommandStart: (actorName, command) => {
            if (command.requestId && command.requestId != INTERNAL)
                storeEntry.dispatchAction(requestStatusActions.commandStart({
                    actor: actorName,
                    command: command
                }));
        },
        onCommandComplete: (actorName, command, result?: Record<string, any>) => {
            if (command.requestId && command.requestId != INTERNAL)
                storeEntry.dispatchAction(requestStatusActions.commandComplete({
                    actor: actorName,
                    command: command,
                    result: result
                }));
        },
        onCommandError: (actorName, command, appError) => {
            if (command.requestId && command.requestId != INTERNAL)
                storeEntry.dispatchAction(requestStatusActions.commandError({
                    actor: actorName,
                    command: command,
                    appError: appError
                }));
        }
    });
}