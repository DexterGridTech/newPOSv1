import {Actor, AppError} from "@impos2/kernel-core-base";
import {dispatchWorkspaceAction} from "@impos2/kernel-core-interconnection";
import {kernelCoreUiRuntimeCommands} from "../commands";
import {screenActions} from "../slices/screen";
import {kernelCoreUiRuntimeErrorMessages} from "../../supports";

export class ScreenActor extends Actor {
    showScreen = Actor.defineCommandHandler(kernelCoreUiRuntimeCommands.showScreen,
        async (command): Promise<Record<string, any>> => {
            const {target, source} = command.payload
            if (!target.containerKey) {
                throw new AppError(kernelCoreUiRuntimeErrorMessages.uiRuntimeError, {reasons: ['containerKey is required']})
            }
            dispatchWorkspaceAction(screenActions.showScreen({target, source}), command)
            return {};
        });

    replaceScreen = Actor.defineCommandHandler(kernelCoreUiRuntimeCommands.replaceScreen,
        async (command): Promise<Record<string, any>> => {
            const {target, source} = command.payload
            if (!target.containerKey) {
                throw new AppError(kernelCoreUiRuntimeErrorMessages.uiRuntimeError, {reasons: ['containerKey is required']})
            }
            dispatchWorkspaceAction(screenActions.replaceScreen({target, source}), command)
            return {};
        });

    resetScreen = Actor.defineCommandHandler(kernelCoreUiRuntimeCommands.resetScreen,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(screenActions.resetScreen({containerKey: command.payload.containerKey}), command)
            return {};
        });
}
