import React from 'react'
import {releaseInfo} from '../../src/generated/releaseInfo'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {tcpControlV2CommandDefinitions} from '@next/kernel-base-tcp-control-runtime-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {uiBaseTerminalScreenParts} from '@next/ui-base-terminal-console'
import {createMemoryStorage} from '../../../../../1-kernel/test-support/storageHarness'
import {mountAssemblyAutomationApp} from '../support/mountAssemblyAutomationApp'

type MemoryStorageHandle = ReturnType<typeof createMemoryStorage>

const stateStorageByNamespace = new Map<string, MemoryStorageHandle>()

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
        useWindowDimensions: () => ({width: 1280, height: 720, scale: 1, fontScale: 1}),
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
                                    id: 'ASSEMBLY-DEVICE-001',
                                    manufacturer: 'SUNMI',
                                }
                            },
                            async getSystemStatus() {
                                return {power: {batteryLevel: 100}}
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
                                return []
                            },
                            async getLogContent() {
                                return ''
                            },
                            async deleteLogFile() {
                                return true
                            },
                            async clearAllLogs() {
                                return true
                            },
                            async getLogDirPath() {
                                return '/tmp'
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
                                return {}
                            },
                            async subscribe() {
                                return 'subscription-1'
                            },
                            async unsubscribe() {
                                return undefined
                            },
                            async isAvailable() {
                                return false
                            },
                            async getAvailableTargets() {
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
                                return JSON.stringify({})
                            },
                            async getTopologyHostStats() {
                                return JSON.stringify({})
                            },
                            async replaceTopologyFaultRules() {
                                return JSON.stringify({})
                            },
                            async getDiagnosticsSnapshot() {
                                return null
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

vi.mock('react-native-qrcode-svg', () => ({
    default: (props: Record<string, unknown>) => React.createElement('mock-qrcode', props),
}))

vi.mock('@next/ui-base-admin-console', async importOriginal => {
    const actual = await importOriginal<typeof import('@next/ui-base-admin-console')>()
    const {defineKernelRuntimeModuleV2} = await import('@next/kernel-base-runtime-shell-v2')

    return {
        ...actual,
        moduleName: 'ui.base.admin-console',
        createModule: () => defineKernelRuntimeModuleV2({
            moduleName: 'ui.base.admin-console',
            packageVersion: '0.0.1',
        }),
        useAdminLauncher: () => ({}),
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


const createProductApp = (createApp: any, props: any, options: any = {}) => createApp(props, {
    createShellModule: options.createShellModule,
    extraKernelModules: options.extraKernelModules ?? [],
    productId: 'mixc-catering',
    releaseInfo,
    ...options,
})

describe('assembly ui automation runtime', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stateStorageByNamespace.clear()
        Reflect.set(globalThis, '__DEV__', true)
    })

    it('drives primary catering-shell UI through the assembly automation controller', async () => {
        const {RootScreen, createModule: createCateringShellModule, createCateringBusinessModules} = await import('@next/ui-integration-catering-shell')
        const {createApp} = await import('../../src/application/createApp')
        const runtimeApp = createProductApp(createApp, {
            deviceId: 'ASSEMBLY-DEVICE-001',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 0,
            isEmulator: true,
            topology: {
                role: 'master',
                localNodeId: 'master-node-1',
            },
        }, {createShellModule: createCateringShellModule, extraKernelModules: createCateringBusinessModules()})
        const mounted = await mountAssemblyAutomationApp(
            runtimeApp as any,
            <RootScreen deviceId="ASSEMBLY-DEVICE-001" />,
        )

        try {
            await expect(mounted.client.call('runtime.getInfo', {target: 'primary'})).resolves.toMatchObject({
                runtimeId: mounted.runtime.runtimeId,
                displayContext: {
                    displayIndex: 0,
                    displayCount: 2,
                },
            })
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-integration-catering-shell:root:primary',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                testID: 'ui-integration-catering-shell:root:primary',
            })
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-base-terminal-activate-device',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                testID: 'ui-base-terminal-activate-device',
            })
            await expect(mounted.client.call('ui.setValue', {
                target: 'primary',
                nodeId: 'ui-base-terminal-activate-device:sandbox',
                value: 'sandbox-kernel-base-test',
            })).rejects.toThrow(/NODE_NOT_ACTIONABLE/)

            await mounted.typeVirtualValue(
                'ui-base-terminal-activate-device:sandbox',
                'SANDBOX-KERNEL-BASE-TEST',
            )

            await mounted.typeVirtualValue(
                'ui-base-terminal-activate-device:input',
                'AB1234',
            )
            await mounted.client.call('wait.forIdle', {
                target: 'primary',
                timeoutMs: 500,
            })

            await expect(mounted.client.call('ui.getNode', {
                target: 'primary',
                nodeId: 'ui-base-terminal-activate-device:sandbox-value',
            })).resolves.toMatchObject({
                text: '当前沙箱：sandbox-kernel-base-test',
            })
            await expect(mounted.client.call('ui.getNode', {
                target: 'primary',
                nodeId: 'ui-base-terminal-activate-device:input',
            })).resolves.toMatchObject({
                value: 'AB1234',
            })
            await expect(mounted.client.call('ui.getNode', {
                target: 'primary',
                nodeId: 'ui-base-terminal-activate-device:value',
            })).resolves.toMatchObject({
                text: '当前输入：AB1234',
            })
            await expect(mounted.client.call('runtime.selectState', {
                target: 'primary',
                path: ['kernel.base.topology-runtime-v3.context', 'displayMode'],
            })).resolves.toBe('PRIMARY')
            await expect(mounted.client.call('wait.forScreen', {
                target: 'primary',
                partKey: 'ui.base.terminal.activate-device',
                timeoutMs: 2_000,
            })).resolves.toMatchObject({
                screen: {
                    partKey: 'ui.base.terminal.activate-device',
                },
            })

            await mounted.dispatchCommand(createCommand(
                tcpControlV2CommandDefinitions.activateTerminalSucceeded,
                {
                    terminalId: 'terminal-assembly-001',
                    accessToken: 'token-assembly-001',
                },
            ))

            await expect(mounted.client.call('wait.forScreen', {
                target: 'primary',
                partKey: 'ui.business.catering-master-data-workbench.primary-workbench',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                screen: {
                    partKey: 'ui.business.catering-master-data-workbench.primary-workbench',
                },
            })
            await expect(mounted.client.call('wait.forNode', {
                target: 'primary',
                testID: 'ui-business-catering-master-data-workbench:title',
                timeoutMs: 3_000,
            })).resolves.toSatisfy((node: {text?: string}) =>
                typeof node.text === 'string'
                && node.text.includes('主数据'),
            )
        } finally {
            await mounted.unmount()
        }
    })

    it('exposes the secondary catering-shell target through the same controller', async () => {
        const {RootScreen, createModule: createCateringShellModule, createCateringBusinessModules} = await import('@next/ui-integration-catering-shell')
        const {createApp} = await import('../../src/application/createApp')
        const runtimeApp = createProductApp(createApp, {
            deviceId: 'ASSEMBLY-DEVICE-SECONDARY-001',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 1,
            isEmulator: true,
            topology: {
                role: 'slave',
                localNodeId: 'slave-node-1',
            },
        }, {createShellModule: createCateringShellModule, extraKernelModules: createCateringBusinessModules()})
        const mounted = await mountAssemblyAutomationApp(
            runtimeApp as any,
            <RootScreen deviceId="ASSEMBLY-DEVICE-SECONDARY-001" />,
        )

        try {
            await expect(mounted.client.call('runtime.getInfo', {target: 'secondary'})).resolves.toMatchObject({
                displayContext: {
                    displayIndex: 1,
                    displayCount: 2,
                },
            })

            await mounted.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.replaceScreen,
                {
                    definition: uiBaseTerminalScreenParts.activateDeviceSecondaryScreen.definition,
                    source: 'assembly-ui-automation-runtime.spec',
                },
            ))

            await expect(mounted.client.call('wait.forNode', {
                target: 'secondary',
                testID: 'ui-integration-catering-shell:root:secondary',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                testID: 'ui-integration-catering-shell:root:secondary',
            })
            await expect(mounted.client.call('wait.forScreen', {
                target: 'secondary',
                partKey: 'ui.base.terminal.activate-device-secondary',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                screen: {
                    partKey: 'ui.base.terminal.activate-device-secondary',
                },
            })
            await expect(mounted.client.call('wait.forNode', {
                target: 'secondary',
                testID: 'ui-base-terminal-activate-device-secondary:title',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                text: '等待主屏完成设备激活',
            })
        } finally {
            await mounted.unmount()
        }
    })
})
