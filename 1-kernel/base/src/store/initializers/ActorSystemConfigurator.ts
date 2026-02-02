import { EnhancedStore } from "@reduxjs/toolkit";
import { RootState, requestStatusActions, instanceInfoSlice } from "../../features";
import { ActorSystem, dispatchSimpleAction } from "../../core";
import { INTERNAL } from "../../types";

/**
 * ActorSystem 配置器
 * 职责: 负责配置 ActorSystem 的状态选择器和生命周期监听器
 */
export class ActorSystemConfigurator {
    configureStateSelectors(store: EnhancedStore<RootState>): void {
        ActorSystem.getInstance().setStateSelectors({
            slaveNameSelector: () => {
                const state = store.getState();
                return state[instanceInfoSlice.name].slaveConnectionInfo.slaveName ?? null;
            },
            displayModeSelector: () => {
                const state = store.getState();
                return state[instanceInfoSlice.name].instance.displayMode;
            }
        });
    }

    configureLifecycleListeners(): void {
        ActorSystem.getInstance().registerLifecycleListener({
            onCommandStart: (actorName, command) => {
                dispatchSimpleAction(requestStatusActions.commandStart({
                    actor: actorName,
                    command: command
                }));
            },
            onCommandComplete: (actorName, command) => {
                dispatchSimpleAction(requestStatusActions.commandComplete({
                    actor: actorName,
                    command: command
                }));
            },
            onCommandError: (actorName, command, appError) => {
                dispatchSimpleAction(requestStatusActions.commandError({
                    actor: actorName,
                    command: command,
                    appError: appError
                }));
            }
        });
    }
}
