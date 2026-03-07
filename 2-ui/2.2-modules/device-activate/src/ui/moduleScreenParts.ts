import { ScreenPartRegistration} from "@impos2/kernel-core-base";
import {activateDeviceScreenPart} from "./screens/ActivateDeviceScreen";

export const uiDeviceActivateScreenParts:Record<string, ScreenPartRegistration> = {
    activateDesktopScreen:activateDeviceScreenPart
}