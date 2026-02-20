import {defineCommand, ExecutionType} from "_old_/base";
import {UiBaseModuleCommandNames} from "./commandNames";

export class LongPressCommand extends defineCommand<string>(
    UiBaseModuleCommandNames.LongPress,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}