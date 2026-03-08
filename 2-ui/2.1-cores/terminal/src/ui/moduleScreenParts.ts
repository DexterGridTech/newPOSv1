import { ScreenPartRegistration} from "@impos2/kernel-core-base";
import {activateDeviceScreenPart} from "./screens/ActivateDeviceScreen";

export const uiCoreTerminalScreenParts:Record<string, ScreenPartRegistration> = {
    activateDeviceScreen:activateDeviceScreenPart
}