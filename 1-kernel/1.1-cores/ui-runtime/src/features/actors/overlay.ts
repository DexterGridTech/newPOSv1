import {Actor} from "@impos2/kernel-core-base";
import {dispatchWorkspaceAction, getDisplayMode} from "@impos2/kernel-core-interconnection";
import {kernelCoreUiRuntimeCommands} from "../commands";
import {overlayActions} from "../slices/overlay";

export class OverlayActor extends Actor {
    openOverlay = Actor.defineCommandHandler(kernelCoreUiRuntimeCommands.openOverlay,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(overlayActions.openOverlay({
                displayMode: getDisplayMode(),
                overlay: command.payload.overlay
            }), command)
            return {};
        });

    closeOverlay = Actor.defineCommandHandler(kernelCoreUiRuntimeCommands.closeOverlay,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(overlayActions.closeOverlay({
                displayMode: getDisplayMode(),
                overlayId: command.payload.overlayId
            }), command)
            return {};
        });

    clearOverlays = Actor.defineCommandHandler(kernelCoreUiRuntimeCommands.clearOverlays,
        async (command): Promise<Record<string, any>> => {
            dispatchWorkspaceAction(overlayActions.clearOverlays({
                displayMode: getDisplayMode()
            }), command)
            return {};
        });
}
