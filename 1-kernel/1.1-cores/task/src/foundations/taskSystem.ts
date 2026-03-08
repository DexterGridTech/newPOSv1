import {Observable} from 'rxjs';
import {ProgressData, TaskAdapter,} from '../types';
import {LOG_TAGS, logger, TaskDefinition,} from "@impos2/kernel-core-base";
import {AdapterManager} from './adapterManager';
import {StreamTaskExecutor} from './streamTaskExecutor';
import {
    CommandTaskAdapter,
    ExternalCallTaskAdapter,
    ExternalOnTaskAdapter,
    ExternalSubscribeTaskAdapter
} from "./taskAdapter";
import {getTaskDefinitionFromState} from "./accessory";
import {moduleName} from "../moduleName";

/**
 * TaskSystem 核心入口（单例，无异常+循环执行版本）
 */
export class TaskSystem {
    private operatingSystem: {
        os: string,
        osVersion: string,
    } | null = null;
    private static instance: TaskSystem;
    private taskRegistry = new Map<string, TaskDefinition[]>();
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

    public setOperatingSystem(os: string, osVersion: string) {
        this.operatingSystem = {
            os,
            osVersion
        }
    }

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
        const existing = this.taskRegistry.get(taskDef.key) || [];
        if (taskDef.id) {
            const index = existing.findIndex(t => t.id === taskDef.id);
            if (index !== -1) {
                existing[index] = taskDef;
            } else {
                existing.push(taskDef);
            }
        } else {
            existing.push(taskDef);
        }
        this.taskRegistry.set(taskDef.key, existing);
    }

    /**
     * 批量注册任务
     */
    registerTasks(taskDefs: TaskDefinition[]): void {
        taskDefs.forEach(def => this.registerTask(def));
    }

    /**
     * 注册自定义适配器
     */
    registerAdapter(adapter: TaskAdapter): void {
        this.adapterManager.registerAdapter(adapter);
    }

    getTaskDefinition(key: string): TaskDefinition | undefined {
        const fromState = getTaskDefinitionFromState(key);
        if (fromState) return fromState;

        const defs = this.taskRegistry.get(key);
        if (!defs || defs.length === 0) return undefined;

        if (this.operatingSystem) {
            const matched = defs.find(d =>
                d.operatingSystems?.some(os =>
                    os.os === this.operatingSystem!.os &&
                    os.osVersion === this.operatingSystem!.osVersion
                )
            );
            if (matched) return matched;
        }

        return defs.find(d => !d.operatingSystems || d.operatingSystems.length === 0) || undefined;
    }

    /**
     * 获取任务执行入口（核心流式入口，支持循环执行）
     */
    task(key: string): {
        run: (requestId: string, initialContext?: Record<string, any>, loop?: boolean) => Observable<ProgressData>
    } {
        const taskDef = this.getTaskDefinition(key);
        if (!taskDef) {
            logger.error([moduleName, LOG_TAGS.Task, "TaskSystem"], `任务${key}未注册`)
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
                logger.log([moduleName, LOG_TAGS.Task, "TaskSystem"], `任务开始执行 requestId=${requestId}, loop=${loop}`);
                const session = this.executor.executeTask(taskDef, requestId, initialContext, loop);
                // 注册 cancel 句柄，流结束（complete/error）时自动清理
                this.runningTasks.set(requestId, session.cancel);
                return new Observable<ProgressData>((subscriber) => {
                    const sub = session.progress$.subscribe({
                        next: (v) => subscriber.next(v),
                        error: (e) => {
                            this.runningTasks.delete(requestId);
                            logger.error([moduleName, LOG_TAGS.Task, "TaskSystem"], `任务执行异常 requestId=${requestId}`, e);
                            subscriber.error(e);
                        },
                        complete: () => {
                            this.runningTasks.delete(requestId);
                            logger.log([moduleName, LOG_TAGS.Task, "TaskSystem"], `任务执行完成 requestId=${requestId}`);
                            subscriber.complete();
                        },
                    });
                    return () => {
                        sub.unsubscribe();
                        // 外部 unsubscribe 时，同步触发内部取消，避免内部流程继续运行
                        const cancelFn = this.runningTasks.get(requestId);
                        if (cancelFn) {
                            logger.warn([moduleName, LOG_TAGS.Task, "TaskSystem"], `任务被外部取消 requestId=${requestId}`);
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
            logger.warn([moduleName, LOG_TAGS.Task, "TaskSystem"], `任务取消请求 requestId=${requestId}`);
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
