import {requestStatusActions} from "../../features";
import {ActorSystem, dispatchSimpleAction} from "../../core";
import {INTERNAL} from "../../types";

/**
 * ActorSystem 配置器
 * 职责: 负责配置 ActorSystem 的生命周期监听器
 */
export class ActorSystemConfigurator {
    configureLifecycleListeners(): void {
        ActorSystem.getInstance().registerLifecycleListener({
            onCommandStart: (actorName, command) => {
                if (command.requestId && command.requestId != INTERNAL)
                    dispatchSimpleAction(requestStatusActions.commandStart({
                        actor: actorName,
                        command: command
                    }));
            },
            onCommandComplete: (actorName, command, result?: Record<string, any>) => {
                if (command.requestId && command.requestId != INTERNAL)
                    dispatchSimpleAction(requestStatusActions.commandComplete({
                        actor: actorName,
                        command: command,
                        result: result
                    }));
            },
            onCommandError: (actorName, command, appError) => {
                if (command.requestId && command.requestId != INTERNAL)
                    dispatchSimpleAction(requestStatusActions.commandError({
                        actor: actorName,
                        command: command,
                        appError: appError
                    }));
            }
        });
    }
}
