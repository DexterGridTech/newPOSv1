import {workbenchDesktopScreenPart} from "./screens/workbenchDesktopScreen";
import {ScreenPartRegistration} from "@impos2/kernel-core-base";

export const uiMixcWorkbenchScreenParts:Record<string, ScreenPartRegistration> = {
    workbenchDesktopScreen: workbenchDesktopScreenPart
}
