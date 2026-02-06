import {Middleware, PayloadAction} from "@reduxjs/toolkit";
import {ActionMeta, InstanceMode, IStoreAccessor, LOG_TAGS, moduleName} from "../types";
import {ICommand} from "./command";
import {logger} from "./nativeAdapter";
import {getStatesToSync} from "./specialStateList";
import {diff} from 'deep-object-diff';
import {instanceInfoSlice, InstanceInfoState, syncStateToSlave} from "../features";
import {now} from 'lodash';

let _storeAccessor: IStoreAccessor | null = null;

/**
 * 设置store访问器 - 由store模块在初始化时调用
 */
export const setStoreAccessor = (accessor: IStoreAccessor) => {
    _storeAccessor = accessor;
};

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
    if (!_storeAccessor) {
        throw new Error("StoreAccessor not initialized. Call setStoreAccessor first.");
    }
    _storeAccessor.dispatch(traceActionFromCommand(action, command));
}
export const dispatchSimpleAction = (action: PayloadAction<any>) => {
    if (!_storeAccessor) {
        throw new Error("StoreAccessor not initialized. Call setStoreAccessor first.");
    }
    _storeAccessor.dispatch(action);
}


export const currentState = <S>(): S => {
    if (!_storeAccessor) {
        throw new Error("StoreAccessor not initialized. Call setStoreAccessor first.");
    }
    return _storeAccessor.getState() as S;
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

        const instanceInfo: InstanceInfoState = nextState[instanceInfoSlice.name];

        // 边界检查：确保 instanceInfo 存在
        if (!instanceInfo?.instance) {
            logger.warn([moduleName, LOG_TAGS.Store, 'StateSyncMiddleware'], 'instanceInfo not found in state');
            return result;
        }

        // 只在 MASTER 模式下同步
        if (instanceInfo.instance.instanceMode === InstanceMode.MASTER) {
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
                        syncStateToSlave(key, filteredDiff, null)
                            .then(() => {
                                logger.debug([moduleName, LOG_TAGS.Store, 'StateSyncMiddleware'], 'Sync success', { key });
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
