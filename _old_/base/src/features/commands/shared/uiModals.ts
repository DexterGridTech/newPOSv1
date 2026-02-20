import {defineCommand, ExecutionType} from "../../../core/command";
import {BaseModuleCommandNames} from "../commandNames";
import {ScreenPart} from "../../../types/core/screen";

export class AlertCommand extends defineCommand<{
    model: ScreenPart
}>(
    BaseModuleCommandNames.Alert,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {
}

export class OpenModalCommand extends defineCommand<{
    model: ScreenPart
}>(
    BaseModuleCommandNames.OpenModal,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {
}

export class CloseModalCommand extends defineCommand<{
    modelId: string
}>(
    BaseModuleCommandNames.CloseModal,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {
}
