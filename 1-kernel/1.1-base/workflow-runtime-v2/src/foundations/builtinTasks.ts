import type {WorkflowDefinition} from '../types'
import {moduleName} from '../moduleName'

export const workflowBuiltinTaskKeys = {
    singleReadBarcodeFromCamera: `${moduleName}.builtin.single-read-barcode-from-camera`,
} as const

/**
 * 这些定义是新基座里的内置通用 task。业务侧只依赖 workflowKey，不需要知道底层 camera
 * connector 的 channel/action 细节。
 */
export const createWorkflowBuiltinTaskDefinitions = (): readonly WorkflowDefinition[] => ([
    {
        workflowKey: workflowBuiltinTaskKeys.singleReadBarcodeFromCamera,
        moduleName,
        name: 'Single Read Barcode From Camera',
        description: 'Open camera scanner once and return the decoded barcode string.',
        enabled: true,
        version: '2026.04',
        tags: ['builtin', 'task', 'barcode', 'camera'],
        inputSchema: {
            schemaType: 'json-schema-lite',
            properties: {
                scanMode: {type: 'string'},
                timeoutMs: {type: 'number'},
            },
        },
        outputSchema: {
            schemaType: 'json-schema-lite',
            required: ['barcode'],
            properties: {
                barcode: {type: 'string'},
                format: {type: 'string'},
                raw: {type: 'object'},
            },
        },
        rootStep: {
            stepKey: 'read-barcode',
            name: 'Read Barcode',
            type: 'external-call',
            timeoutMs: 60_000,
            input: {
                object: {
                    channel: {
                        type: 'INTENT',
                        target: 'camera',
                        mode: 'request-response',
                    },
                    action: 'com.impos2.posadapter.action.CAMERA_SCAN',
                    timeoutMs: {
                        type: 'script',
                        language: 'javascript',
                        source: `
                            return typeof input.timeoutMs === 'number'
                                ? input.timeoutMs
                                : 60000
                        `,
                    },
                    params: {
                        type: 'script',
                        language: 'javascript',
                        source: `
                            return {
                                SCAN_MODE: input.scanMode || 'QR_CODE_MODE',
                                waitResult: true
                            }
                        `,
                    },
                },
            },
            output: {
                result: {
                    type: 'script',
                    language: 'javascript',
                    source: `
                        if (!params || params.success !== true) {
                            throw new Error(params?.message || 'BARCODE_SCAN_FAILED')
                        }
                        const data = params.data || {}
                        const barcode = data.SCAN_RESULT || data.scanResult || data.barcode
                        if (typeof barcode !== 'string' || barcode.length === 0) {
                            throw new Error('BARCODE_SCAN_EMPTY')
                        }
                        return {
                            barcode,
                            format: data.SCAN_RESULT_FORMAT || data.scanResultFormat || data.format || 'UNKNOWN',
                            raw: params
                        }
                    `,
                },
            },
        },
        timeoutMs: 60_000,
        defaultOptions: {
            timeoutMs: 60_000,
        },
        createdAt: 1776600000000,
        updatedAt: 1776600000000,
    },
])
