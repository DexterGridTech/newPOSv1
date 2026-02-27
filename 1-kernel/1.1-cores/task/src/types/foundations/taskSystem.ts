import { Observable, Subject } from 'rxjs';

/** 任务类型枚举 */
export type TaskType = 'command' | 'flow';

/** 过程数据类型枚举（核心，替代日志/异常） */
export type ProgressType =
    | 'TASK_INIT'        // 任务初始化
    | 'NODE_START'       // 节点开始
    | 'NODE_PROGRESS'    // 节点执行中
    | 'NODE_COMPLETE'    // 节点完成
    | 'NODE_SKIP'        // 节点跳过
    | 'NODE_ERROR'       // 节点错误（所有异常均为此类型）
    | 'NODE_RETRY'       // 节点重试
    | 'CONDITION_CHECK'  // 条件检查
    | 'COMPENSATION'     // 补偿执行
    | 'TASK_COMPLETE'    // 单次任务完成
    | 'TASK_CANCEL';     // 任务取消

/** 任务状态枚举 */
export type TaskState = 'INIT' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL_FAILED';

/** 节点执行策略 */
export type NodeStrategy = {
    // 条件脚本：返回 boolean，true 执行节点，false 跳过
    condition?: string;
    // 跳过节点时的提示信息
    skipMessage?: string;
    // 错误处理策略：retry/skip/compensate（无abort，避免终止流）
    errorStrategy: 'retry' | 'skip' | 'compensate';
    // 重试配置
    retry?: { times: number; interval: number };
    // 补偿节点Key（errorStrategy=compensate 时生效）
    compensationNode?: string;
};

/** 任务节点定义（最小执行单元） */
export interface TaskNode {
    // 节点唯一标识
    key: string;
    // 节点名称
    name: string;
    // 节点类型（原子操作/流程）
    type: TaskType;
    // 节点执行策略（条件/错误处理）
    strategy: NodeStrategy;
    // 参数处理脚本（Hermes执行，入参：上一节点输出 + 全局上下文）
    argsScript: string;
    // 结果处理脚本（Hermes执行，入参：节点原始结果）
    resultScript: string;
    // 子节点（仅 type=flow 时生效，实现流程编排）
    nodes?: TaskNode[];
    // 节点超时时间（ms）
    timeout: number;
}

/** 归一化任务定义（无父子区分，全节点化） */
export interface TaskDefinition {
    id?: string;
    testContext?: Record<string, any>;
    // 任务唯一标识
    key: string;
    // 任务名称
    name: string;
    // 任务根节点（所有流程从根节点开始）
    rootNode: TaskNode;
    // 全局超时时间
    timeout: number;
    // 是否启用
    enabled: boolean;
}

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