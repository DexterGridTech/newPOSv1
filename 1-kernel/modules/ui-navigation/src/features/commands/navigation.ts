import {defineCommand, ExecutionType} from "@impos2/kernel-base";
import {ScreenPart} from "../../types";
import {UiNavigationCommandNames} from "./commandNames";


export class NavigationCommand extends defineCommand<{target:ScreenPart}>(
    UiNavigationCommandNames.Navigation,
    ExecutionType.SEND_AND_EXECUTE_SEPARATELY
) {}
