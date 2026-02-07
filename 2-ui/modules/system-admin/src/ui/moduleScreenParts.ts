import {adminLoginModalPart, adminPanelModalPart} from "./modals";
import {setupWorkSpaceScreenPart} from "./screens/setupWorkSpaceScreen";
import {clearDataVersionScreenPart} from "./screens/clearDataVersionScreen";

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
    // 在这里添加更多的 screen parts
];
