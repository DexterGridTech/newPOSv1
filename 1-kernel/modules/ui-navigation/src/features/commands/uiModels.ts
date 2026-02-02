import {defineCommand, ExecutionType, InstanceMode} from "@impos2/kernel-base";
import {UiNavigationCommandNames} from "./commandNames";
import {ScreenPart} from "../../types";

export class AlertCommand extends defineCommand<{
    model: ScreenPart
}>(
    UiNavigationCommandNames.Alert,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {
}
export class OpenModalCommand extends defineCommand<{
    model: ScreenPart
}>(
    UiNavigationCommandNames.OpenModal,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {
}

export class CloseModalCommand extends defineCommand<{
    modelId: string
}>(
    UiNavigationCommandNames.CloseModal,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {
}