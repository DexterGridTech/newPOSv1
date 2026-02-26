import { Observable, Subject, of, EMPTY, timer, Subscription } from 'rxjs';
import {
    tap,
    catchError,
    concatMap,
    switchMap,
    finalize,
    takeUntil
} from 'rxjs/operators';
import {
    TaskDefinition,
    ProgressData,
    TaskExecutionContext,
    TaskNode,
    TaskState,
    TaskSession,
} from '../types';
import { AdapterManager } from './adapterManager';
import {
    executeScriptAsObservable,
    executeConditionScriptAsObservable
} from '@impos2/kernel-core-base';

/**
 * 全流式任务执行器（无异常+循环执行版本）
 * 设计核心目标：
 * 1. 永不抛出异常：所有错误封装为ProgressData.error推送
 * 2. 永不自动终止：仅手动取消时complete流（loop=false时单次完成后complete）
 * 3. 支持循环执行：单次流程完成后自动重启，实现"持续扫码加购"
 * 4. 流式处理：所有状态通过ProgressData推送，业务侧纯响应式处理
 */
export class StreamTaskExecutor {
    constructor(private adapterManager: AdapterManager) {}

    /**
     * 执行任务（核心入口方法）
     * @param taskDef 任务定义：包含流程结构、超时、节点配置等
     * @param requestId 全局请求ID：追踪单次持续加购会话
     * @param initialContext 初始上下文：业务侧传入的初始数据（如userId）
     * @param loop 是否循环执行：true=无限循环（持续扫码），false=单次执行后complete
     * @returns TaskSession：包含 progress$ 流和 cancel 句柄
     */
    executeTask(
        taskDef: TaskDefinition,
        requestId: string,
        initialContext: Record<string, any> = {},
        loop = true
    ): TaskSession {
        const progress$ = new Subject<ProgressData>();
        const cancel$ = new Subject<void>();

        const executionContext: TaskExecutionContext = {
            requestId,
            taskKey: taskDef.key,
            context: {
                ...initialContext,
                purchasedProducts: [],
                loopCount: 0,
                lastBarcode: ''
            },
            cancel$,
            state: 'INIT',
            nodeCounter: 0,
            totalNodes: this.countNodes(taskDef.rootNode),
            hasError: false
        };

        // Issue-A fix：快照初始 context，避免后续 loop 修改污染 TASK_INIT 的 context 引用
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
            context: { ...executionContext.context }
        };
        progress$.next(initProgress);

        executionContext.state = 'RUNNING';

        // 每次 loop 独立的超时订阅，存储引用以便在下次 loop 前取消
        let loopTimeoutSub: Subscription | null = null;

        const executeLoop = () => {
            loopTimeoutSub?.unsubscribe();

            executionContext.nodeCounter = 0;
            executionContext.hasError = false;
            executionContext.context.loopCount += 1;
            executionContext.context.lastBarcode = '';

            // 每次 loop 重新创建超时 timer
            loopTimeoutSub = timer(taskDef.timeout).pipe(
                takeUntil(cancel$)
            ).subscribe(() => {
                if (executionContext.state !== 'CANCELLED') {
                    // Issue-C fix：超时事件 nodeKey 用空字符串，避免误导为某个具体节点的错误
                    progress$.next({
                        requestId,
                        taskKey: taskDef.key,
                        nodeKey: '',
                        type: 'NODE_ERROR',
                        state: 'PARTIAL_FAILED',
                        nodeIndex: executionContext.nodeCounter,
                        totalNodes: executionContext.totalNodes,
                        progress: Math.round((executionContext.nodeCounter / executionContext.totalNodes) * 100),
                        error: {
                            code: 'TASK_TIMEOUT',
                            message: `任务超时（${taskDef.timeout}ms）`,
                            retryable: true
                        },
                        timestamp: Date.now(),
                        context: { ...executionContext.context }
                    });
                }
            });

            this.executeNode(
                taskDef.rootNode,
                executionContext,
                executionContext.context,
                0
            ).pipe(
                tap((progress) => {
                    progress$.next(progress);

                    if (progress.type === 'NODE_ERROR') {
                        executionContext.hasError = true;
                    }

                    // 用 nodeCounter 判断完成，nodeIndex 是起始索引不代表完成数
                    if (progress.type === 'NODE_COMPLETE' &&
                        executionContext.nodeCounter >= executionContext.totalNodes) {
                        loopTimeoutSub?.unsubscribe();

                        const finalState: TaskState = executionContext.hasError
                            ? 'PARTIAL_FAILED'
                            : 'COMPLETED';

                        progress$.next({
                            ...progress,
                            type: 'TASK_COMPLETE',
                            state: finalState,
                            progress: 100,
                            timestamp: Date.now(),
                            payload: {
                                loopCount: executionContext.context.loopCount,
                                purchasedProducts: executionContext.context.purchasedProducts,
                                totalPurchased: executionContext.context.purchasedProducts.length
                            }
                        });

                        if (!loop) {
                            // Issue-B fix：单次执行完成后主动 complete 流
                            progress$.complete();
                            return;
                        }

                        if (executionContext.state !== 'CANCELLED') {
                            timer(500).pipe(takeUntil(cancel$)).subscribe(() => executeLoop());
                        }
                    }
                }),
                takeUntil(cancel$)
            ).subscribe();
        };

        executeLoop();

        // cancel$ 只在这里订阅一次，统一处理取消逻辑
        cancel$.subscribe(() => {
            loopTimeoutSub?.unsubscribe();
            executionContext.state = 'CANCELLED';
            progress$.next({
                requestId,
                taskKey: taskDef.key,
                nodeKey: '',
                type: 'TASK_CANCEL',
                state: 'CANCELLED',
                nodeIndex: executionContext.nodeCounter,
                totalNodes: executionContext.totalNodes,
                progress: Math.round((executionContext.nodeCounter / executionContext.totalNodes) * 100),
                timestamp: Date.now(),
                context: { ...executionContext.context },
                payload: {
                    totalLoopCount: executionContext.context.loopCount,
                    totalPurchased: executionContext.context.purchasedProducts.length,
                    purchasedProducts: executionContext.context.purchasedProducts
                }
            });
            progress$.complete();
        });

        return {
            progress$: progress$.asObservable(),
            cancel: () => cancel$.next(),
        };
    }

    /**
     * 执行单个节点
     * Issue-D fix：argsScript 失败时补充 nodeCounter++，保证进度计算不卡死
     * Issue-E fix：引入节点级 nodeCancel$ 信号，超时时取消节点内部子流程，防止资源泄漏
     */
    private executeNode(
        node: TaskNode,
        executionContext: TaskExecutionContext,
        inputPayload: any,
        nodeIndex: number
    ): Observable<ProgressData> {
        const progress$ = new Subject<ProgressData>();
        const { requestId, taskKey, cancel$ } = executionContext;

        // Issue-E fix：节点级取消信号，超时或任务取消时同时触发，终止节点内部所有子流程
        const combinedCancel$ = new Subject<void>();
        // 任务取消或节点超时都会触发 combinedCancel$
        cancel$.subscribe(() => { if (!combinedCancel$.closed) combinedCancel$.next(); });

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

        progress$.next({ ...baseProgress, type: 'NODE_START' });

        const runMainFlow = () => {
            executeScriptAsObservable(
                node.argsScript,
                inputPayload,
                executionContext.context
            ).pipe(
                tap((scriptResult) => {
                    if (!scriptResult.success) {
                        // Issue-D fix：argsScript 失败时 nodeCounter++ 保证进度推进
                        executionContext.nodeCounter++;
                        progress$.next({
                            ...baseProgress,
                            type: 'NODE_ERROR',
                            state: 'PARTIAL_FAILED',
                            error: scriptResult.error,
                            timestamp: Date.now()
                        });
                        combinedCancel$.next();
                        progress$.complete();
                        return;
                    }

                    progress$.next({
                        ...baseProgress,
                        type: 'NODE_PROGRESS',
                        payload: { step: 'args_process_complete', data: scriptResult.data },
                        timestamp: Date.now()
                    });

                    if (node.type === 'flow' && node.nodes) {
                        this.executeFlowNodes(
                            node.nodes,
                            executionContext,
                            scriptResult.data,
                            nodeIndex,
                            combinedCancel$
                        ).pipe(
                            tap((flowProgress) => progress$.next(flowProgress)),
                            finalize(() => progress$.complete())
                        ).subscribe();
                    } else {
                        this.executeAtomicNode(
                            node,
                            executionContext,
                            scriptResult.data,
                            baseProgress,
                            combinedCancel$
                        ).pipe(
                            tap((atomicProgress) => progress$.next(atomicProgress)),
                            finalize(() => progress$.complete())
                        ).subscribe();
                    }
                }),
                catchError((err) => {
                    // Issue-D fix：兜底异常时也要 nodeCounter++
                    executionContext.nodeCounter++;
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
                    combinedCancel$.next();
                    progress$.complete();
                    return EMPTY;
                }),
                takeUntil(combinedCancel$)
            ).subscribe();
        };

        if (node.strategy.condition) {
            executeConditionScriptAsObservable(
                node.strategy.condition,
                inputPayload,
                executionContext.context
            ).pipe(
                tap((conditionResult) => {
                    progress$.next({
                        ...baseProgress,
                        type: 'CONDITION_CHECK',
                        payload: { conditionResult, inputPayload },
                        timestamp: Date.now()
                    });

                    if (!conditionResult) {
                        executionContext.nodeCounter++;
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
                        combinedCancel$.next();
                        progress$.complete();
                    } else {
                        runMainFlow();
                    }
                }),
                catchError(() => {
                    executionContext.nodeCounter++;
                    progress$.next({
                        ...baseProgress,
                        type: 'NODE_SKIP',
                        error: {
                            code: 'CONDITION_SCRIPT_ERROR',
                            message: `节点${node.key}条件检查失败，跳过`,
                            retryable: false
                        },
                        timestamp: Date.now()
                    });
                    combinedCancel$.next();
                    progress$.complete();
                    return EMPTY;
                }),
                takeUntil(combinedCancel$)
            ).subscribe();
        } else {
            runMainFlow();
        }

        // Issue-E fix：超时时触发 combinedCancel$，终止节点内所有子流程
        timer(node.timeout).pipe(
            takeUntil(combinedCancel$)
        ).subscribe(() => {
            if (!progress$.closed) {
                // Issue-D fix：超时时 nodeCounter++ 保证进度推进
                executionContext.nodeCounter++;
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
                combinedCancel$.next(); // 取消节点内所有子流程
                progress$.complete();
            }
        });

        return progress$.asObservable();
    }

    /**
     * 执行原子节点
     * Issue-F fix：消除 tap 内嵌套 subscribe，改用 switchMap 链式操作
     *             外层 catchError 可正确捕获 resultScript 的异常，takeUntil 统一控制整条链
     */
    private executeAtomicNode(
        node: TaskNode,
        executionContext: TaskExecutionContext,
        processedArgs: any,
        baseProgress: ProgressData,
        combinedCancel$: Subject<void>
    ): Observable<ProgressData> {
        const progress$ = new Subject<ProgressData>();
        let retryCount = 0;

        const execute = () => {
            const adapter = this.adapterManager.getAdapter(node.type);

            adapter.execute(processedArgs, executionContext).pipe(
                // Issue-F fix：用 switchMap 替代 tap 内嵌套 subscribe
                // 好处：resultScript 的异常可被外层 catchError 捕获；takeUntil 统一控制整条链
                switchMap((rawResult) => {
                    if (rawResult?.error) {
                        throw new Error(JSON.stringify(rawResult.error));
                    }

                    progress$.next({
                        ...baseProgress,
                        type: 'NODE_PROGRESS',
                        payload: { step: 'atom_execute_complete', data: rawResult },
                        timestamp: Date.now()
                    });

                    return executeScriptAsObservable(
                        node.resultScript,
                        rawResult,
                        executionContext.context
                    );
                }),
                tap((resultScriptResult) => {
                    if (!resultScriptResult.success) {
                        this.handleNodeError(
                            node,
                            executionContext,
                            resultScriptResult.error ?? {
                                code: 'RESULT_SCRIPT_ERROR',
                                message: '结果脚本执行失败',
                                retryable: false
                            },
                            baseProgress,
                            progress$
                        );
                        return;
                    }

                    executionContext.context[node.key] = resultScriptResult.data;
                    executionContext.nodeCounter++;

                    if (node.key === 'scan_barcode' && resultScriptResult.data?.barcode) {
                        executionContext.context.lastBarcode = resultScriptResult.data.barcode;
                    }

                    progress$.next({
                        ...baseProgress,
                        type: 'NODE_COMPLETE',
                        state: 'RUNNING',
                        progress: Math.round(((baseProgress.nodeIndex + 1) / baseProgress.totalNodes) * 100),
                        payload: resultScriptResult.data,
                        timestamp: Date.now()
                    });
                    progress$.complete();
                }),
                catchError((err) => {
                    let errorObj;
                    try {
                        errorObj = JSON.parse(err.message);
                    } catch {
                        errorObj = {
                            code: 'ATOM_EXEC_ERROR',
                            message: err?.message || '原子执行失败',
                            retryable: node.strategy.errorStrategy === 'retry'
                        };
                    }

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

                        timer(node.strategy.retry.interval || 1000).pipe(
                            takeUntil(combinedCancel$)
                        ).subscribe(() => execute());
                        return EMPTY;
                    }

                    this.handleNodeError(node, executionContext, errorObj, baseProgress, progress$);
                    return EMPTY;
                }),
                takeUntil(combinedCancel$)
            ).subscribe();
        };

        execute();

        return progress$.asObservable();
    }

    /**
     * 处理节点错误
     * Issue-I 确认：Subject.complete() 是幂等的，compensate 路径下多次 complete 不会报错
     */
    private handleNodeError(
        node: TaskNode,
        executionContext: TaskExecutionContext,
        error: any,
        baseProgress: ProgressData,
        progress$: Subject<ProgressData>
    ): void {
        const errorObj = typeof error === 'object' && error !== null ? error : {
            code: 'UNKNOWN_ERROR',
            message: String(error),
            retryable: false
        };

        progress$.next({
            ...baseProgress,
            type: 'NODE_ERROR',
            state: 'PARTIAL_FAILED',
            error: errorObj,
            timestamp: Date.now()
        });

        switch (node.strategy.errorStrategy) {
            case 'skip':
                executionContext.nodeCounter++;
                progress$.complete();
                break;

            case 'compensate': {
                const compNode = node.nodes?.find(n => n.key === node.strategy.compensationNode);
                if (compNode) {
                    progress$.next({
                        ...baseProgress,
                        type: 'COMPENSATION',
                        payload: { compensationNode: compNode.key },
                        timestamp: Date.now()
                    });

                    // 补偿节点复用父节点的 combinedCancel$（通过 executionContext.cancel$ 传递）
                    // 补偿节点执行成功/失败时，其内部已经 nodeCounter++，这里不再重复递增
                    this.executeNode(
                        compNode,
                        executionContext,
                        { error: errorObj, context: executionContext.context },
                        baseProgress.nodeIndex + 1
                    ).pipe(
                        tap((compProgress) => progress$.next(compProgress)),
                        finalize(() => progress$.complete())
                    ).subscribe();
                } else {
                    // 无补偿节点：降级为 skip
                    executionContext.nodeCounter++;
                    progress$.complete();
                }
                break;
            }

            default:
                executionContext.nodeCounter++;
                progress$.complete();
                break;
        }
    }

    /**
     * 执行流程节点（串行执行子节点）
     * Issue-E fix：接收 combinedCancel$ 参数，超时时可终止子节点链
     */
    private executeFlowNodes(
        nodes: TaskNode[],
        executionContext: TaskExecutionContext,
        inputPayload: any,
        _startIndex: number,
        combinedCancel$: Subject<void>
    ): Observable<ProgressData> {
        const progress$ = new Subject<ProgressData>();
        let currentPayload = inputPayload;

        of(...nodes).pipe(
            concatMap((node) => {
                const nodeIndex = executionContext.nodeCounter;
                return this.executeNode(
                    node,
                    executionContext,
                    currentPayload,
                    nodeIndex
                ).pipe(
                    tap((progress) => {
                        progress$.next(progress);
                        if (progress.type === 'NODE_COMPLETE') {
                            currentPayload = progress.payload;
                        }
                    })
                );
            }),
            finalize(() => progress$.complete()),
            takeUntil(combinedCancel$)
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

