import {defaultAlertPart} from "./modals/DefaultAlert";
import {emptyScreenPart} from "./screens/EmptyScreen";
import {ScreenPartRegistration} from "@impos2/kernel-core-base";


export const uiCoreBaseScreenParts :Record<string, ScreenPartRegistration> = {
    defaultAlert:defaultAlertPart,
    emptyScreen:emptyScreenPart
}