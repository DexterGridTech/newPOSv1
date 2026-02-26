import {adminLoginModalPart} from "./modals";
import {adminPanelModalPart} from "./modals/AdminPanelModal";
import {deviceStatusScreenPart, logFilesScreenPart} from "./screens";
import {localServerStatusScreenPart} from "./screens/localServerStatusScreen";
import {appControlScreenPart} from "./screens/appControlScreen";
import {terminalConnectionScreenPart} from "./screens/terminalConnectionScreen";

export const uiAdminScreenParts = {
    adminLoginModal: adminLoginModalPart,
    adminPanelModal: adminPanelModalPart,
    deviceStatusScreen: deviceStatusScreenPart,
    logFilesScreen: logFilesScreenPart,
    localServerStatusScreen: localServerStatusScreenPart,
    appControlScreen: appControlScreenPart,
    terminalConnectionScreen: terminalConnectionScreenPart
}