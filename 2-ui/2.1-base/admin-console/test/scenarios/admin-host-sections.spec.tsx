import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {act} from 'react-test-renderer'
import type {ReactTestRenderer} from 'react-test-renderer'
import {
    AdminConnectorSection,
    AdminControlSection,
    AdminDeviceSection,
    AdminLogsSection,
    createModule,
} from '../../src'
import {
    createAdminConsoleHarness,
    renderWithStore,
} from '../support/adminConsoleHarness'

const toText = (value: unknown): string => {
    if (Array.isArray(value)) {
        return value.map(toText).join('')
    }
    if (value === undefined || value === null) {
        return ''
    }
    return String(value)
}

const collectText = (value: unknown, bucket: string[]) => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        bucket.push(String(value))
        return
    }
    if (Array.isArray(value)) {
        value.forEach(item => collectText(item, bucket))
    }
}

const hasRenderedText = (
    tree: ReactTestRenderer,
    expected: string,
): boolean => {
    const bucket: string[] = []
    tree.root.findAll(() => true).forEach(node => {
        collectText(node.props.children, bucket)
    })
    return bucket.some(item => item.includes(expected))
}

describe('admin host-backed sections', () => {
    it('falls back to unavailable views when host tools are not installed', async () => {
        const harness = await createAdminConsoleHarness()

        const deviceTree = renderWithStore(<AdminDeviceSection />, harness.store, harness.runtime)
        const logsTree = renderWithStore(<AdminLogsSection />, harness.store, harness.runtime)
        const controlTree = renderWithStore(<AdminControlSection />, harness.store, harness.runtime)
        const connectorTree = renderWithStore(<AdminConnectorSection />, harness.store, harness.runtime)

        expect(() => deviceTree.root.findByProps({testID: 'ui-base-admin-section:device:unavailable'})).not.toThrow()
        expect(() => logsTree.root.findByProps({testID: 'ui-base-admin-section:logs:unavailable'})).not.toThrow()
        expect(() => controlTree.root.findByProps({testID: 'ui-base-admin-section:control:unavailable'})).not.toThrow()
        expect(() => connectorTree.root.findByProps({testID: 'ui-base-admin-section:connector:unavailable'})).not.toThrow()
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
        const tree = renderWithStore(<AdminDeviceSection />, harness.store, harness.runtime)

        await act(async () => {})
        expect(deviceHost.getSnapshot).toHaveBeenCalledTimes(1)
        expect(hasRenderedText(tree, 'DEVICE-001')).toBe(true)
        expect(hasRenderedText(tree, '资源概览')).toBe(true)
        expect(hasRenderedText(tree, '资源摘要')).toBe(true)
        expect(hasRenderedText(tree, 'USB 设备')).toBe(true)
        expect(hasRenderedText(tree, 'USB-PINPAD')).toBe(true)
        expect(hasRenderedText(tree, '串口设备')).toBe(true)
        expect(hasRenderedText(tree, '115200 baud')).toBe(true)

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:device:refresh'}).props.onPress()
        })

        expect(deviceHost.getSnapshot).toHaveBeenCalledTimes(2)
        expect(hasRenderedText(tree, 'DEVICE-002')).toBe(true)
        expect(hasRenderedText(tree, 'USB-SCANNER')).toBe(true)
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
        const tree = renderWithStore(<AdminLogsSection />, harness.store, harness.runtime)

        await act(async () => {})
        expect(logHost.listFiles).toHaveBeenCalledTimes(1)
        expect(logHost.getDirectoryPath).toHaveBeenCalledTimes(1)
        expect(hasRenderedText(tree, 'app.log')).toBe(true)

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:logs:open:0'}).props.onPress()
        })
        expect(logHost.readFile).toHaveBeenCalledWith('app.log')
        expect(hasRenderedText(tree, 'hello-log')).toBe(true)

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:logs:delete:0'}).props.onPress()
        })
        expect(logHost.deleteFile).toHaveBeenCalledWith('app.log')

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:logs:clear'}).props.onPress()
        })
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
            switchServerSpace: vi.fn().mockResolvedValue(undefined),
            clearCache: vi.fn().mockResolvedValue(undefined),
        }
        const harness = await createAdminConsoleHarness({
            hostTools: {control: controlHost},
        })
        const tree = renderWithStore(<AdminControlSection />, harness.store, harness.runtime)

        await act(async () => {})
        expect(hasRenderedText(tree, '全屏 / 锁定 / 清缓存 / 重启')).toBe(true)

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:control:toggle-fullscreen'}).props.onPress()
        })
        expect(controlHost.setFullScreen).toHaveBeenCalledWith(true)
        expect(hasRenderedText(tree, '已开启全屏')).toBe(true)

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:control:toggle-lock'}).props.onPress()
        })
        expect(controlHost.setAppLocked).toHaveBeenCalledWith(true)
        expect(hasRenderedText(tree, '已锁定应用')).toBe(true)

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:control:restart'}).props.onPress()
        })
        expect(controlHost.restartApp).toHaveBeenCalledTimes(1)
        expect(hasRenderedText(tree, '已发出应用重启指令')).toBe(true)

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:control:clear-cache'}).props.onPress()
        })
        expect(controlHost.clearCache).toHaveBeenCalledTimes(1)
        expect(hasRenderedText(tree, '已清空本地缓存')).toBe(true)

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:control:switch-space:uat'}).props.onPress()
        })
        expect(controlHost.switchServerSpace).toHaveBeenCalledWith('uat')
        expect(hasRenderedText(tree, '已切换到 uat 空间')).toBe(true)
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
        const tree = renderWithStore(<AdminConnectorSection />, harness.store, harness.runtime)

        await act(async () => {})
        expect(connectorHost.getChannels).toHaveBeenCalledTimes(1)
        expect(hasRenderedText(tree, '串口主通道')).toBe(true)

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:connector:probe:serial-main'}).props.onPress()
        })

        expect(connectorHost.probe).toHaveBeenCalledWith('serial-main')
        expect(hasRenderedText(tree, 'serial-ready')).toBe(true)
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

        const deviceTree = renderWithStore(<AdminDeviceSection />, harness.store, harness.runtime)
        const logsTree = renderWithStore(<AdminLogsSection />, harness.store, harness.runtime)

        await act(async () => {})

        expect(hasRenderedText(deviceTree, 'PORT-DEVICE')).toBe(true)
        expect(hasRenderedText(logsTree, 'module.log')).toBe(true)
    })
})
