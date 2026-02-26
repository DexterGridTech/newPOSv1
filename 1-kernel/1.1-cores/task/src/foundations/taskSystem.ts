import { Observable } from 'rxjs';
import {
    TaskDefinition,
    ProgressData,
    TaskAdapter,
    TaskType
} from '../types';
import { AdapterManager } from './adapterManager';
import { StreamTaskExecutor } from './streamTaskExecutor';

/**
 * TaskSystem 核心入口（单例，无异常+循环执行版本）
 */
export class TaskSystem {
    private static instance: TaskSystem;
    private taskRegistry = new Map<string, TaskDefinition>();
    private adapterManager = new AdapterManager();
    private executor = new StreamTaskExecutor(this.adapterManager);
    // requestId → cancel 句柄，用于支持 cancel(requestId)
    private runningTasks = new Map<string, () => void>();

    private constructor() {}

    /**
     * 获取单例实例
     */
    public static getInstance(): TaskSystem {
        if (!TaskSystem.instance) {
            TaskSystem.instance = new TaskSystem();
        }
        return TaskSystem.instance;
    }

    /**
     * 注册任务定义
     */
    registerTask(taskDef: TaskDefinition): void {
        if (!taskDef.enabled) return;
        this.taskRegistry.set(taskDef.key, taskDef);
    }

    /**
     * 批量注册任务
     */
    registerTasks(taskDefs: TaskDefinition[]): void {
        taskDefs.forEach(def => this.registerTask(def));
    }

    /**
     * 移除任务
     */
    unregisterTask(key: string): void {
        this.taskRegistry.delete(key);
    }

    /**
     * 注册自定义适配器
     */
    registerAdapter(adapter: TaskAdapter): void {
        this.adapterManager.registerAdapter(adapter);
    }

    /**
     * 获取任务执行入口（核心流式入口，支持循环执行）
     */
    task(key: string): {
        run: (requestId: string, initialContext?: Record<string, any>, loop?: boolean) => Observable<ProgressData>
    } {
        const taskDef = this.taskRegistry.get(key);
        if (!taskDef) {
            return {
                run: (requestId: string, initialContext?: Record<string, any>, loop = true) => {
                    return new Observable((subscriber) => {
                        subscriber.next({
                            requestId,
                            taskKey: key,
                            nodeKey: '',
                            type: 'NODE_ERROR',
                            state: 'PARTIAL_FAILED',
                            nodeIndex: 0,
                            totalNodes: 0,
                            progress: 0,
                            timestamp: Date.now(),
                            error: {
                                code: 'TASK_NOT_FOUND',
                                message: `任务${key}未注册`,
                                retryable: false
                            },
                            context: initialContext || {}
                        });
                        if (!loop) {
                            subscriber.complete();
                        }
                    });
                }
            };
        }

        return {
            run: (requestId: string, initialContext: Record<string, any> = {}, loop = true) => {
                const session = this.executor.executeTask(taskDef, requestId, initialContext, loop);
                // 注册 cancel 句柄，流结束（complete/error）时自动清理
                this.runningTasks.set(requestId, session.cancel);
                return new Observable<ProgressData>((subscriber) => {
                    const sub = session.progress$.subscribe({
                        next: (v) => subscriber.next(v),
                        error: (e) => { this.runningTasks.delete(requestId); subscriber.error(e); },
                        complete: () => { this.runningTasks.delete(requestId); subscriber.complete(); },
                    });
                    return () => sub.unsubscribe();
                });
            }
        };
    }

    /**
     * 取消指定会话（通知内部 cancel$，适配器和子流程均会收到取消信号）
     * @param requestId 由业务侧调用 run() 时传入的请求ID
     */
    cancel(requestId: string): void {
        const cancelFn = this.runningTasks.get(requestId);
        if (cancelFn) {
            cancelFn();
            // cancel 句柄触发后，流会推送 TASK_CANCEL 并 complete，complete 回调会自动清理
        }
    }

    /**
     * 清空所有任务
     */
    clearTasks(): void {
        this.taskRegistry.clear();
    }
}
