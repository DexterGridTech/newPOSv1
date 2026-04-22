/** 任务类型枚举 */
export type TaskType = 'command' | 'flow' | 'externalCall' | 'externalOn' | 'externalSubscribe';
/** 过程数据类型枚举（核心，替代日志/异常） */
export type ProgressType = 'TASK_INIT' | 'NODE_START' | 'NODE_PROGRESS' | 'NODE_COMPLETE' | 'NODE_SKIP' | 'NODE_ERROR' | 'NODE_RETRY' | 'CONDITION_CHECK' | 'COMPENSATION' | 'TASK_COMPLETE' | 'TASK_CANCEL';
/** 任务状态枚举 */
export type TaskState = 'INIT' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL_FAILED';
/** 节点执行策略 */
export type NodeStrategy = {
    condition?: string;
    skipMessage?: string;
    errorStrategy: 'retry' | 'skip' | 'compensate';
    retry?: {
        times: number;
        interval: number;
    };
    compensationNode?: string;
};
/** 任务节点定义（最小执行单元） */
export interface TaskNode {
    key: string;
    name: string;
    type: TaskType;
    strategy: NodeStrategy;
    argsScript: string;
    resultScript: string;
    nodes?: TaskNode[];
    timeout: number;
}
/** 归一化任务定义（无父子区分，全节点化） */
export interface TaskDefinition {
    id?: string;
    testContext?: Record<string, any>;
    key: string;
    name: string;
    rootNode: TaskNode;
    timeout: number;
    enabled: boolean;
    operatingSystems?: {
        os: string;
        osVersion: string;
    }[] | null;
}
/** 任务定义注册器接口 */
export interface TaskDefinitionRegister {
    registerTaskDefinition(taskDefinition: TaskDefinition): void;
}
/** 任务定义注册器集合 */
export declare const taskDefinitionRegisters: TaskDefinitionRegister[];
export declare const addTaskDefinitionRegister: (register: TaskDefinitionRegister) => number;
//# sourceMappingURL=taskSystem.d.ts.map