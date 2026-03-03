import { ScreenPartRegistration} from "@impos2/kernel-core-base";
import {activateDesktopScreenPart} from "./screens/ActivateDesktopScreen";

export const uiDeviceActivateScreenParts:Record<string, ScreenPartRegistration> = {
    activateDesktopScreen:activateDesktopScreenPart
}