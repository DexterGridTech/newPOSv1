import {TaskDefinition} from '@impos2/kernel-core-task'

/**
 * 摄像头扫码 TaskDefinition
 *
 * 通过 externalCall + INTENT channel 启动内嵌 CameraScanActivity 并等待结果。
 * channel: { type: 'INTENT', target: 'camera', mode: 'request-response' }
 * params.waitResult = true → IntentChannel 通过 ResultBridgeActivity 桥接 startActivityForResult
 *
 * CameraScanActivity 返回结构：
 *   SCAN_RESULT: string（扫码内容）
 *   SCAN_RESULT_FORMAT: string（码制，如 QR_CODE / EAN_13 / CODE_128 等）
 *
 * SCAN_MODE 可选值：
 *   'ALL'（默认）、'QR_CODE_MODE'、'BARCODE_MODE'
 */
export const readBarCodeFromCamera: TaskDefinition = {
    key: 'readBarCodeFromCamera',
    name: '摄像头扫码',
    timeout: 30000,
    enabled: true,
    testContext: {},
    rootNode: {
        key: 'scanFromCamera',
        name: '调用摄像头扫码',
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
        // params.success=false → 用户取消或权限拒绝（data.error 含错误码）
        // params.data.SCAN_RESULT → 扫码内容
        resultScript: `
            if (!params || !params.success) {
                var err = params && params.data && params.data.error ? params.data.error : 'CANCELED'
                throw new Error('摄像头扫码失败: ' + err)
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
