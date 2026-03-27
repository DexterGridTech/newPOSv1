import {TaskDefinition} from "../src/types";

/**
 * 测试任务：open → take → close
 *
 * 脚本约定（devScriptsExecution）：
 *   - argsScript：params = 上一节点输出，globals = context 各字段（直接用变量名访问，不加 context.）
 *   - resultScript：params = adapter 原始返回值，globals = context 各字段
 *   - condition：globals = context 各字段
 *
 * 初始 context 需传入：{ key: string, bagId: string }
 *
 * 遇错停止策略：
 *   open 成功后 executor 自动将 resultScript 返回值写入 context.open
 *   take/close 的 condition 检查 open 变量是否存在，open 失败则跳过后续节点
 */
export const testTaskDefinition1: TaskDefinition = {
    key: 'open_take_close',
    name: '开门取包关门',
    timeout: 15000,
    enabled: true,
    rootNode: {
        key: 'root',
        name: '主流程',
        type: 'flow',
        timeout: 15000,
        strategy: {
            errorStrategy: 'skip',
        },
        argsScript: `return params`,
        resultScript: `return params`,
        nodes: [
            {
                key: 'open',
                name: '开门',
                type: 'command',
                timeout: 5000,
                strategy: {
                    errorStrategy: 'skip',
                },
                // 从 context 取 key 作为 payload
                // globals 注入了 context 的所有字段，直接用变量名访问
                argsScript: `
                    return {
                        commandName: 'kernel.core.task.open',
                        payload: { key: key }
                    }
                `,
                // params = CommandRequestStatus
                // executor 会把返回值自动写入 context.open，供后续 condition 判断
                resultScript: `
                    if (params.status === 'error') {
                        throw new Error('open failed: ' + JSON.stringify(params.errors))
                    }
                    return params.results
                `,
            },
            {
                key: 'take',
                name: '取包',
                type: 'command',
                timeout: 5000,
                strategy: {
                    errorStrategy: 'skip',
                    condition: `return !!open`,
                    skipMessage: 'open 未成功，跳过 take',
                },
                argsScript: `
                    return {
                        commandName: 'kernel.core.task.take',
                        payload: { bagId: bagId }
                    }
                `,
                resultScript: `
                    if (params.status === 'error') {
                        throw new Error('take failed: ' + JSON.stringify(params.errors))
                    }
                    return params.results
                `,
            },
            {
                key: 'close',
                name: '关门',
                type: 'command',
                timeout: 5000,
                strategy: {
                    errorStrategy: 'skip',
                    condition: `return !!open`,
                    skipMessage: 'open 未成功，跳过 close',
                },
                argsScript: `
                    return {
                        commandName: 'kernel.core.task.close',
                        payload: null
                    }
                `,
                resultScript: `
                    if (params.status === 'error') {
                        throw new Error('close failed: ' + JSON.stringify(params.errors))
                    }
                    return params.results
                `,
            },
        ],
    },
};
