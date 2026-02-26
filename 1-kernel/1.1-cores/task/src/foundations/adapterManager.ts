import {Observable} from "rxjs";
import {TaskAdapter,TaskType} from "../types";

/**
 * 原子任务适配器管理器
 */
export class AdapterManager {
    private adapters = new Map<TaskType, TaskAdapter>();

    /**
     * 注册适配器
     */
    registerAdapter(adapter: TaskAdapter): void {
        this.adapters.set(adapter.type, adapter);
    }

    /**
     * 获取适配器（永不抛出异常）
     */
    getAdapter(type: TaskType): TaskAdapter {
        const adapter = this.adapters.get(type);
        if (!adapter) {
            // 返回默认空适配器，避免抛出异常
            return {
                type,
                execute: (args, context) => {
                    return new Observable((subscriber) => {
                        subscriber.next({
                            success: false,
                            error: {
                                code: 'ADAPTER_NOT_FOUND',
                                message: `未找到类型为${type}的适配器`,
                                retryable: false
                            }
                        });
                        subscriber.complete();
                    });
                }
            };
        }
        return adapter;
    }

    /**
     * 清除所有适配器
     */
    clearAdapters(): void {
        this.adapters.clear();
    }
}