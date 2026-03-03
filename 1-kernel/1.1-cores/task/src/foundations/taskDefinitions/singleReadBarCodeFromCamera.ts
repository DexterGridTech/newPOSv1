import {TaskDefinition} from '@impos2/kernel-core-task'

export const singleReadBarCodeFromCamera: TaskDefinition = {
    key: 'SINGLE_READ_BARCODE_FROM_CAMERA',
    name: '摄像头单次扫码',
    timeout: 30000,
    enabled: true,
    testContext: {},
    rootNode: {
        key: 'root',
        name: '主流程',
        type: 'externalCall',
        timeout: 29000,
        strategy: {errorStrategy: 'skip'},
        argsScript: `
            return {
                channel: { type: 'INTENT', target: 'camera', mode: 'request-response' },
                action: 'com.impos2.posadapter.action.CAMERA_SCAN',
                params: { waitResult: true, SCAN_MODE: 'ALL' },
                timeout: 29000
            }
        `,
        resultScript: `
            if (!params || !params.success) {
                var err = params && params.data && params.data.error ? params.data.error : 'CANCELED'
                return { $error: '摄像头扫码失败: ' + err }
            }
            var data = params.data || {}
            return {
                barcode: data.SCAN_RESULT || '',
                format: data.SCAN_RESULT_FORMAT || 'UNKNOWN',
                timestamp: params.timestamp
            }
        `,
    },
}

