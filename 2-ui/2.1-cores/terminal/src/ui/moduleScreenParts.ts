import { ScreenPartRegistration} from "@impos2/kernel-core-base";
import {mpActivateDeviceScreenPart} from "./screens/MPActivateDeviceScreen";
import {spActivateDeviceScreenPart} from "./screens/SPActivateDeviceScreen";

export const uiCoreTerminalScreenParts:Record<string, ScreenPartRegistration> = {
    mpActivateDeviceScreen:mpActivateDeviceScreenPart,
    spActivateDeviceScreen:spActivateDeviceScreenPart
}