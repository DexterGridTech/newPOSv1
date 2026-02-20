import { ScreenPartRegistration } from "_old_/base";
import { activateDesktopScreenPart } from "./screens";
import { testModalScreenPart } from "./modals";

/**
 * 设备激活UI 模块所有 ScreenParts 注册
 *
 * 将所有页面和弹窗的注册信息汇总到这里
 */
export const moduleScreenParts: ScreenPartRegistration[] = [
    activateDesktopScreenPart,
    testModalScreenPart,
];
