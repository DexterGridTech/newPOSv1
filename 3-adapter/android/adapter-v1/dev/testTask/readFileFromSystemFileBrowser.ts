import {TaskDefinition} from '@impos2/kernel-core-task'

export const readFileFromSystemFileBrowser: TaskDefinition = {
    key: 'readFileFromSystemFileBrowser',
    name: '系统文件选择器',
    timeout: 60000,
    enabled: true,
    testContext: {},
    rootNode: {
        key: 'root',
        name: '主流程',
        type: 'flow',
        timeout: 60000,
        strategy: {errorStrategy: 'skip'},
        argsScript: `return params`,
        resultScript: `return params`,
        nodes: [
            {
                key: 'selectFile',
                name: '选择文件',
                type: 'externalCall',
                timeout: 59000,
                strategy: {errorStrategy: 'skip'},
                argsScript: `
                    return {
                        channel: { type: 'INTENT', target: 'system', mode: 'request-response' },
                        action: 'android.intent.action.OPEN_DOCUMENT',
                        params: {
                            waitResult: true,
                            systemIntent: true,
                            type: '*/*',
                            category: 'android.intent.category.OPENABLE'
                        },
                        timeout: 59000
                    }
                `,
                resultScript: `
                    if (!params || !params.success) {
                        return { $error: '文件选择失败: ' + (params && params.message ? params.message : 'CANCELED') }
                    }
                    var data = params.data || {}
                    if (!data.uri) {
                        return { $error: '未选择文件' }
                    }
                    return {
                        uri: data.uri,
                        timestamp: params.timestamp
                    }
                `,
            },
        ],
    },
}
