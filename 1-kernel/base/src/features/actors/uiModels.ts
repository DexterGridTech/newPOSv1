import {CommandHandler, dispatchSimpleAction, selectInstance, IActor} from "../../core";
import {AlertCommand, CloseModalCommand, OpenModalCommand} from "../commands/shared";
import {uiModelsActions} from "../slices/uiModals";


class UiModelActor extends IActor {
    @CommandHandler(OpenModalCommand)
    private async handleOpenModal(command: OpenModalCommand) {
        const instanceMode = selectInstance().instanceMode
        dispatchSimpleAction(uiModelsActions.openModal({
            instanceMode: instanceMode,
            model: command.payload.model
        }))
    }

    @CommandHandler(CloseModalCommand)
    private async handleCloseModal(command: CloseModalCommand) {
        const instanceMode = selectInstance().instanceMode
        dispatchSimpleAction(uiModelsActions.closeModal({
            instanceMode: instanceMode,
            modelId: command.payload.modelId
        }))
    }

    @CommandHandler(AlertCommand)
    private async handleAlert(command: AlertCommand) {
        const instanceMode = selectInstance().instanceMode
        dispatchSimpleAction(uiModelsActions.openModal({
            instanceMode: instanceMode,
            model: command.payload.model
        }))
    }
}


export const uiModelActor = new UiModelActor();
