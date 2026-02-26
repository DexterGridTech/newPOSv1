import { Observable, Subject, of, EMPTY, timer, from } from 'rxjs';
import {
    tap,
    switchMap,
    catchError,
    concatMap,
    finalize,
    takeUntil
} from 'rxjs/operators';
import {
    TaskDefinition,
    ProgressData,
    TaskExecutionContext,
    TaskNode,
    TaskState,
} from "../types";
import { AdapterManager } from './adapterManager';
import {
    executeScriptAsObservable,
    executeConditionScriptAsObservable,
} from '@impos2/kernel-core-base';

/**
 * 全流式任务执行器（无异常不终止版本）
 */
export class StreamTaskExecutor {
    constructor(
        private adapterManager: AdapterManager
    ) {}

    /**
     * 执行任务（核心入口，返回永不终止的Observable）
     */
    executeTask(
        taskDef: TaskDefinition,
        requestId: string,
        initialContext: Record<string, any> = {}
    ): Observable<ProgressData> {
        const progress$ = new Subject<ProgressData>();
        const cancel$ = new Subject<void>();

        // 初始化执行上下文
        const executionContext: TaskExecutionContext = {
            requestId,
            taskKey: taskDef.key,
            context: { ...initialContext },
            cancel$,
            state: 'INIT',
            nodeCounter: 0,
            totalNodes: this.countNodes(taskDef.rootNode),
            hasError: false
        };

        // 推送任务初始化进度
        const initProgress: ProgressData = {
            requestId,
            taskKey: taskDef.key,
            nodeKey: taskDef.rootNode.key,
            type: 'TASK_INIT',
            state: 'INIT',
            nodeIndex: 0,
            totalNodes: executionContext.totalNodes,
            progress: 0,
            timestamp: Date.now(),
            context: initialContext
        };
        progress$.next(initProgress);

        // 标记任务为运行中
        executionContext.state = 'RUNNING';

        // 执行根节点（永不终止）
        this.executeNode(
            taskDef.rootNode,
            executionContext,
            initialContext,
            0
        ).pipe(
            tap((progress) => {
                progress$.next(progress);

                // 更新全局错误状态
                if (progress.type === 'NODE_ERROR') {
                    executionContext.hasError = true;
                }

                // 任务完成判断（所有节点处理完毕，无论成功失败）
                if (progress.nodeIndex >= executionContext.totalNodes - 1) {
                    const finalState: TaskState = executionContext.hasError
                        ? 'PARTIAL_FAILED'
                        : 'COMPLETED';

                    progress$.next({
                        ...progress,
                        type: 'TASK_COMPLETE',
                        state: finalState,
                        progress: 100,
                        timestamp: Date.now()
                    });
                }
            }),
            finalize(() => {
                // 确保流最终完成，不泄漏
                cancel$.next();
                cancel$.complete();
                progress$.complete();
            }),
            takeUntil(cancel$) // 取消信号监听
        ).subscribe();

        // 全局超时处理
        timer(taskDef.timeout).pipe(
            takeUntil(cancel$)
        ).subscribe(() => {
            if (executionContext.state !== 'COMPLETED' && executionContext.state !== 'CANCELLED') {
                executionContext.state = 'CANCELLED'; // 更新状态，防止后续 TASK_COMPLETE 误触发
                progress$.next({
                    ...initProgress,
                    type: 'NODE_ERROR',
                    state: 'PARTIAL_FAILED',
                    error: {
                        code: 'TASK_TIMEOUT',
                        message: `任务${taskDef.key}超时（${taskDef.timeout}ms）`,
                        retryable: false
                    },
                    timestamp: Date.now()
                });
                cancel$.next(); // 触发取消，终止所有子流
            }
        });

        return progress$.asObservable();
    }

    /**
     * 执行单个节点（核心方法，永不抛出异常）
     */
    private executeNode(
        node: TaskNode,
        executionContext: TaskExecutionContext,
        inputPayload: any,
        nodeIndex: number
    ): Observable<ProgressData> {
        const progress$ = new Subject<ProgressData>();
        const { requestId, taskKey, cancel$ } = executionContext;

        // 基础进度模板
        const baseProgress: ProgressData = {
            requestId,
            taskKey,
            nodeKey: node.key,
            type: 'NODE_START',
            state: executionContext.state,
            nodeIndex,
            totalNodes: executionContext.totalNodes,
            progress: Math.round((nodeIndex / executionContext.totalNodes) * 100),
            timestamp: Date.now(),
            context: { ...executionContext.context },
            payload: inputPayload
        };

        // 推送节点开始进度
        progress$.next({ ...baseProgress, type: 'NODE_START' });

        // 1. 条件检查 → 串行衔接核心逻辑（switchMap 保证顺序，消除竞态）
        const conditionCheck$ = node.strategy.condition
            ? executeConditionScriptAsObservable(
                node.strategy.condition,
                inputPayload,
                executionContext.context
              ).pipe(
                  tap(conditionResult => {
                      progress$.next({
                          ...baseProgress,
                          type: 'CONDITION_CHECK',
                          payload: { conditionResult, inputPayload },
                          timestamp: Date.now()
                      });
                  }),
                  catchError(() => {
                      // 条件脚本错误视为 false（跳过节点）
                      return of(false);
                  })
              )
            : of(true); // 无条件时直接通过

        conditionCheck$.pipe(
            switchMap(conditionResult => {
                // 条件不满足，跳过节点
                if (!conditionResult) {
                    progress$.next({
                        ...baseProgress,
                        type: 'NODE_SKIP',
                        payload: null,
                        error: {
                            code: 'CONDITION_NOT_MET',
                            message: node.strategy.skipMessage || `节点${node.key}条件不满足，跳过`,
                            retryable: false
                        },
                        timestamp: Date.now()
                    });
                    progress$.complete();
                    return EMPTY;
                }

                // 2. 执行节点核心逻辑（参数处理 → 原子执行 → 结果处理）
                return executeScriptAsObservable(
                    node.argsScript,
                    inputPayload,
                    executionContext.context
                );
            }),
            tap((scriptResult) => {
                if (!scriptResult.success) {
                    progress$.next({
                        ...baseProgress,
                        type: 'NODE_ERROR',
                        state: 'PARTIAL_FAILED',
                        error: scriptResult.error,
                        timestamp: Date.now()
                    });
                    progress$.complete();
                    return;
                }

                progress$.next({
                    ...baseProgress,
                    type: 'NODE_PROGRESS',
                    payload: { step: 'args_process_complete', data: scriptResult.data },
                    timestamp: Date.now()
                });

                // 3. 根据节点类型执行
                if (node.type === 'flow' && node.nodes) {
                    this.executeFlowNodes(
                        node.nodes,
                        executionContext,
                        scriptResult.data,
                        nodeIndex
                    ).pipe(
                        tap(flowProgress => progress$.next(flowProgress)),
                        finalize(() => { if (!progress$.closed) progress$.complete(); })
                    ).subscribe();
                } else {
                    this.executeAtomicNode(
                        node,
                        executionContext,
                        scriptResult.data,
                        baseProgress
                    ).pipe(
                        tap(atomicProgress => progress$.next(atomicProgress)),
                        finalize(() => { if (!progress$.closed) progress$.complete(); })
                    ).subscribe();
                }
            }),
            catchError((err) => {
                if (!progress$.closed) {
                    progress$.next({
                        ...baseProgress,
                        type: 'NODE_ERROR',
                        state: 'PARTIAL_FAILED',
                        error: {
                            code: 'NODE_EXEC_ERROR',
                            message: `节点执行异常：${err?.message || '未知错误'}`,
                            retryable: false
                        },
                        timestamp: Date.now()
                    });
                    progress$.complete();
                }
                return EMPTY;
            }),
            takeUntil(cancel$)
        ).subscribe();

        // 节点超时处理
        timer(node.timeout).pipe(
            takeUntil(cancel$)
        ).subscribe(() => {
            if (!progress$.closed) {
                progress$.next({
                    ...baseProgress,
                    type: 'NODE_ERROR',
                    state: 'PARTIAL_FAILED',
                    error: {
                        code: 'NODE_TIMEOUT',
                        message: `节点${node.key}超时（${node.timeout}ms）`,
                        retryable: node.strategy.errorStrategy === 'retry'
                    },
                    timestamp: Date.now()
                });
                progress$.complete();
            }
        });

        return progress$.asObservable();
    }

    /**
     * 执行原子节点（带重试/补偿逻辑，永不抛出异常）
     */
    private executeAtomicNode(
        node: TaskNode,
        executionContext: TaskExecutionContext,
        processedArgs: any,
        baseProgress: ProgressData
    ): Observable<ProgressData> {
        const progress$ = new Subject<ProgressData>();
        const { cancel$ } = executionContext;
        let retryCount = 0;

        // 执行逻辑（支持重试）
        const execute = () => {
            const adapter = this.adapterManager.getAdapter(node.type);
            adapter.execute(processedArgs, executionContext).pipe(
                tap((rawResult) => {
                    if (rawResult?.error) {
                        // 适配器返回错误
                        throw new Error(JSON.stringify(rawResult.error));
                    }

                    // 推送原子执行完成进度
                    progress$.next({
                        ...baseProgress,
                        type: 'NODE_PROGRESS',
                        payload: { step: 'atom_execute_complete', data: rawResult },
                        timestamp: Date.now()
                    });

                    // 执行结果处理脚本
                    executeScriptAsObservable(
                        node.resultScript,
                        rawResult,
                        executionContext.context
                    ).pipe(
                        tap((resultScriptResult) => {
                            if (!resultScriptResult.success) {
                                throw resultScriptResult.error;
                            }
                            executionContext.context[node.key] = resultScriptResult.data;
                            executionContext.nodeCounter++;
                            progress$.next({
                                ...baseProgress,
                                type: 'NODE_COMPLETE',
                                state: 'RUNNING',
                                progress: Math.round(((baseProgress.nodeIndex + 1) / baseProgress.totalNodes) * 100),
                                payload: resultScriptResult.data,
                                timestamp: Date.now()
                            });
                            if (!progress$.closed) progress$.complete();
                        }),
                        catchError((err) => {
                            this.handleNodeError(node, executionContext, err, baseProgress, progress$);
                            return EMPTY;
                        }),
                        takeUntil(cancel$)
                    ).subscribe();
                }),
                catchError((err) => {
                    // 原子执行错误，解析错误信息
                    let errorObj;
                    try {
                        errorObj = JSON.parse(err.message);
                    } catch {
                        errorObj = {
                            code: 'ATOM_EXEC_ERROR',
                            message: err.message || '原子执行失败',
                            retryable: node.strategy.errorStrategy === 'retry'
                        };
                    }

                    // 重试逻辑
                    if (node.strategy.errorStrategy === 'retry' &&
                        node.strategy.retry &&
                        retryCount < node.strategy.retry.times) {
                        retryCount++;
                        progress$.next({
                            ...baseProgress,
                            type: 'NODE_RETRY',
                            payload: { retryCount, maxRetries: node.strategy.retry.times },
                            error: errorObj,
                            timestamp: Date.now()
                        });

                    // 延迟后重试（加 takeUntil 防止取消后仍触发）
                        timer(node.strategy.retry?.interval || 1000).pipe(
                            takeUntil(cancel$)
                        ).subscribe(() => execute());
                        return EMPTY;
                    }

                    // 执行错误策略
                    this.handleNodeError(node, executionContext, errorObj, baseProgress, progress$);
                    return EMPTY;
                }),
                takeUntil(cancel$)
            ).subscribe();
        };

        // 开始执行
        execute();

        return progress$.asObservable();
    }

    /**
     * 处理节点错误（重试/跳过/补偿，永不终止流）
     */
    private handleNodeError(
        node: TaskNode,
        executionContext: TaskExecutionContext,
        error: any,
        baseProgress: ProgressData,
        progress$: Subject<ProgressData>
    ): void {
        const errorObj = typeof error === 'object' ? error : {
            code: 'UNKNOWN_ERROR',
            message: String(error),
            retryable: false
        };

        // 推送错误进度
        progress$.next({
            ...baseProgress,
            type: 'NODE_ERROR',
            state: 'PARTIAL_FAILED',
            error: errorObj,
            timestamp: Date.now()
        });

        // 执行错误策略
        switch (node.strategy.errorStrategy) {
            case 'skip':
                // 跳过当前节点，继续流程
                executionContext.nodeCounter++;
                progress$.complete();
                break;

            case 'compensate':
                // 执行补偿节点
                if (node.strategy.compensationNode && node.nodes) {
                    const compNode = node.nodes.find(n => n.key === node.strategy.compensationNode);
                    if (compNode) {
                        progress$.next({
                            ...baseProgress,
                            type: 'COMPENSATION',
                            payload: { compensationNode: compNode.key },
                            timestamp: Date.now()
                        });

                        // 执行补偿节点
                        this.executeNode(
                            compNode,
                            executionContext,
                            { error: errorObj, context: executionContext.context },
                            baseProgress.nodeIndex + 1
                        ).pipe(
                            tap((compProgress) => progress$.next(compProgress)),
                            finalize(() => {
                                executionContext.nodeCounter++;
                                progress$.complete();
                            })
                        ).subscribe();
                    } else {
                        executionContext.nodeCounter++;
                        progress$.complete();
                    }
                } else {
                    executionContext.nodeCounter++;
                    progress$.complete();
                }
                break;

            default:
                // 默认跳过
                executionContext.nodeCounter++;
                progress$.complete();
                break;
        }
    }

    /**
     * 执行流程节点（子节点列表，串行执行，永不终止）
     */
    private executeFlowNodes(
        nodes: TaskNode[],
        executionContext: TaskExecutionContext,
        inputPayload: any,
        startIndex: number
    ): Observable<ProgressData> {
        const progress$ = new Subject<ProgressData>();
        let currentPayload = inputPayload;

        // 串行执行所有子节点（from 替代 of(...nodes) 避免大数组栈溢出）
        from(nodes).pipe(
            concatMap((node, index) => {
                const nodeIndex = startIndex + index;
                return this.executeNode(
                    node,
                    executionContext,
                    currentPayload,
                    nodeIndex
                ).pipe(
                    tap((progress) => {
                        progress$.next(progress);
                        // 更新当前载荷（用于下一个节点）
                        if (progress.type === 'NODE_COMPLETE') {
                            currentPayload = progress.payload;
                        }
                    })
                );
            }),
            finalize(() => progress$.complete()),
            takeUntil(executionContext.cancel$)
        ).subscribe();

        return progress$.asObservable();
    }

    /**
     * 递归统计节点数（用于进度计算）
     */
    private countNodes(node: TaskNode): number {
        let count = 1;
        if (node.type === 'flow' && node.nodes) {
            node.nodes.forEach(child => {
                count += this.countNodes(child);
            });
        }
        return count;
    }
}