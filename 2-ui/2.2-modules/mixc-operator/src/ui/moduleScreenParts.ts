import { ScreenPartRegistration} from "@impos2/kernel-core-base";
import {loginScreenPart} from "./screens/loginScreen";

export const uiMixcOperatorScreenParts:Record<string, ScreenPartRegistration> = {
    loginScreen:loginScreenPart
}