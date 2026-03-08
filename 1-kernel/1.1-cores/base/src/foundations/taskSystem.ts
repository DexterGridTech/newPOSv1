/** 任务类型枚举 */
export type TaskType = 'command' | 'flow' | 'externalCall' | 'externalOn' | 'externalSubscribe';

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

    operatingSystems?: {
        os: string,
        osVersion: string,
    }[] | null;

}

/** 任务定义注册器接口 */
export interface TaskDefinitionRegister {
    registerTaskDefinition(taskDefinition: TaskDefinition): void;
}

/** 任务定义注册器集合 */
export const taskDefinitionRegisters: TaskDefinitionRegister[] = [];

export const addTaskDefinitionRegister = (register: TaskDefinitionRegister) => taskDefinitionRegisters.push(register);