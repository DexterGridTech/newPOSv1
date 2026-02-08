import { ScreenPartRegistration } from "@impos2/kernel-base";
import { loginDesktopScreenPart } from "./screens";

/**
 * 用户登录UI 模块所有 ScreenParts 注册
 *
 * 将所有页面和弹窗的注册信息汇总到这里
 */
export const moduleScreenParts: ScreenPartRegistration[] = [
    loginDesktopScreenPart,
];
