import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createMemoryStorage} from '../../../../../1-kernel/test-support/storageHarness'
import {mountAssemblyAutomationApp} from '../support/mountAssemblyAutomationApp'

type MemoryStorageHandle = ReturnType<typeof createMemoryStorage>

const stateStorageByNamespace = new Map<string, MemoryStorageHandle>()
const fetchMock = vi.fn()

const getNamespaceStorage = (namespace: string): MemoryStorageHandle => {
    const existing = stateStorageByNamespace.get(namespace)
    if (existing) {
        return existing
    }
    const created = createMemoryStorage()
    stateStorageByNamespace.set(namespace, created)
    return created
}

vi.mock('react-native', async () => {
    const ReactModule = await import('react')
    type MockHostProps = Record<string, unknown> & {
        readonly children?: React.ReactNode
    }

    class MockNativeEventEmitter {
        addListener() {
            return {remove: () => {}}
        }
    }

    const createHost = (name: string) =>
        (props: MockHostProps) => ReactModule.createElement(name, props, props.children)

    return {
        View: createHost('mock-view'),
        Text: createHost('mock-text'),
        Pressable: createHost('mock-pressable'),
        ScrollView: createHost('mock-scroll-view'),
        TouchableOpacity: createHost('mock-touchable-opacity'),
        TextInput: createHost('mock-text-input'),
        useWindowDimensions: () => ({
            width: 1280,
            height: 720,
            scale: 1,
            fontScale: 1,
        }),
        StyleSheet: {
            create(styles: unknown) {
                return styles
            },
        },
        Platform: {
            OS: 'android',
            select(value: Record<string, unknown>) {
                return value.android ?? value.default
            },
        },
        NativeEventEmitter: MockNativeEventEmitter,
        TurboModuleRegistry: {
            get(name: string) {
                return this.getEnforcing(name)
            },
            getEnforcing(name: string) {
                switch (name) {
                    case 'DeviceTurboModule':
                        return {
                            async getDeviceInfo() {
                                return {
                                    id: 'ASSEMBLY-DEVICE-ADMIN-001',
                                    manufacturer: 'SUNMI',
                                    model: 'Mixc Retail Android RN84',
                                    osVersion: '14',
                                    displays: [{id: 'main'}, {id: 'customer'}],
                                }
                            },
                            async getSystemStatus() {
                                return {
                                    power: {batteryLevel: 88, powerConnected: true},
                                    usbDevices: [{name: 'USB-SCANNER', deviceClass: 'scanner'}],
                                    networks: [{name: 'wifi', status: 'connected'}],
                                }
                            },
                            async addPowerStatusChangeListener() {
                                return 'listener-1'
                            },
                            async removePowerStatusChangeListener() {
                                return undefined
                            },
                        }
                    case 'StateStorageTurboModule':
                        return {
                            async getString(namespace: string, key: string) {
                                return getNamespaceStorage(namespace).saved.get(key) ?? null
                            },
                            async setString(namespace: string, key: string, value: string) {
                                getNamespaceStorage(namespace).saved.set(key, value)
                            },
                            async remove(namespace: string, key: string) {
                                getNamespaceStorage(namespace).saved.delete(key)
                            },
                            async clearAll(namespace: string) {
                                getNamespaceStorage(namespace).saved.clear()
                            },
                            async getAllKeys(namespace: string) {
                                return [...getNamespaceStorage(namespace).saved.keys()]
                            },
                        }
                    case 'LoggerTurboModule':
                        return {
                            debug() {},
                            log() {},
                            warn() {},
                            error() {},
                            async getLogFiles() {
                                return [{fileName: 'assembly.log', fileSize: 256, lastModified: 1}]
                            },
                            async getLogContent() {
                                return 'assembly-log-content'
                            },
                            async deleteLogFile() {
                                return true
                            },
                            async clearAllLogs() {
                                return true
                            },
                            async getLogDirPath() {
                                return '/tmp/assembly-logs'
                            },
                        }
                    case 'ScriptsTurboModule':
                        return {
                            async executeScript(script: string, paramsJson: string) {
                                const fn = new Function(
                                    'params',
                                    `"use strict"; ${script}`,
                                )
                                return {
                                    success: true,
                                    resultJson: JSON.stringify(fn(JSON.parse(paramsJson))),
                                }
                            },
                            async resolveNativeCall() {
                                return undefined
                            },
                            async rejectNativeCall() {
                                return undefined
                            },
                            async getStats() {
                                return {}
                            },
                            clearStats() {},
                        }
                    case 'ConnectorTurboModule':
                        return {
                            async call() {
                                return {success: true, message: 'connector-ready'}
                            },
                            async subscribe() {
                                return 'subscription-1'
                            },
                            async unsubscribe() {
                                return undefined
                            },
                            async isAvailable() {
                                return true
                            },
                            async getAvailableTargets(type: string) {
                                if (type === 'HID') {
                                    return ['keyboard']
                                }
                                if (type === 'INTENT') {
                                    return ['camera']
                                }
                                return []
                            },
                        }
                    case 'AppControlTurboModule':
                        return {
                            async showLoading() {
                                return undefined
                            },
                            async hideLoading() {
                                return undefined
                            },
                            async restartApp() {
                                return undefined
                            },
                            async exitApp() {
                                return undefined
                            },
                            async setFullscreen() {
                                return undefined
                            },
                            async setKioskMode() {
                                return undefined
                            },
                            async isFullscreen() {
                                return false
                            },
                            async isKioskMode() {
                                return false
                            },
                        }
                    case 'AutomationTurboModule':
                        return {
                            async startAutomationHost() {
                                return JSON.stringify({host: '127.0.0.1', port: 18584})
                            },
                            async stopAutomationHost() {
                                return undefined
                            },
                            async getAutomationHostStatus() {
                                return JSON.stringify({running: false})
                            },
                            async resolveAutomationMessage() {
                                return undefined
                            },
                            async rejectAutomationMessage() {
                                return undefined
                            },
                            addListener() {},
                            removeListeners() {},
                        }
                    case 'TopologyHostTurboModule':
                        return {
                            async startTopologyHost() {
                                return JSON.stringify({})
                            },
                            async prepareTopologyLaunch() {
                                return JSON.stringify({})
                            },
                            async stopTopologyHost() {
                                return undefined
                            },
                            async getTopologyHostStatus() {
                                return JSON.stringify({
                                    state: 'RUNNING',
                                    addressInfo: {
                                        httpBaseUrl: 'http://127.0.0.1:18888/mockMasterServer',
                                        wsUrl: 'ws://127.0.0.1:18888/mockMasterServer/ws',
                                    },
                                })
                            },
                            async getTopologyHostStats() {
                                return JSON.stringify({})
                            },
                            async replaceTopologyFaultRules() {
                                return JSON.stringify({})
                            },
                            async getDiagnosticsSnapshot() {
                                return JSON.stringify({
                                    hostRuntime: {
                                        nodeId: 'master-node-admin',
                                        deviceId: 'ASSEMBLY-DEVICE-ADMIN-001',
                                    },
                                    peers: [{
                                        role: 'MASTER',
                                        nodeId: 'master-node-admin',
                                        deviceId: 'ASSEMBLY-DEVICE-ADMIN-001',
                                    }],
                                })
                            },
                            addListener() {},
                            removeListeners() {},
                        }
                    default:
                        return {}
                }
            },
        },
    }
})

vi.mock('reactotron-react-native', () => {
    const chain = {
        configure() {
            return chain
        },
        useReactNative() {
            return chain
        },
        use() {
            return chain
        },
        connect() {
            return chain
        },
        close() {},
        createEnhancer() {
            return undefined
        },
    }
    return {
        default: chain,
    }
})

vi.mock('reactotron-redux', () => ({
    reactotronRedux: () => () => undefined,
}))

describe('assembly admin console automation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stateStorageByNamespace.clear()
        Reflect.set(globalThis, '__DEV__', true)
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
            }),
        })
        vi.stubGlobal('fetch', fetchMock)
    })

    it('drives injected admin-console host tools and diagnostics through the automation controller', async () => {
        const {AdminPopup, createAdminPasswordVerifier} = await import('@impos2/ui-base-admin-console')
        const {createApp} = await import('../../src/application/createApp')
        const {InputRuntimeProvider, VirtualKeyboardOverlay} = await import('@impos2/ui-base-input-runtime')
        const runtimeApp = createApp({
            deviceId: 'ASSEMBLY-DEVICE-ADMIN-001',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 0,
            isEmulator: true,
            topology: {
                role: 'slave',
                localNodeId: 'slave-node-admin',
                masterNodeId: 'master-node-admin',
                httpBaseUrl: 'http://127.0.0.1:18888/mockMasterServer',
                wsUrl: 'ws://127.0.0.1:18888/mockMasterServer/ws',
            },
        })
        const adminPassword = createAdminPasswordVerifier({
            deviceIdProvider: () => 'ASSEMBLY-DEVICE-ADMIN-001',
        }).deriveFor(new Date())
        const mounted = await mountAssemblyAutomationApp(
            runtimeApp as any,
            <InputRuntimeProvider>
                <AdminPopup deviceId="ASSEMBLY-DEVICE-ADMIN-001" onClose={() => {}} />
                <VirtualKeyboardOverlay />
            </InputRuntimeProvider>,
        )

        try {
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-base-admin-popup:login',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                text: '管理员登录',
            })

            await mounted.typeVirtualValue('ui-base-admin-popup:password', adminPassword)
            await mounted.press('ui-base-admin-popup:submit')

            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-base-admin-popup:panel',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                text: '系统管理工作台',
            })

            await mounted.press('ui-base-admin-popup:tab:adapter')
            await expect(mounted.client.call('runtime.selectState', {
                target: 'primary',
                path: ['ui.base.admin-console.console', 'selectedTab'],
            })).resolves.toBe('adapter')

            await mounted.press('ui-base-admin-adapter-diagnostics:run-all')

            await expect(mounted.client.call('wait.forState', {
                target: 'primary',
                path: ['ui.base.admin-console.console', 'latestAdapterSummary', 'status'],
                equals: 'passed',
                timeoutMs: 5_000,
            })).resolves.toMatchObject({
                value: 'passed',
            })
            await expect(mounted.client.call('wait.forState', {
                target: 'primary',
                path: ['ui.base.admin-console.console', 'latestAdapterSummary', 'total'],
                equals: 9,
                timeoutMs: 5_000,
            })).resolves.toMatchObject({
                value: 9,
            })

            await mounted.press('ui-base-admin-popup:tab:control')
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-base-admin-section:control',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                text: '应用控制',
            })
            await mounted.press('ui-base-admin-section:control:toggle-fullscreen')
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-base-admin-section:message',
                text: '已开启全屏',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                text: '已开启全屏',
            })

            await mounted.press('ui-base-admin-popup:tab:logs')
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-base-admin-block:assemblylog',
                timeoutMs: 3_000,
            })).resolves.toBeTruthy()
            await mounted.press('ui-base-admin-section:logs:open:0')
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-base-admin-detail:log-content',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                value: 'assembly-log-content',
            })

            await mounted.press('ui-base-admin-popup:tab:connector')
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-base-admin-section:connector:probe:camera',
                timeoutMs: 3_000,
            })).resolves.toBeTruthy()
            await mounted.press('ui-base-admin-section:connector:probe:camera')
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-base-admin-detail:camera:probe-message',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                value: '通道可用',
            })

            await mounted.press('ui-base-admin-popup:tab:topology')
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-base-admin-section:topology',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                text: '实例与拓扑',
            })
            await mounted.press('ui-base-admin-section:topology:set-slave')
            await mounted.press('ui-base-admin-section:topology:reconnect')
            await expect(mounted.client.call('runtime.selectState', {
                target: 'primary',
                path: ['kernel.base.topology-runtime-v3.context', 'instanceMode'],
            })).resolves.toBe('SLAVE')
        } finally {
            await mounted.unmount()
            vi.unstubAllGlobals()
        }
    })
})
