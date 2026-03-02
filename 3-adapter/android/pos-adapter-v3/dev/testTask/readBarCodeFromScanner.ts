import {TaskDefinition} from '@impos2/kernel-core-task'

export const readBarCodeFromScanner: TaskDefinition = {
    key: 'readBarCodeFromScanner',
    name: 'USB 扫码枪扫码',
    timeout: 30000,
    enabled: true,
    testContext: {bagId: 'test-bag-001'},
    rootNode: {
        key: 'root',
        name: '主流程',
        type: 'flow',
        timeout: 30000,
        strategy: {errorStrategy: 'skip'},
        argsScript: `return params`,
        resultScript: `return params`,
        nodes: [
            {
                key: 'scan',
                name: '监听扫码枪数据',
                type: 'externalSubscribe',
                timeout: 29000,
                strategy: {errorStrategy: 'skip'},
                argsScript: `
                    return {
                        channel: { type: 'HID', target: 'keyboard', mode: 'stream' }
                    }
                `,
                resultScript: `
                    if (!params || params.data === null || params.data === undefined) {
                        return { $error: '扫码枪数据为空或设备异常' }
                    }
                    var text = params.data && params.data.text ? params.data.text : (params.raw || '')
                    return {
                        barcode: text,
                        raw: params.raw || '',
                        source: params.target,
                        timestamp: params.timestamp
                    }
                `,
            },
            {
                key: 'open',
                name: '开门',
                type: 'command',
                timeout: 5000,
                strategy: {
                    errorStrategy: 'skip',
                    condition: `return !!scan`,
                    skipMessage: '扫码未成功，跳过 open',
                },
                argsScript: `
                    return {
                        commandName: 'kernel.core.task.open',
                        payload: { key: scan.barcode }
                    }
                `,
                resultScript: `
                    if (params.status === 'error') {
                        return { $error: 'open failed: ' + (params.errors && params.errors[Object.keys(params.errors)[0]] && params.errors[Object.keys(params.errors)[0]].message || JSON.stringify(params.errors)) }
                    }
                    return params.results
                `,
            },
            {
                key: 'run',
                name: '执行 run',
                type: 'command',
                timeout: 5000,
                strategy: {
                    errorStrategy: 'skip',
                    condition: `return !!scan && typeof open === 'undefined'`,
                    skipMessage: '跳过 run',
                },
                argsScript: `
                    return {
                        commandName: 'kernel.core.task.run',
                        payload: { key: scan.barcode }
                    }
                `,
                resultScript: `
                    if (params.status === 'error') {
                        return { $error: 'run failed: ' + (params.errors && params.errors[Object.keys(params.errors)[0]] && params.errors[Object.keys(params.errors)[0]].message || JSON.stringify(params.errors)) }
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
                    condition: `return !!(open && open.placeId)`,
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
                        return { $error: 'take failed: ' + (params.errors && params.errors[Object.keys(params.errors)[0]] && params.errors[Object.keys(params.errors)[0]].message || JSON.stringify(params.errors)) }
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
                    condition: `return !!(open && open.placeId)`,
                    skipMessage: 'open 未成功，跳过 close',
                },
                argsScript: `
                    return {
                        commandName: 'kernel.core.task.close',
                        payload: { placeId: open.placeId }
                    }
                `,
                resultScript: `
                    if (params.status === 'error') {
                        return { $error: 'close failed: ' + (params.errors && params.errors[Object.keys(params.errors)[0]] && params.errors[Object.keys(params.errors)[0]].message || JSON.stringify(params.errors)) }
                    }
                    return params.results
                `,
            },
        ],
    },
}
