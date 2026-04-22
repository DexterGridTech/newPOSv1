import {describe, expect, it, vi} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createWorkflowRuntimeModuleV2,
    workflowBuiltinTaskKeys,
    workflowRuntimeV2CommandDefinitions,
} from '@impos2/kernel-base-workflow-runtime-v2'
import {
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'
import {createAdminConsoleHarness} from '../support/adminConsoleHarness'
import {adminConsoleCommandDefinitions} from '../../src'

describe('admin topology command', () => {
    it('runs scan command through actor and keeps workflow orchestration outside UI', async () => {
        const importSharePayload = vi.fn(async () => {})
        const startConnection = vi.fn(async () => {})
        const harness = await createAdminConsoleHarness({
            modules: [createWorkflowRuntimeModuleV2()],
            topology: {
                orchestrator: {
                    startConnection,
                    stopConnection: vi.fn(),
                    restartConnection: vi.fn(),
                },
            },
            hostTools: {
                topology: {
                    importSharePayload,
                },
            } as any,
            platformPorts: {
                connector: {
                    async call() {
                        return {
                            success: true,
                            code: 0,
                            message: 'OK',
                            data: {
                                SCAN_RESULT: '{"formatVersion":"2026.04","deviceId":"MASTER-001","masterNodeId":"NODE-001","wsUrl":"ws://127.0.0.1:18586/ws"}',
                                SCAN_RESULT_FORMAT: 'QR_CODE',
                            },
                        }
                    },
                },
            },
        })

        const result = await harness.runtime.dispatchCommand(createCommand(
            adminConsoleCommandDefinitions.scanAndImportTopologyMaster,
            {
                scanMode: 'QR_CODE_MODE',
                timeoutMs: 60_000,
                reconnect: true,
            },
        ))

        expect(result.status).toBe('COMPLETED')
        expect(harness.runtime.queryRequest(result.requestId)?.commands.map(item => item.commandName)).toEqual([
            adminConsoleCommandDefinitions.scanAndImportTopologyMaster.commandName,
            workflowRuntimeV2CommandDefinitions.runWorkflow.commandName,
            topologyRuntimeV3CommandDefinitions.startTopologyConnection.commandName,
        ])
        expect(harness.runtime.queryRequest(result.requestId)?.commands[1]?.actorResults[0]?.result).toMatchObject({
            status: 'COMPLETED',
            result: {
                output: {
                    barcode: '{"formatVersion":"2026.04","deviceId":"MASTER-001","masterNodeId":"NODE-001","wsUrl":"ws://127.0.0.1:18586/ws"}',
                    format: 'QR_CODE',
                },
            },
        })
        expect(importSharePayload).toHaveBeenCalledWith({
            formatVersion: '2026.04',
            deviceId: 'MASTER-001',
            masterNodeId: 'NODE-001',
            wsUrl: 'ws://127.0.0.1:18586/ws',
        })
        expect(startConnection).toHaveBeenCalledTimes(1)
        expect((result.actorResults[0]?.result as any)?.sharePayload).toEqual({
            formatVersion: '2026.04',
            deviceId: 'MASTER-001',
            masterNodeId: 'NODE-001',
            wsUrl: 'ws://127.0.0.1:18586/ws',
        })
        expect(harness.runtime.queryRequest(result.requestId)?.commands[1]).toMatchObject({
            parentCommandId: result.commandId,
        })
        expect(harness.runtime.queryRequest(result.requestId)?.commands[1]?.actorResults[0]?.result).toMatchObject({
            workflowKey: workflowBuiltinTaskKeys.singleReadBarcodeFromCamera,
        })
    })

    it('accepts compact topology QR payload keys', async () => {
        const importSharePayload = vi.fn(async () => {})
        const harness = await createAdminConsoleHarness({
            modules: [createWorkflowRuntimeModuleV2()],
            topology: {
                orchestrator: {
                    startConnection: vi.fn(),
                    stopConnection: vi.fn(),
                    restartConnection: vi.fn(),
                },
            },
            hostTools: {
                topology: {
                    importSharePayload,
                },
            } as any,
            platformPorts: {
                connector: {
                    async call() {
                        return {
                            success: true,
                            code: 0,
                            message: 'OK',
                            data: {
                                SCAN_RESULT: '{"v":"2026.04","d":"MASTER-001","n":"NODE-001","w":"ws://127.0.0.1:18586/ws"}',
                                SCAN_RESULT_FORMAT: 'QR_CODE',
                            },
                        }
                    },
                },
            },
        })

        const result = await harness.runtime.dispatchCommand(createCommand(
            adminConsoleCommandDefinitions.scanAndImportTopologyMaster,
            {},
        ))

        expect(result.status).toBe('COMPLETED')
        expect(importSharePayload).toHaveBeenCalledWith({
            formatVersion: '2026.04',
            deviceId: 'MASTER-001',
            masterNodeId: 'NODE-001',
            wsUrl: 'ws://127.0.0.1:18586/ws',
        })
    })

    it('passes optional imageUri into the scan workflow input', async () => {
        const importSharePayload = vi.fn(async () => {})
        const connectorCall = vi.fn(async () => ({
            success: true,
            code: 0,
            message: 'OK',
            data: {
                SCAN_RESULT: '{"v":"2026.04","d":"MASTER-001","n":"NODE-001","w":"ws://127.0.0.1:18586/ws"}',
                SCAN_RESULT_FORMAT: 'QR_CODE',
            },
        }))
        const harness = await createAdminConsoleHarness({
            modules: [createWorkflowRuntimeModuleV2()],
            topology: {
                orchestrator: {
                    startConnection: vi.fn(),
                    stopConnection: vi.fn(),
                    restartConnection: vi.fn(),
                },
            },
            hostTools: {
                topology: {
                    importSharePayload,
                },
            } as any,
            platformPorts: {
                connector: {
                    call: connectorCall,
                },
            },
        })

        const result = await harness.runtime.dispatchCommand(createCommand(
            adminConsoleCommandDefinitions.scanAndImportTopologyMaster,
            {
                imageUri: 'content://com.impos2.test/topology-share-qr.png',
                reconnect: false,
            },
        ))

        expect(result.status).toBe('COMPLETED')
        expect(connectorCall).toHaveBeenCalledWith(expect.objectContaining({
            params: expect.objectContaining({
                IMAGE_URI: 'content://com.impos2.test/topology-share-qr.png',
            }),
        }))
    })

    it('passes optional imageBase64 into the scan workflow input', async () => {
        const importSharePayload = vi.fn(async () => {})
        const connectorCall = vi.fn(async () => ({
            success: true,
            code: 0,
            message: 'OK',
            data: {
                SCAN_RESULT: '{"v":"2026.04","d":"MASTER-001","n":"NODE-001","w":"ws://127.0.0.1:18586/ws"}',
                SCAN_RESULT_FORMAT: 'QR_CODE',
            },
        }))
        const harness = await createAdminConsoleHarness({
            modules: [createWorkflowRuntimeModuleV2()],
            topology: {
                orchestrator: {
                    startConnection: vi.fn(),
                    stopConnection: vi.fn(),
                    restartConnection: vi.fn(),
                },
            },
            hostTools: {
                topology: {
                    importSharePayload,
                },
            } as any,
            platformPorts: {
                connector: {
                    call: connectorCall,
                },
            },
        })

        const result = await harness.runtime.dispatchCommand(createCommand(
            adminConsoleCommandDefinitions.scanAndImportTopologyMaster,
            {
                imageBase64: 'ZmFrZS1xci1pbWFnZS1iYXNlNjQ=',
                reconnect: false,
            },
        ))

        expect(result.status).toBe('COMPLETED')
        expect(connectorCall).toHaveBeenCalledWith(expect.objectContaining({
            params: expect.objectContaining({
                IMAGE_BASE64: 'ZmFrZS1xci1pbWFnZS1iYXNlNjQ=',
            }),
        }))
    })
})
