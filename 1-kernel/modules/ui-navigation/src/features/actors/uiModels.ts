import {CommandHandler, dispatchSimpleAction, getInstance, IActor, logger} from "@impos2/kernel-base";
import {AlertCommand, CloseModalCommand, OpenModalCommand} from "../commands";
import {uiModelsActions} from "../slices";


class UiModelActor extends IActor {
    @CommandHandler(OpenModalCommand)
    private async handleOpenModal(command: OpenModalCommand) {
        const instanceMode = getInstance().instanceMode
        dispatchSimpleAction(uiModelsActions.openModal({
            instanceMode: instanceMode,
            model: command.payload.model
        }))
    }

    @CommandHandler(CloseModalCommand)
    private async handleCloseModal(command: CloseModalCommand) {
        const instanceMode = getInstance().instanceMode
        dispatchSimpleAction(uiModelsActions.closeModal({
            instanceMode: instanceMode,
            modelId: command.payload.modelId
        }))
    }

    @CommandHandler(AlertCommand)
    private async handleAlert(command: AlertCommand) {
        const instanceMode = getInstance().instanceMode
        dispatchSimpleAction(uiModelsActions.openModal({
            instanceMode: instanceMode,
            model: command.payload.model
        }))
    }
}


export const uiModelActor = new UiModelActor();
