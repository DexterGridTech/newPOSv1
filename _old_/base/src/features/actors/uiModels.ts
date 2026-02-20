import {CommandHandler, dispatchSimpleAction, IActor, storeEntry} from "../../core";
import {AlertCommand, CloseModalCommand, OpenModalCommand} from "../commands/shared";
import {uiModelsActions} from "../slices/uiModals";


class UiModelActor extends IActor {
    @CommandHandler(OpenModalCommand)
    private async handleOpenModal(command: OpenModalCommand) {
        const instanceMode = storeEntry.getInstance().instanceMode
        dispatchSimpleAction(uiModelsActions.openModal({
            instanceMode: instanceMode,
            model: command.payload.model
        }))
    }

    @CommandHandler(CloseModalCommand)
    private async handleCloseModal(command: CloseModalCommand) {
        const instanceMode = storeEntry.getInstance().instanceMode
        dispatchSimpleAction(uiModelsActions.closeModal({
            instanceMode: instanceMode,
            modelId: command.payload.modelId
        }))
    }

    @CommandHandler(AlertCommand)
    private async handleAlert(command: AlertCommand) {
        const instanceMode = storeEntry.getInstance().instanceMode
        dispatchSimpleAction(uiModelsActions.openModal({
            instanceMode: instanceMode,
            model: command.payload.model
        }))
    }
}


export const uiModelActor = new UiModelActor();
