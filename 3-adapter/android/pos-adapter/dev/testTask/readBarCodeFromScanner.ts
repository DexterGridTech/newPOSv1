import {TaskDefinition} from '@impos2/kernel-core-task'

/**
 * USB 扫码枪 TaskDefinition
 *
 * 通过 externalSubscribe 订阅 HID stream 通道接收扫码枪数据。
 * channel: { type: 'HID', target: 'keyboard', mode: 'stream' }
 *
 * ConnectorEvent 结构（HidStreamChannel 推送）：
 *   { channelId: 'keyboard', type: 'HID', target: 'keyboard',
 *     data: { text: string }, raw: string, timestamp: number }
 */
export const readBarCodeFromScanner: TaskDefinition = {
    key: 'readBarCodeFromScanner',
    name: 'USB 扫码枪扫码',
    timeout: 30000,
    enabled: true,
    testContext: {
        // targetFilter: 'keyboard',  // 可选：过滤特定 target
    },
    rootNode: {
        key: 'listenScanner',
        name: '监听扫码枪数据',
        type: 'externalSubscribe',
        timeout: 29000,
        strategy: {
            errorStrategy: 'skip',
        },
        argsScript: `
            return {
                channel: { type: 'HID', target: 'keyboard', mode: 'stream' }
            }
        `,
        // params = ConnectorEvent，data.text 为扫码内容
        resultScript: `
            if (!params || params.data === null || params.data === undefined) {
                throw new Error('扫码枪数据为空或设备异常')
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
}
