import type {AppEpic, RootState} from "../rootState";
import {getStatesToSync, logger} from "../../core";
import {
    catchError,
    distinctUntilChanged,
    filter,
    ignoreElements,
    map,
    mergeMap, pairwise,
    retry,
    switchMap
} from "rxjs/operators";
import {EMPTY, from, merge, timer} from "rxjs";
import {InstanceMode} from "../../types";
import {syncStateToSlave} from "../utils";
import {getObjectChanges} from "../utils";
import {instanceInfoSlice} from "../slices";

/**
 * 状态同步 Epic
 * 改进: 添加错误处理和重试机制,防止流终止
 */
const syncStateEpic: AppEpic = (action$, state$) =>
    state$.pipe(
        map(state => state[instanceInfoSlice.name].instance.instanceMode),
        distinctUntilChanged(),
        filter(instanceMode => instanceMode === InstanceMode.MASTER),
        switchMap(() => {
            const listen = getStatesToSync().map(key => {
                return state$.pipe(
                    map(state => state[key as keyof RootState]),
                    distinctUntilChanged((prev, next) => prev === next),
                    pairwise(), // 再对比有变化的前后值
                    map(([prev, curr]) => getObjectChanges(prev, curr)),
                    // 将同步操作转换为 Observable
                    mergeMap(stateChanged =>
                        from(Promise.resolve(syncStateToSlave(key, stateChanged, null))).pipe(
                            // 错误处理: 记录错误但不中断流
                            catchError(error => {
                                logger.error(`状态同步失败 [${key}]:`, error);
                                // 返回空 Observable,不中断流
                                return EMPTY;
                            }),
                            // 重试机制: 失败后重试3次
                            retry({
                                count: 3,
                                delay: (error, retryCount) => {
                                    logger.warn(`状态同步重试 [${key}] 第${retryCount}次`);
                                    // 指数退避: 1s, 2s, 4s
                                    return timer(1000 * Math.pow(2, retryCount - 1));
                                }
                            })
                        )
                    )
                )
            })
            return merge(...listen)
        }),
        // 全局错误处理: 防止整个 Epic 终止
        catchError((error, caught) => {
            logger.error('syncStateEpic 全局错误:', error);
            // 重新订阅,保持流活跃
            return caught;
        }),
        ignoreElements()
    )

export const masterServerStatusEpics = [
    syncStateEpic
]