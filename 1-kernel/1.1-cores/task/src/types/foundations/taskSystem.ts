import {Observable, Subject} from 'rxjs';
import {ProgressType, TaskState,TaskType} from "@impos2/kernel-core-base";

/** 过程数据核心结构（流式推送的唯一载体，包含所有错误） */
export interface ProgressData {
    // 全局请求ID
    requestId: string;
    // 当前任务Key
    taskKey: string;
    // 当前节点Key
    nodeKey: string;
    // 过程数据类型
    type: ProgressType;
    // 任务状态
    state: TaskState;
    // 节点执行索引（流程节点下生效）
    nodeIndex: number;
    // 总节点数（流程节点下生效）
    totalNodes: number;
    // 执行进度（0-100）
    progress: number;
    // 时间戳
    timestamp: number;
    // 业务数据载荷（节点执行结果/过程数据）
    payload?: any;
    // 错误信息（所有异常均封装于此，永不抛出）
    error?: {
        code: string;
        message: string;
        retryable: boolean;
        stack?: string;
    };
    // 全局共享上下文（所有节点可读写）
    context: Record<string, any>;
}

/** 任务执行上下文（单次请求） */
export interface TaskExecutionContext {
    requestId: string;
    taskKey: string;
    // 全局共享数据
    context: Record<string, any>;
    // 取消信号（仅通知，不终止流）
    cancel$: Subject<void>;
    // 任务状态
    state: TaskState;
    // 节点执行计数
    nodeCounter: number;
    // 总节点数
    totalNodes: number;
    // 错误标记（用于统计失败节点）
    hasError: boolean;
}

/** 原子任务适配器接口（归一化适配，永不抛出异常） */
export interface TaskAdapter {
    type: TaskType;
    execute: (args: any, context: TaskExecutionContext) => Observable<any>;
}

/** 任务会话：executeTask 的返回值，持有进度流和取消句柄 */
export interface TaskSession {
    // 进度数据流
    progress$: Observable<ProgressData>;
    // 取消当前会话（触发内部 cancel$，通知所有适配器和子流程）
    cancel: () => void;
}