import { EnhancedStore } from "@reduxjs/toolkit";
import { RootState } from "../features";
import { StoreManager } from "./StoreManager";
import { StoreConfig, ScreenPartRegisterFunction } from "./types";

// 导出类型
export type { KernelModule, StoreConfig, ScreenPartRegisterFunction } from "./types";

/**
 * 设置 ScreenPart 注册函数
 * 此函数应在 generateStore 之前调用
 * @param fn ScreenPart 注册函数
 */
export const setScreenPartRegisterFunction = (fn: ScreenPartRegisterFunction): void => {
    StoreManager.getInstance().setScreenPartRegisterFunction(fn);
};

/**
 * 生成 Store 实例
 * @param config Store 配置
 * @returns Store 实例
 */
export const generateStore = (config: StoreConfig) => {
    return StoreManager.getInstance().generateStore(config);
};
