import {Middleware} from "@reduxjs/toolkit";
import {LOG_TAGS, logger, RootState} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {InstanceMode, kernelCoreInterconnectionState} from "../../types";
import {SyncRetryQueue} from "../../foundations/syncRetryQueue";
import {statesToSyncFromMasterToSlave, statesToSyncFromSlaveToMaster} from "../../foundations/statesNeedToSync";
import {syncStateToRemote} from "../../foundations/syncStateToRemote";

export const createStateSyncMiddleware = (): Middleware => {
    // 缓存的 slice 引用（利用 Redux immutable 特性，无需深拷贝）
    let cachedSliceRefs: Record<string, any> = {}
    // 缓存的属性引用
    let cachedPropertyRefs: Record<string, Record<string, any>> = {}
    let isSyncing = false
    const retryQueue = new SyncRetryQueue()

    return ({getState}) => (next) => (action: any) => {
        const prevState = getState() as RootState
        const prevStartToSync = prevState[kernelCoreInterconnectionState.instanceInterconnection]?.startToSync ?? false

        const result = next(action);

        const nextState = getState() as RootState
        const nextStartToSync = nextState[kernelCoreInterconnectionState.instanceInterconnection]?.startToSync ?? false

        const instanceMode = nextState[kernelCoreInterconnectionState.instanceInfo].instanceMode
        const statesNeedToSync = (instanceMode === InstanceMode.MASTER) ? statesToSyncFromMasterToSlave : statesToSyncFromSlaveToMaster

        if (!prevStartToSync && nextStartToSync) {
            logger.log([moduleName, LOG_TAGS.System, "stateSyncMiddleware"], "开始状态同步，缓存当前状态")
            isSyncing = true
            cachedSliceRefs = {}
            cachedPropertyRefs = {}
            statesNeedToSync.forEach(stateKey => {
                const state = nextState[stateKey]
                if (state) {
                    cachedSliceRefs[stateKey] = state
                    cachedPropertyRefs[stateKey] = {...(state as Record<string, any>)}
                }
            })
        } else if (prevStartToSync && !nextStartToSync) {
            logger.log([moduleName, LOG_TAGS.System, "stateSyncMiddleware"], "停止状态同步，清空缓存")
            isSyncing = false
            cachedSliceRefs = {}
            cachedPropertyRefs = {}
            retryQueue.clear()
        } else if (isSyncing && nextStartToSync) {
            const changesToSync: Record<string, Record<string, any>> = {}

            // 记录本轮检测到变化的 slice 引用，用于同步成功后更新缓存
            const detectedSliceRefs: Record<string, any> = {}

            statesNeedToSync.forEach(stateKey => {
                const currentSlice = nextState[stateKey]
                // 优化1：slice 引用相同 = 没变化，直接跳过
                if (currentSlice === cachedSliceRefs[stateKey]) return

                const cached = cachedPropertyRefs[stateKey]
                const current = currentSlice as Record<string, any>
                if (!cached || !current) return

                const sliceChanges: Record<string, any> = {}

                // 检查新增和修改（优化2：属性级引用比较）
                for (const key of Object.keys(current)) {
                    if (current[key] === cached[key]) continue
                    const prop = current[key] as { updatedAt?: number }
                    if (prop && typeof prop === 'object' && prop.updatedAt) {
                        if (typeof prop.updatedAt !== 'number' || isNaN(prop.updatedAt)) {
                            logger.warn([moduleName, LOG_TAGS.System, "stateSyncMiddleware"],
                                `属性 ${String(stateKey)}.${key} 的 updatedAt 不是有效数字:`, prop.updatedAt)
                            continue
                        }
                        sliceChanges[key] = prop
                    }
                }

                // 优化3：合并删除检测到同一次遍历
                for (const key of Object.keys(cached)) {
                    if (current[key] === undefined) {
                        const cachedProp = cached[key] as { updatedAt?: number }
                        if (cachedProp && typeof cachedProp === 'object' && cachedProp.updatedAt) {
                            sliceChanges[key] = null
                        }
                    }
                }

                if (Object.keys(sliceChanges).length > 0) {
                    changesToSync[stateKey] = sliceChanges
                    detectedSliceRefs[stateKey] = currentSlice
                }
            })

            if (Object.keys(changesToSync).length > 0) {
                const syncPromises = Object.keys(changesToSync).map(stateKey =>
                    syncStateToRemote(stateKey, changesToSync[stateKey])
                )

                Promise.all(syncPromises)
                    .then(() => {
                        // 优化4：同步成功后直接更新引用，无需 JSON 深拷贝
                        Object.keys(changesToSync).forEach(stateKey => {
                            const changes = changesToSync[stateKey]
                            for (const key of Object.keys(changes)) {
                                if (changes[key] === null) {
                                    delete cachedPropertyRefs[stateKey][key]
                                } else {
                                    cachedPropertyRefs[stateKey][key] = changes[key]
                                }
                            }
                            cachedSliceRefs[stateKey] = detectedSliceRefs[stateKey]
                        })
                    })
                    .catch(error => {
                        logger.error([moduleName, LOG_TAGS.System, "stateSyncMiddleware"], "状态同步失败，加入重试队列:", error)
                        Object.keys(changesToSync).forEach(stateKey => {
                            retryQueue.enqueue(stateKey, changesToSync[stateKey])
                        })
                    })
            }
        }

        return result;
    };
};