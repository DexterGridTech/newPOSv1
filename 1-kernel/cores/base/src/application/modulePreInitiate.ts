import {INTERNAL, LOG_TAGS, storeEntry} from "../types";
import {ActorSystem, logger} from "../foundations";
import {moduleName} from "../moduleName";
import {kernelCoreBaseSlice} from "../features/slices";
import {ApplicationConfig} from "./types";


export const kernelCoreBaseModulePreInitiate = async (config: ApplicationConfig) => {
    ActorSystem.getInstance().registerLifecycleListener({
        onCommandStart: (actorName, command) => {
            if (command.requestId && command.requestId != INTERNAL)
                storeEntry.dispatchAction(kernelCoreBaseSlice.requestStatus.actions.commandStart({
                    actor: actorName,
                    command: command
                }));
        },
        onCommandComplete: (actorName, command, result?: Record<string, any>) => {
            if (command.requestId && command.requestId != INTERNAL)
                storeEntry.dispatchAction(kernelCoreBaseSlice.requestStatus.actions.commandComplete({
                    actor: actorName,
                    command: command,
                    result: result
                }));
        },
        onCommandError: (actorName, command, appError) => {
            if (command.requestId && command.requestId != INTERNAL)
                storeEntry.dispatchAction(kernelCoreBaseSlice.requestStatus.actions.commandError({
                    actor: actorName,
                    command: command,
                    appError: appError
                }));
        }
    });
    logger.log([moduleName, LOG_TAGS.System, 'moduleSetup'], 'setup completed.')
}