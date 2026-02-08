import {defineCommand, ExecutionType} from "../../../core/command";
import {ScreenPart} from "../../../types/core/screen";
import {BaseModuleCommandNames} from "../commandNames";


export class NavigationCommand extends defineCommand<{target:ScreenPart}>(
    BaseModuleCommandNames.Navigation,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}
