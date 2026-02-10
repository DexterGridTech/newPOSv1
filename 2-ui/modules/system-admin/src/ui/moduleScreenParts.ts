import {adminLoginModalPart, adminPanelModalPart} from "./modals";
import {clearDataVersionScreenPart, setupWorkSpaceScreenPart} from "./screens";
import {deviceInfoScreenPart} from "./screens/DeviceInfoScreen";

/**
 * 系统管理模块的所有 ScreenParts
 *
 * ScreenParts 用于注册页面组件
 */
export const moduleScreenParts = [
    adminLoginModalPart,
    adminPanelModalPart,
    setupWorkSpaceScreenPart,
    clearDataVersionScreenPart,
    deviceInfoScreenPart
    // 在这里添加更多的 screen parts
];
