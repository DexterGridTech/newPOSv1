import {defineCommand, ExecutionType} from "@impos2/kernel-base";
import {UiBaseModuleCommandNames} from "./commandNames";

export class LongPressCommand extends defineCommand<string>(
    UiBaseModuleCommandNames.LongPress,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}