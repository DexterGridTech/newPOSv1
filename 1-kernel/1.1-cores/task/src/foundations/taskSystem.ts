import { Observable } from 'rxjs';
import {
    TaskDefinition,
    ProgressData,
    TaskAdapter,
} from '../types';
import { AdapterManager } from './adapterManager';
import { StreamTaskExecutor } from './streamTaskExecutor';
import {CommandTaskAdapter, ExternalCallTaskAdapter, ExternalSubscribeTaskAdapter, ExternalOnTaskAdapter} from "./taskAdapter";
import {getTaskDefinitionFromState} from "./accessory";
import {LOG_TAGS, logger} from "@impos2/kernel-core-base";
import {moduleName} from "../moduleName";
import {singleReadBarCodeFromCamera} from "./taskDefinitions";

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

    private constructor() {
        this.registerAdapter(new CommandTaskAdapter());
        this.registerAdapter(new ExternalCallTaskAdapter());
        this.registerAdapter(new ExternalSubscribeTaskAdapter());
        this.registerAdapter(new ExternalOnTaskAdapter());
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): TaskSystem {
        if (!TaskSystem.instance) {
            TaskSystem.instance = new TaskSystem();
            TaskSystem.instance.registerTasks([
                singleReadBarCodeFromCamera
            ])
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

    getTaskDefinition(key: string): TaskDefinition | undefined {
        return getTaskDefinitionFromState(key)??this.taskRegistry.get(key);
    }

    /**
     * 获取任务执行入口（核心流式入口，支持循环执行）
     */
    task(key: string): {
        run: (requestId: string, initialContext?: Record<string, any>, loop?: boolean) => Observable<ProgressData>
    } {
        const taskDef = this.getTaskDefinition(key);
        if (!taskDef) {
            logger.error([moduleName,LOG_TAGS.Task,"TaskSystem"],`任务${key}未注册`)
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
                console.log(`[${requestId}] TaskSystem.run called, loop=${loop}`);
                const session = this.executor.executeTask(taskDef, requestId, initialContext, loop);
                // 注册 cancel 句柄，流结束（complete/error）时自动清理
                this.runningTasks.set(requestId, session.cancel);
                console.log(`[${requestId}] registered in runningTasks, size=${this.runningTasks.size}`);
                return new Observable<ProgressData>((subscriber) => {
                    const sub = session.progress$.subscribe({
                        next: (v) => {
                            console.log(`[${requestId}] progress event: type=${v.type}, state=${v.state}`);
                            subscriber.next(v);
                        },
                        error: (e) => {
                            console.log(`[${requestId}] progress error, deleting from runningTasks`);
                            this.runningTasks.delete(requestId);
                            subscriber.error(e);
                        },
                        complete: () => {
                            console.log(`[${requestId}] progress complete, deleting from runningTasks, size before=${this.runningTasks.size}`);
                            this.runningTasks.delete(requestId);
                            console.log(`[${requestId}] runningTasks size after=${this.runningTasks.size}`);
                            subscriber.complete();
                        },
                    });
                    return () => {
                        console.log(`[${requestId}] Observable teardown, calling cancel if exists`);
                        sub.unsubscribe();
                        // 外部 unsubscribe 时，同步触发内部取消，避免内部流程继续运行
                        const cancelFn = this.runningTasks.get(requestId);
                        if (cancelFn) {
                            console.log(`[${requestId}] calling cancelFn`);
                            cancelFn();
                        }
                    };
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
