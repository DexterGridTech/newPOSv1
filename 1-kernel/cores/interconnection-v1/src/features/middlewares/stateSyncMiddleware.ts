import {Middleware} from "@reduxjs/toolkit";
import {LOG_TAGS, logger, RootState} from "@impos2/kernel-core-base-v1";
import {moduleName} from "../../moduleName";
import {InstanceMode, kernelCoreInterconnectionState} from "../../types";
import {SyncRetryQueue} from "../../foundations/syncRetryQueue";
import {statesToSyncFromMasterToSlave, statesToSyncFromSlaveToMaster} from "../../foundations/statesNeedToSync";
import {syncStateToRemote} from "../../foundations/syncStateToRemote";

export const createStateSyncMiddleware = (): Middleware => {
    // 缓存的状态快照
    let cachedStates: Record<string, Record<string, any>> = {}
    // 是否正在同步
    let isSyncing = false
    // 同步失败重试队列
    const retryQueue = new SyncRetryQueue()

    return ({getState}) => (next) => (action: any) => {
        // 获取 action 执行前的状态
        const prevState = getState() as RootState
        const prevInstanceInterconnection = prevState[kernelCoreInterconnectionState.instanceInterconnection]
        const prevStartToSync = prevInstanceInterconnection?.startToSync ?? false

        // 执行 Action，获取新状态
        const result = next(action);

        // 获取 action 执行后的状态
        const nextState = getState() as RootState
        const nextInstanceInterconnection = nextState[kernelCoreInterconnectionState.instanceInterconnection]
        const nextStartToSync = nextInstanceInterconnection?.startToSync ?? false

        const instanceMode = nextState[kernelCoreInterconnectionState.instanceInfo].instanceMode
        const statesNeedToSync = (instanceMode === InstanceMode.MASTER) ? statesToSyncFromMasterToSlave : statesToSyncFromSlaveToMaster

        // 检测 startToSync 状态变化
        if (!prevStartToSync && nextStartToSync) {
            // 从 false 变为 true，开始缓存状态
            logger.log([moduleName, LOG_TAGS.System, "stateSyncMiddleware"], "开始状态同步，缓存当前状态")
            isSyncing = true
            cachedStates = {}


            statesNeedToSync.forEach(stateKey => {
                const state = nextState[stateKey] as Record<string, any>
                if (state) {
                    cachedStates[stateKey] = JSON.parse(JSON.stringify(state))
                }
            })
        } else if (prevStartToSync && !nextStartToSync) {
            // 从 true 变为 false，停止同步并清空缓存
            logger.log([moduleName, LOG_TAGS.System, "stateSyncMiddleware"], "停止状态同步，清空缓存")
            isSyncing = false
            cachedStates = {}
            retryQueue.clear()
        } else if (isSyncing && nextStartToSync) {
            // 正在同步中，检测状态变化
            const changesToSync: Record<string, Record<string, any>> = {}

            statesNeedToSync.forEach(stateKey => {
                const cachedState = cachedStates[stateKey]
                const currentState = nextState[stateKey] as Record<string, any>

                if (!cachedState || !currentState) {
                    return
                }

                // 检查每个属性的变化（新增或修改）
                Object.keys(currentState).forEach(key => {
                    try {
                        const cachedProperty = cachedState[key] as { updateAt?: number }
                        const currentProperty = currentState[key] as { updateAt?: number }

                        // 只关注带 updateAt 的对象
                        if (currentProperty && typeof currentProperty === 'object' && currentProperty.updateAt) {
                            // 验证 updateAt 是否为有效数字
                            if (typeof currentProperty.updateAt !== 'number' || isNaN(currentProperty.updateAt)) {
                                logger.warn([moduleName, LOG_TAGS.System, "stateSyncMiddleware"],
                                    `属性 ${String(stateKey)}.${key} 的 updateAt 不是有效数字:`, currentProperty.updateAt)
                                return
                            }

                            // 检查是否有变化
                            if (!cachedProperty ||
                                !cachedProperty.updateAt ||
                                currentProperty.updateAt > cachedProperty.updateAt) {

                                // 记录变化
                                if (!changesToSync[stateKey]) {
                                    changesToSync[stateKey] = {}
                                }
                                changesToSync[stateKey][key] = currentProperty
                            }
                        }
                    } catch (error) {
                        logger.error([moduleName, LOG_TAGS.System, "stateSyncMiddleware"],
                            `检查属性变化时出错 ${String(stateKey)}.${key}:`, error)
                    }
                })

                // 检查属性删除（缓存中有但当前状态中没有）
                Object.keys(cachedState).forEach(key => {
                    try {
                        const cachedProperty = cachedState[key] as { updateAt?: number }
                        const currentProperty = currentState[key]

                        // 如果缓存中有带 updateAt 的对象，但当前状态中没有，说明被删除了
                        if (cachedProperty && typeof cachedProperty === 'object' && cachedProperty.updateAt) {
                            if (!currentProperty) {
                                // 记录删除操作，同步 null 给 slave
                                if (!changesToSync[stateKey]) {
                                    changesToSync[stateKey] = {}
                                }
                                changesToSync[stateKey][key] = null
                            }
                        }
                    } catch (error) {
                        logger.error([moduleName, LOG_TAGS.System, "stateSyncMiddleware"],
                            `检查属性删除时出错 ${String(stateKey)}.${key}:`, error)
                    }
                })
            })

            // 如果有变化，立即同步
            if (Object.keys(changesToSync).length > 0) {
                logger.log([moduleName, LOG_TAGS.System, "stateSyncMiddleware"], "同步状态变化:", changesToSync)

                const syncPromises = Object.keys(changesToSync).map(stateKey =>
                    syncStateToRemote(stateKey, changesToSync[stateKey])
                )

                Promise.all(syncPromises)
                    .then(() => {
                        // 同步成功后更新缓存
                        Object.keys(changesToSync).forEach(stateKey => {
                            const changes = changesToSync[stateKey]
                            Object.keys(changes).forEach(key => {
                                const value = changes[key]
                                if (value === null) {
                                    // 删除缓存中的属性
                                    delete cachedStates[stateKey][key]
                                } else {
                                    // 更新缓存
                                    cachedStates[stateKey][key] = JSON.parse(JSON.stringify(value))
                                }
                            })
                        })
                        logger.log([moduleName, LOG_TAGS.System, "stateSyncMiddleware"], "状态同步成功，缓存已更新")
                    })
                    .catch(error => {
                        // 同步失败，将失败项加入重试队列
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