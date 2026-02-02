import type {AppEpic, RootState} from "../rootState";
import {getStatesToPersist, logger} from "../../core";
import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    filter,
    ignoreElements,
    map,
    mergeMap,
    pairwise,
    retry,
    switchMap,
} from "rxjs/operators";
import {EMPTY, from, merge, timer} from "rxjs";
import {getObjectChanges, persistStateToStorage} from "../utils";
import {instanceInfoSlice} from "../slices";
/**
 * 持久化状态 Epic
 * 改进: 添加错误处理和重试机制
 */
const persistStateEpic: AppEpic = (action$, state$) =>
    state$.pipe(
        map(state => state[instanceInfoSlice.name].standAlone),
        distinctUntilChanged(),
        filter(standAlone => standAlone),
        switchMap(() => {
            const listen = getStatesToPersist().map(key => {
                return state$.pipe(
                    map(state => state[key as keyof RootState]),
                    distinctUntilChanged((prev, next) => prev === next),
                    debounceTime(200),
                    // 将持久化操作转换为 Observable
                    pairwise(), // 再对比有变化的前后值
                    map(([prev, curr]) => getObjectChanges(prev, curr)),
                    // 将同步操作转换为 Observable
                    mergeMap(stateChanged =>
                        from(Promise.resolve(persistStateToStorage(key, stateChanged))).pipe(
                            // 错误处理: 记录错误但不中断流
                            catchError(error => {
                                logger.error(`状态持久化失败 [${key}]:`, error);
                                // 返回空 Observable,不中断流
                                return EMPTY;
                            }),
                            // 重试机制: 失败后重试3次
                            retry({
                                count: 3,
                                delay: (error, retryCount) => {
                                    logger.warn(`状态持久化重试 [${key}] 第${retryCount}次`);
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
        // 全局错误处理
        catchError((error, caught) => {
            logger.error('persistStateEpic 全局错误:', error);
            return caught;
        }),
        ignoreElements()
    )


export const instanceModeEpics = [
    persistStateEpic
]

