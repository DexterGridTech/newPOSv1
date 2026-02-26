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
 * TaskSystem 核心入口（单例，无异常版本）
 */
export class TaskSystem {
    private static instance: TaskSystem;
    private taskRegistry = new Map<string, TaskDefinition>();
    private adapterManager = new AdapterManager();
    private executor = new StreamTaskExecutor(this.adapterManager);

    private constructor() {
        // 注册默认适配器
        this.registerDefaultAdapters();
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
     * 注册默认适配器（永不抛出异常）
     * 注意：这些是框架内置的通用适配器，业务适配器应通过 registerAdapter() 注入
     */
    private registerDefaultAdapters(): void {
        // 扫码枪适配器（externalCall）
        this.adapterManager.registerAdapter({
            type: 'externalCall',
            execute: (args, context) => {
                return new Observable((subscriber) => {
                    const timeout = setTimeout(() => {
                        if (args.deviceId === 'invalid') {
                            subscriber.next({ error: { code: 'DEVICE_ERROR', message: '扫码设备未连接', retryable: true } });
                        } else {
                            subscriber.next({ barcode: '6901234567890', deviceId: args.deviceId || 'scan_gun_001', success: true });
                        }
                        subscriber.complete();
                    }, args.timeout || 5000);

                    // 使用 teardown 函数管理 cancel$ 订阅，避免泄漏
                    const cancelSub = context.cancel$.subscribe(() => {
                        clearTimeout(timeout);
                        if (!subscriber.closed) {
                            subscriber.next({ error: { code: 'TASK_CANCELLED', message: '扫码任务已取消', retryable: false } });
                            subscriber.complete();
                        }
                    });
                    return () => {
                        clearTimeout(timeout);
                        cancelSub.unsubscribe();
                    };
                });
            }
        });

        // HTTP 适配器
        this.adapterManager.registerAdapter({
            type: 'http',
            execute: (args, context) => {
                return new Observable((subscriber) => {
                    const timeout = setTimeout(() => {
                        let result;
                        if (args.url.includes('product/detail') && args.params?.barcode === 'invalid') {
                            result = { success: false, error: { code: 'PRODUCT_NOT_FOUND', message: '商品不存在', retryable: false } };
                        } else if (args.url.includes('stock/lock') && args.params?.productId === 'prod_999') {
                            result = { success: false, error: { code: 'STOCK_LOCK_FAILED', message: '商品无库存', retryable: false } };
                        } else if (args.url.includes('product/detail')) {
                            result = { success: true, data: { id: 'prod_123', name: '测试商品', price: 99.9, stock: 100, barcode: args.params?.barcode } };
                        } else if (args.url.includes('stock/lock')) {
                            result = { success: true, data: { lockId: `lock_${Date.now()}`, productId: args.params?.productId, quantity: 1 } };
                        } else if (args.url.includes('stock/unlock')) {
                            result = { success: true, data: { lockId: args.params?.lockId, status: 'unlocked' } };
                        } else {
                            result = { success: true, data: {} };
                        }
                        subscriber.next(result);
                        subscriber.complete();
                    }, 1500);

                    const cancelSub = context.cancel$.subscribe(() => {
                        clearTimeout(timeout);
                        if (!subscriber.closed) {
                            subscriber.next({ error: { code: 'TASK_CANCELLED', message: 'HTTP请求已取消', retryable: false } });
                            subscriber.complete();
                        }
                    });
                    return () => {
                        clearTimeout(timeout);
                        cancelSub.unsubscribe();
                    };
                });
            }
        });

        // 命令适配器
        this.adapterManager.registerAdapter({
            type: 'command',
            execute: (args, context) => {
                return new Observable((subscriber) => {
                    const timeout = setTimeout(() => {
                        if (args.params?.userId === 'user_invalid') {
                            subscriber.next({ error: { code: 'PERMISSION_DENIED', message: '用户无购买权限', retryable: false } });
                        } else {
                            subscriber.next({ success: true, data: { cartId: `cart_${Date.now()}`, productId: args.params?.productId, quantity: 1 } });
                        }
                        subscriber.complete();
                    }, 1000);

                    const cancelSub = context.cancel$.subscribe(() => {
                        clearTimeout(timeout);
                        if (!subscriber.closed) {
                            subscriber.next({ error: { code: 'TASK_CANCELLED', message: '命令执行已取消', retryable: false } });
                            subscriber.complete();
                        }
                    });
                    return () => {
                        clearTimeout(timeout);
                        cancelSub.unsubscribe();
                    };
                });
            }
        });
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
     * 获取任务Observable（核心流式入口，永不抛出异常）
     */
    task(key: string): {
        run: (requestId: string, initialContext?: Record<string, any>) => Observable<ProgressData>
    } {
        const taskDef = this.taskRegistry.get(key);
        if (!taskDef) {
            // 返回空Observable，不抛出异常
            return {
                run: (requestId: string, initialContext?: Record<string, any>) => {
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
                        subscriber.complete();
                    });
                }
            };
        }

        return {
            run: (requestId: string, initialContext: Record<string, any> = {}) => {
                return this.executor.executeTask(taskDef, requestId, initialContext);
            }
        };
    }

    /**
     * 清空所有任务
     */
    clearTasks(): void {
        this.taskRegistry.clear();
    }
}