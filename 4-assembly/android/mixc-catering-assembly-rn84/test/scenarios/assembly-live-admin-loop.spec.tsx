import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createMemoryStorage} from '../../../../../1-kernel/test-support/storageHarness'
import {createLivePlatform, waitFor} from '../../../../../1-kernel/1.1-base/tcp-control-runtime-v2/test/helpers/liveHarness'
import {createCommand, runtimeShellV2CommandDefinitions} from '@impos2/kernel-base-runtime-shell-v2'
import {createAdminPasswordVerifier} from '@impos2/ui-base-admin-console'
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
                                    id: 'ASSEMBLY-DEVICE-LIVE-001',
                                    manufacturer: 'SUNMI',
                                    model: 'Mixc Catering Android RN84',
                                    osVersion: '14',
                                    displays: [{id: 'main'}, {id: 'customer'}],
                                }
                            },
                            async getSystemStatus() {
                                return {
                                    power: {batteryLevel: 100, powerConnected: true},
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
                                const fn = new Function('params', `"use strict"; ${script}`)
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

describe('assembly live admin automation loop', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stateStorageByNamespace.clear()
        Reflect.set(globalThis, '__DEV__', true)
    })

    it('activates against mock-terminal-platform and returns to activation after admin deactivation', async () => {
        const platform = await createLivePlatform()
        const {RootScreen} = await import('@impos2/ui-integration-catering-shell')
        const {createApp} = await import('../../src/application/createApp')
        const activationCodes = await platform.admin.activationCodes()
        const activationCode = activationCodes.find(item => item.status === 'AVAILABLE')?.code
        expect(activationCode).toBeTruthy()

        const runtimeApp = createApp({
            deviceId: 'ASSEMBLY-DEVICE-LIVE-001',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 0,
            isEmulator: true,
            topology: {
                role: 'master',
                localNodeId: 'master-node-live-1',
            },
        }, {
            mockTerminalPlatformBaseUrl: platform.baseUrl,
        })

        const mounted = await mountAssemblyAutomationApp(
            runtimeApp as any,
            <RootScreen deviceId="ASSEMBLY-DEVICE-LIVE-001" />,
        )

        try {
            await mounted.dispatchCommand(createCommand(
                runtimeShellV2CommandDefinitions.initialize,
                {},
            ))

            await mounted.typeVirtualValue(
                'ui-base-terminal-activate-device:sandbox',
                platform.prepare.sandboxId,
            )
            await mounted.typeVirtualValue(
                'ui-base-terminal-activate-device:input',
                activationCode!,
            )
            await mounted.press('ui-base-terminal-activate-device:submit')

            await expect(mounted.client.call('wait.forState', {
                target: 'primary',
                path: ['kernel.base.tcp-control-runtime-v2.identity', 'activationStatus'],
                equals: 'ACTIVATED',
                timeoutMs: 10_000,
            })).resolves.toMatchObject({
                value: 'ACTIVATED',
            })
            await expect(mounted.client.call('wait.forScreen', {
                target: 'primary',
                partKey: 'ui.integration.catering-shell.welcome',
                timeoutMs: 10_000,
            })).resolves.toMatchObject({
                screen: {
                    partKey: 'ui.integration.catering-shell.welcome',
                },
            })

            const terminalId = await mounted.client.call('runtime.selectState', {
                target: 'primary',
                path: ['kernel.base.tcp-control-runtime-v2.identity', 'terminalId'],
            })
            expect(terminalId).toBeTruthy()

            await waitFor(async () => {
                const terminals = await platform.admin.terminals()
                return terminals.some(item =>
                    item.terminalId === terminalId && item.lifecycleStatus === 'ACTIVE',
                )
            }, 10_000)

            const adminPassword = createAdminPasswordVerifier({
                deviceIdProvider: () => 'ASSEMBLY-DEVICE-LIVE-001',
            }).deriveFor(new Date())

            await mounted.press('ui-integration-catering-shell:admin-launcher')
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
                testID: 'ui-base-admin-section:terminal:deactivate',
                timeoutMs: 3_000,
            })).resolves.toMatchObject({
                text: '注销激活',
            })

            await mounted.press('ui-base-admin-section:terminal:deactivate')

            await expect(mounted.client.call('wait.forState', {
                target: 'primary',
                path: ['kernel.base.tcp-control-runtime-v2.identity', 'activationStatus'],
                equals: 'UNACTIVATED',
                timeoutMs: 10_000,
            })).resolves.toMatchObject({
                value: 'UNACTIVATED',
            })
            await expect(mounted.client.call('wait.forState', {
                target: 'primary',
                path: ['kernel.base.tcp-control-runtime-v2.credential', 'status'],
                equals: 'EMPTY',
                timeoutMs: 10_000,
            })).resolves.toMatchObject({
                value: 'EMPTY',
            })
            await expect(mounted.client.call('wait.forScreen', {
                target: 'primary',
                partKey: 'ui.base.terminal.activate-device',
                timeoutMs: 10_000,
            })).resolves.toMatchObject({
                screen: {
                    partKey: 'ui.base.terminal.activate-device',
                },
            })

            await waitFor(async () => {
                const terminals = await platform.admin.terminals()
                return terminals.some(item =>
                    item.terminalId === terminalId && item.lifecycleStatus === 'DEACTIVATED',
                )
            }, 10_000)
        } finally {
            await mounted.unmount()
            await platform.close()
        }
    }, 30_000)
})
