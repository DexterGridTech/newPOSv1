import {EnhancedStore, Middleware, PayloadAction} from "@reduxjs/toolkit";
import {ActionMeta, InstanceMode, LOG_TAGS, ServerConnectionStatus} from "../types";
import {moduleName} from "../moduleName";
import {ICommand} from "./command";
import {logger} from "./nativeAdapter";
import {getStatesToSync, registerStateToPersist, registerStateToSync} from "./specialStateList";
import {diff} from 'deep-object-diff';
import {now} from 'lodash';
import {KernelBaseStateNames} from "../types/stateNames";

// 重新导出供外部使用
export {registerStateToPersist, registerStateToSync};

/**
 * Store注册表 - 统一管理所有store相关的访问和依赖注入
 */
class StoreEntry {
    private store: EnhancedStore<any> | null = null;
    private syncStateToSlaveFunc: ((key: string, diff: any, meta: any) => Promise<void>) | null = null;

    /**
     * 初始化注册表（只能调用一次）
     */
    initialize(
        store: EnhancedStore<any>,
        syncStateToSlave: (key: string, diff: any, meta: any) => Promise<void>
    ): void {
        if (this.store) {
            throw new Error("StoreEntry already initialized");
        }
        this.store = store;
        this.syncStateToSlaveFunc = syncStateToSlave;
    }

    /**
     * 获取当前状态
     */
    getState<S>(): S {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        return this.store.getState() as S;
    }

    /**
     * 类型安全的状态选择器
     */
    selectState<K extends keyof typeof KernelBaseStateNames>(stateKey: K) {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames[stateKey]];
    }

    /**
     * 获取实例信息
     */
    getInstance() {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.instanceInfo].instance;
    }

    /**
     * 分发action
     */
    dispatch(action: PayloadAction<any>): void {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        this.store.dispatch(action);
    }

    /**
     * 获取slave名称
     */
    getSlaveName(): string | null {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.instanceInfo].slaveConnectionInfo.slaveName ?? null;
    }

    /**
     * 获取显示模式
     */
    getDisplayMode() {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.instanceInfo].instance.displayMode;
    }

    /**
     * 获取屏幕模式
     */
    getScreenMode() {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.instanceInfo].instance.screenMode;
    }

    /**
     * 获取设备ID
     */
    getDeviceId(): string | undefined {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.deviceStatus].deviceInfo?.id;
    }

    /**
     * 获取终端Token
     */
    getTerminalToken(): string | undefined {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.terminalInfo].token;
    }

    /**
     * 获取实例模式
     */
    getInstanceMode() {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.instanceInfo].instance.instanceMode;
    }

    /**
     * 是否为主机模式
     */
    isMasterMode(): boolean {
        return this.getInstanceMode() === InstanceMode.MASTER;
    }

    /**
     * 是否为从机模式
     */
    isSlaveMode(): boolean {
        return this.getInstanceMode() === InstanceMode.SLAVE;
    }

    /**
     * 获取从机连接信息
     */
    getSlaveConnectionInfo() {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.instanceInfo].slaveConnectionInfo;
    }

    /**
     * 获取主服务器连接状态
     */
    getMasterServerStatus() {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.masterServerStatus].serverConnectionStatus;
    }

    /**
     * 是否有终端Token
     */
    hasTerminalToken(): boolean {
        return !!this.getTerminalToken();
    }

    /**
     * 获取操作实体
     */
    getOperatingEntity() {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.terminalInfo].operatingEntity;
    }

    /**
     * 是否有操作实体
     */
    hasOperatingEntity(): boolean {
        return !!this.getOperatingEntity();
    }

    /**
     * 获取设备信息
     */
    getDeviceInfo() {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.deviceStatus].deviceInfo;
    }

    /**
     * 获取主机从机列表
     */
    getMasterSlaves() {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.instanceInfo].masterSlaves;
    }

    /**
     * 获取系统参数
     */
    getSystemParameter(path: string) {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state.systemParameters.parameters[path] ?? null;
    }

    /**
     * 是否启用从机
     */
    isEnableSlaves(): boolean {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.instanceInfo].enableSlaves ?? false;
    }

    /**
     * 获取服务器地址列表
     */
    getServerAddresses() {
        if (!this.store) {
            throw new Error("StoreEntry not initialized");
        }
        const state = this.store.getState();
        return state[KernelBaseStateNames.masterServerStatus].serverAddresses ?? [];
    }

    /**
     * 同步状态到slave
     */
    syncStateToSlave(key: string, diff: any, meta: any): Promise<void> {
        if (!this.syncStateToSlaveFunc) {
            throw new Error("StoreEntry not initialized");
        }
        return this.syncStateToSlaveFunc(key, diff, meta);
    }

    /**
     * 检查是否已初始化
     */
    isInitialized(): boolean {
        return this.store !== null;
    }
}

// 导出单例
export const storeEntry = new StoreEntry();

const traceActionFromCommand = (
    action: PayloadAction<any>,
    command?: ICommand<any>
) => {
    const meta: ActionMeta = {
        commandId: command?.id ?? "unknown",
        requestId: command?.requestId ?? "unknown",
        sessionId: command?.sessionId ?? "unknown",
        addedAt: now(),
    };

    return {
        ...action,
        meta,
    };
};

export const dispatchAction = (action: PayloadAction<any>, command?: ICommand<any>) => {
    storeEntry.dispatch(traceActionFromCommand(action, command));
}

export const dispatchSimpleAction = (action: PayloadAction<any>) => {
    storeEntry.dispatch(action);
}

export const currentState = <S>(): S => {
    return storeEntry.getState<S>();
}

/**
 * 过滤掉对象中下划线开头的属性（非业务属性）
 * @param obj 要过滤的对象
 * @returns 过滤后的新对象
 */
const filterUnderscoreProps = (obj: Record<string, any>): Record<string, any> => {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const filtered: Record<string, any> = {};

    for (const key in obj) {
        // 跳过下划线开头的属性
        if (key.startsWith('_')) {
            continue;
        }

        // 递归处理嵌套对象
        const value = obj[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            filtered[key] = filterUnderscoreProps(value);
        } else {
            filtered[key] = value;
        }
    }

    return filtered;
};

export const createStateSyncMiddleware = (): Middleware => {
    // 只保存需要同步的 state 切片，减少内存占用
    let prevSyncStates: Record<string, any> = {};
    let isInitialized = false;

    return ({getState}) => (next) => (action: unknown) => {
        // 执行 Action，获取新状态
        const result = next(action);
        const nextState = getState();

        // 检查是否已初始化依赖
        if (!storeEntry.isInitialized()) {
            return result;
        }

        const instanceInfo = nextState[KernelBaseStateNames.instanceInfo];
        const masterServerStatus = nextState[KernelBaseStateNames.masterServerStatus];

        // 边界检查：确保 instanceInfo 存在
        if (!instanceInfo?.instance) {
            logger.warn([moduleName, LOG_TAGS.Store, 'StateSyncMiddleware'], 'instanceInfo not found in state');
            return result;
        }

        // 只在 MASTER 模式下同步
        if (instanceInfo.instance.instanceMode === InstanceMode.MASTER &&
            masterServerStatus.serverConnectionStatus === ServerConnectionStatus.CONNECTED) {
            const statesToSync = getStatesToSync();

            // 初始化时保存当前状态，避免第一次错误 diff
            if (!isInitialized) {
                statesToSync.forEach(key => {
                    prevSyncStates[key] = nextState[key];
                });
                isInitialized = true;
                return result;
            }

            // 遍历需要同步的 state
            statesToSync.forEach(key => {
                const prevSlice = prevSyncStates[key];
                const nextSlice = nextState[key];

                // 引用比较：只有真正变化时才同步
                if (prevSlice !== nextSlice) {
                    // 计算差异
                    const fullDiff = diff(prevSlice || {}, nextSlice || {});

                    // 过滤掉下划线开头的属性（非业务属性）
                    const filteredDiff = filterUnderscoreProps(fullDiff);

                    // 只有存在差异时才同步
                    if (Object.keys(filteredDiff).length > 0) {
                        logger.debug([moduleName, LOG_TAGS.Store, 'StateSyncMiddleware'], 'Syncing state', {
                            key,
                            diffKeys: Object.keys(filteredDiff)
                        });

                        // 异步同步到 slave
                        storeEntry.syncStateToSlave(key, filteredDiff, null)
                            .then(() => {
                                logger.debug([moduleName, LOG_TAGS.Store, 'StateSyncMiddleware'], 'Sync success', {key});
                            })
                            .catch((err) => {
                                logger.error([moduleName, LOG_TAGS.Store, 'StateSyncMiddleware'], 'Sync failed', {
                                    key,
                                    error: err instanceof Error ? err.message : String(err),
                                    diff: filteredDiff
                                });
                            });
                    }

                    // 更新 prevSyncStates
                    prevSyncStates[key] = nextSlice;
                }
            });
        } else {
            // 非 MASTER 模式，清空 prevSyncStates
            if (isInitialized) {
                prevSyncStates = {};
                isInitialized = false;
            }
        }

        return result;
    };
};
