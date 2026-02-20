import { EnhancedStore } from "@reduxjs/toolkit";
import { RootState } from "../features";
import { StoreManager } from "./StoreManager";
import { StoreConfig } from "./types";

// 导出类型
export type { KernelModule, StoreConfig } from "./types";

/**
 * 生成 Store 实例
 * @param config Store 配置
 * @returns Store 实例
 */
export const generateStore = (config: StoreConfig) => {
    return StoreManager.getInstance().generateStore(config);
};
