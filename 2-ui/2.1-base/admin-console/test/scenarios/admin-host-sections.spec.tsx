import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {
    AdminConnectorSection,
    AdminControlSection,
    AdminDeviceSection,
    AdminLogsSection,
    adminConsoleCommandDefinitions,
    getAdminHostTools,
    createModule,
} from '../../src'
import {
    createAdminConsoleHarness,
    renderWithAutomation,
} from '../support/adminConsoleHarness'

describe('admin host-backed sections', () => {
    it('falls back to unavailable views when host tools are not installed', async () => {
        const harness = await createAdminConsoleHarness()

        const deviceTree = renderWithAutomation(<AdminDeviceSection />, harness.store, harness.runtime)
        const logsTree = renderWithAutomation(<AdminLogsSection />, harness.store, harness.runtime)
        const controlTree = renderWithAutomation(<AdminControlSection />, harness.store, harness.runtime)
        const connectorTree = renderWithAutomation(<AdminConnectorSection />, harness.store, harness.runtime)

        await expect(deviceTree.getNode('ui-base-admin-section:device:unavailable')).resolves.toBeTruthy()
        await expect(logsTree.getNode('ui-base-admin-section:logs:unavailable')).resolves.toBeTruthy()
        await expect(controlTree.getNode('ui-base-admin-section:control:unavailable')).resolves.toBeTruthy()
        await expect(connectorTree.getNode('ui-base-admin-section:connector:unavailable')).resolves.toBeTruthy()
    })

    it('renders device snapshot from injected device host and supports refresh', async () => {
        const deviceHost = {
            getSnapshot: vi
                .fn()
                .mockResolvedValueOnce({
                    identity: [{key: 'device-id', label: '设备ID', value: 'DEVICE-001'}],
                    runtime: [{key: 'brand', label: '品牌', value: 'impos'}],
                    peripherals: [{key: 'usb', label: 'USB 设备', value: '2', tone: 'ok'}],
                    resourceDetails: {
                        usbDevices: [{name: 'USB-PINPAD', deviceClass: 'payment', deviceId: 'usb-1'}],
                        serialDevices: [{name: 'COM1', path: '/dev/ttyS0', baudRate: 115200, isOpen: true}],
                    },
                })
                .mockResolvedValueOnce({
                    identity: [{key: 'device-id', label: '设备ID', value: 'DEVICE-002'}],
                    runtime: [{key: 'brand', label: '品牌', value: 'impos'}],
                    resourceDetails: {
                        usbDevices: [{name: 'USB-SCANNER', deviceClass: 'scanner'}],
                    },
                }),
        }
        const harness = await createAdminConsoleHarness({
            hostTools: {device: deviceHost},
        })
        const tree = renderWithAutomation(<AdminDeviceSection host={deviceHost} />, harness.store, harness.runtime)

        await tree.waitForText('DEVICE-001')
        expect(deviceHost.getSnapshot).toHaveBeenCalledTimes(1)
        await expect(tree.queryNodesByText('DEVICE-001')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('资源概览')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('资源摘要')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('USB 设备')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('USB-PINPAD')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('串口设备')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('115200 baud')).resolves.not.toHaveLength(0)

        await tree.press('ui-base-admin-section:device:refresh')

        expect(deviceHost.getSnapshot).toHaveBeenCalledTimes(2)
        await expect(tree.queryNodesByText('DEVICE-002')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('USB-SCANNER')).resolves.toHaveLength(1)
    })

    it('executes log host actions through the logs section', async () => {
        const logHost = {
            listFiles: vi
                .fn()
                .mockResolvedValueOnce([
                    {fileName: 'app.log', fileSizeBytes: 100, lastModifiedAt: 1},
                ])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]),
            readFile: vi.fn().mockResolvedValue('hello-log'),
            deleteFile: vi.fn().mockResolvedValue(undefined),
            clearAll: vi.fn().mockResolvedValue(undefined),
            getDirectoryPath: vi.fn().mockResolvedValue('/tmp/logs'),
        }
        const harness = await createAdminConsoleHarness({
            hostTools: {logs: logHost},
        })
        const tree = renderWithAutomation(<AdminLogsSection host={logHost} />, harness.store, harness.runtime)

        await tree.waitForText('app.log')
        expect(logHost.listFiles).toHaveBeenCalledTimes(1)
        expect(logHost.getDirectoryPath).toHaveBeenCalledTimes(1)
        await expect(tree.queryNodesByText('app.log')).resolves.toHaveLength(1)

        await tree.press('ui-base-admin-section:logs:open:0')
        expect(logHost.readFile).toHaveBeenCalledWith('app.log')
        await expect(tree.queryNodes('ui-base-admin-detail:log-content')).resolves.toEqual([
            expect.objectContaining({value: 'hello-log'}),
        ])

        await tree.press('ui-base-admin-section:logs:delete:0')
        expect(logHost.deleteFile).toHaveBeenCalledWith('app.log')

        await tree.press('ui-base-admin-section:logs:clear')
        expect(logHost.clearAll).toHaveBeenCalledTimes(1)
    })

    it('executes control host actions and refreshes snapshot', async () => {
        const controlHost = {
            getSnapshot: vi
                .fn()
                .mockResolvedValueOnce({
                    isFullScreen: false,
                    isAppLocked: false,
                    selectedSpace: 'prod',
                    availableSpaces: ['prod', 'uat'],
                    supportsRestart: true,
                    supportsClearCache: true,
                    supportsLockControl: true,
                    supportsFullScreenControl: true,
                })
                .mockResolvedValueOnce({
                    isFullScreen: true,
                    isAppLocked: false,
                    selectedSpace: 'prod',
                    availableSpaces: ['prod', 'uat'],
                    supportsRestart: true,
                    supportsClearCache: true,
                    supportsLockControl: true,
                    supportsFullScreenControl: true,
                })
                .mockResolvedValueOnce({
                    isFullScreen: true,
                    isAppLocked: true,
                    selectedSpace: 'prod',
                    availableSpaces: ['prod', 'uat'],
                    supportsRestart: true,
                    supportsClearCache: true,
                    supportsLockControl: true,
                    supportsFullScreenControl: true,
                })
                .mockResolvedValueOnce({
                    isFullScreen: true,
                    isAppLocked: true,
                    selectedSpace: 'prod',
                    availableSpaces: ['prod', 'uat'],
                    supportsRestart: true,
                    supportsClearCache: true,
                    supportsLockControl: true,
                    supportsFullScreenControl: true,
                })
                .mockResolvedValueOnce({
                    isFullScreen: true,
                    isAppLocked: true,
                    selectedSpace: 'prod',
                    availableSpaces: ['prod', 'uat'],
                    supportsRestart: true,
                    supportsClearCache: true,
                    supportsLockControl: true,
                    supportsFullScreenControl: true,
                })
                .mockResolvedValue({
                    isFullScreen: true,
                    isAppLocked: true,
                    selectedSpace: 'uat',
                    availableSpaces: ['prod', 'uat'],
                    supportsRestart: true,
                    supportsClearCache: true,
                    supportsLockControl: true,
                    supportsFullScreenControl: true,
                }),
            setFullScreen: vi.fn().mockResolvedValue(undefined),
            setAppLocked: vi.fn().mockResolvedValue(undefined),
            restartApp: vi.fn().mockResolvedValue(undefined),
            clearCache: vi.fn().mockResolvedValue(undefined),
        }
        const harness = await createAdminConsoleHarness({
            hostTools: {control: controlHost},
        })
        const dispatchSpy = vi.spyOn(harness.runtime, 'dispatchCommand')
            .mockResolvedValue({status: 'COMPLETED', actorResults: []} as any)
        const tree = renderWithAutomation(
            <AdminControlSection runtime={harness.runtime} host={controlHost} />,
            harness.store,
            harness.runtime,
        )

        await tree.waitForText('全屏 / 锁定 / 清缓存 / 重启')
        await expect(tree.queryNodesByText('全屏 / 锁定 / 清缓存 / 重启')).resolves.toHaveLength(1)

        await tree.press('ui-base-admin-section:control:toggle-fullscreen')
        expect(controlHost.setFullScreen).toHaveBeenCalledWith(true)
        await expect(tree.getNode('ui-base-admin-section:message')).resolves.toMatchObject({
            text: '已开启全屏',
        })

        await tree.press('ui-base-admin-section:control:toggle-lock')
        expect(controlHost.setAppLocked).toHaveBeenCalledWith(true)
        await expect(tree.getNode('ui-base-admin-section:message')).resolves.toMatchObject({
            text: '已锁定应用',
        })

        await tree.press('ui-base-admin-section:control:restart')
        expect(controlHost.restartApp).toHaveBeenCalledTimes(1)
        await expect(tree.getNode('ui-base-admin-section:message')).resolves.toMatchObject({
            text: '已发出应用重启指令',
        })

        await tree.press('ui-base-admin-section:control:clear-cache')
        expect(controlHost.clearCache).toHaveBeenCalledTimes(1)
        await expect(tree.getNode('ui-base-admin-section:message')).resolves.toMatchObject({
            text: '已清空本地缓存',
        })

        await tree.press('ui-base-admin-section:control:switch-space:uat')
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
            definition: adminConsoleCommandDefinitions.switchServerSpace,
            payload: {
                selectedSpace: 'uat',
            },
        }))
        await expect(tree.getNode('ui-base-admin-section:message')).resolves.toMatchObject({
            text: '已切换到 uat 空间',
        })
    })

    it('executes connector probes through the injected connector host', async () => {
        const connectorHost = {
            getChannels: vi.fn().mockResolvedValue([
                {key: 'serial-main', title: '串口主通道', target: '/dev/ttyS0'},
            ]),
            probe: vi.fn().mockResolvedValue({
                channelKey: 'serial-main',
                tone: 'ok',
                message: 'serial-ready',
            }),
        }
        const harness = await createAdminConsoleHarness({
            hostTools: {connector: connectorHost},
        })
        const tree = renderWithAutomation(<AdminConnectorSection host={connectorHost} />, harness.store, harness.runtime)

        await tree.waitForText('串口主通道')
        expect(connectorHost.getChannels).toHaveBeenCalledTimes(1)
        await expect(tree.queryNodesByText('串口主通道')).resolves.toHaveLength(1)

        await tree.press('ui-base-admin-section:connector:probe:serial-main')

        expect(connectorHost.probe).toHaveBeenCalledWith('serial-main')
        await expect(tree.queryNodes('ui-base-admin-detail:serial-main:probe-message')).resolves.toEqual([
            expect.objectContaining({value: 'serial-ready'}),
        ])
    })

    it('installs host tools through module input', async () => {
        const deviceHost = {
            getSnapshot: vi.fn().mockResolvedValue({
                identity: [{key: 'device-id', label: '设备ID', value: 'MODULE-HOST'}],
                runtime: [],
            }),
        }
        const harness = await createAdminConsoleHarness({
            hostTools: {device: deviceHost},
        })

        const app = await harness.app
        expect(app).toBeTruthy()
        expect(getAdminHostTools(harness.runtime.localNodeId).device).toBe(deviceHost)

        const module = createModule({
            hostTools: {device: deviceHost},
        })

        expect(module).toBeTruthy()
    })

    it('supports host tool sources and platform ports through module install', async () => {
        const harness = await createAdminConsoleHarness({
            hostToolSources: {
                logs: {
                    getLogFiles: vi.fn().mockResolvedValue([
                        {fileName: 'module.log', fileSize: 88, lastModified: 2},
                    ]),
                    getLogContent: vi.fn().mockResolvedValue('module-log-content'),
                    deleteLogFile: vi.fn().mockResolvedValue(undefined),
                    clearAllLogs: vi.fn().mockResolvedValue(undefined),
                    getLogDirPath: vi.fn().mockResolvedValue('/module/logs'),
                },
            },
            platformPorts: {
                device: {
                    getDeviceId: vi.fn().mockResolvedValue('PORT-DEVICE'),
                    getPlatform: vi.fn().mockResolvedValue('electron'),
                    getModel: vi.fn().mockResolvedValue('DESKTOP'),
                },
            },
        })

        const hostTools = getAdminHostTools(harness.runtime.localNodeId)
        const deviceTree = renderWithAutomation(<AdminDeviceSection host={hostTools.device} />, harness.store, harness.runtime)
        const logsTree = renderWithAutomation(<AdminLogsSection host={hostTools.logs} />, harness.store, harness.runtime)

        await deviceTree.waitForText('PORT-DEVICE')
        await logsTree.waitForText('module.log')

        await expect(deviceTree.queryNodesByText('PORT-DEVICE')).resolves.toHaveLength(1)
        await expect(logsTree.queryNodesByText('module.log')).resolves.toHaveLength(1)
    })

    it('keeps installed host tools scoped per runtime instance', async () => {
        const firstDeviceHost = {
            getSnapshot: vi.fn().mockResolvedValue({
                identity: [{key: 'device-id', label: '设备ID', value: 'RUNTIME-A'}],
                runtime: [],
            }),
        }
        const secondDeviceHost = {
            getSnapshot: vi.fn().mockResolvedValue({
                identity: [{key: 'device-id', label: '设备ID', value: 'RUNTIME-B'}],
                runtime: [],
            }),
        }

        const firstHarness = await createAdminConsoleHarness({
            hostTools: {device: firstDeviceHost},
        })
        const secondHarness = await createAdminConsoleHarness({
            resetGlobalRegistries: false,
            hostTools: {device: secondDeviceHost},
        })

        expect(getAdminHostTools(firstHarness.runtime.localNodeId).device).toBe(firstDeviceHost)
        expect(getAdminHostTools(secondHarness.runtime.localNodeId).device).toBe(secondDeviceHost)
    })
})
