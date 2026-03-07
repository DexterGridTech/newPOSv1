import {workbenchDesktopScreenPart} from "./screens/workbenchDesktopScreen";
import {ScreenPartRegistration} from "@impos2/kernel-core-base";

export const uiWorkbenchScreenParts:Record<string, ScreenPartRegistration> = {
    workbenchDesktopScreen: workbenchDesktopScreenPart
}
