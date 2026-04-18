import React, {useEffect, useMemo, useState} from 'react'
import {Provider} from 'react-redux'
import {ScrollView, Text, View} from 'react-native'
import {createCommand, runtimeShellV2CommandDefinitions} from '@impos2/kernel-base-runtime-shell-v2'
import {
    InputRuntimeProvider,
    VirtualKeyboardOverlay,
} from '@impos2/ui-base-input-runtime'
import {
    AdminPopup,
    adminLauncherDefaults,
    createAdminPasswordVerifier,
    useAdminLauncher,
    createModule,
} from '../src'
import {
    createRuntimeReactHarness,
    type RuntimeReactHarness,
} from '../../runtime-react/test/support/runtimeReactHarness'
import {UiRuntimeProvider} from '@impos2/ui-base-runtime-react'
import {createBrowserAutomationHost} from '../../ui-automation-runtime/src/supports'
import {resetAdminHostTools} from '../src/supports/adminHostToolsRegistry'
import {resetAdminConsoleSections} from '../src/supports/adminSectionRegistry'
import {resetAdminAdapterDiagnosticsScenarios} from '../src/supports/adapterDiagnosticsRuntime'
import type {StateStoragePort} from '@impos2/kernel-base-platform-ports'

const deviceId = 'ADMIN-EXPO-DEVICE-001'

const createBrowserMemoryStorage = (): StateStoragePort => {
    const saved = new Map<string, string>()
    return {
        async getItem(key: string) {
            return saved.get(key) ?? null
        },
        async setItem(key: string, value: string) {
            saved.set(key, value)
        },
        async removeItem(key: string) {
            saved.delete(key)
        },
        async multiGet(keys: readonly string[]) {
            return Object.fromEntries(keys.map(key => [key, saved.get(key) ?? null]))
        },
        async multiSet(entries: Readonly<Record<string, string>>) {
            Object.entries(entries).forEach(([key, value]) => saved.set(key, value))
        },
        async multiRemove(keys: readonly string[]) {
            keys.forEach(key => saved.delete(key))
        },
        async getAllKeys() {
            return [...saved.keys()]
        },
    }
}

const createExpoHarness = async (): Promise<RuntimeReactHarness> => {
    resetAdminHostTools()
    resetAdminConsoleSections()
    resetAdminAdapterDiagnosticsScenarios()

    return createRuntimeReactHarness({
        modules: [createModule({
            adapterDiagnosticScenarios: [
                {
                    adapterKey: 'scanner',
                    scenarioKey: 'scan-self-test',
                    title: '扫码能力自检',
                    async run() {
                        return {
                            status: 'passed',
                            message: 'scanner-ready',
                        }
                    },
                },
                {
                    adapterKey: 'storage',
                    scenarioKey: 'storage-self-test',
                    title: '存储能力自检',
                    async run() {
                        return {
                            status: 'passed',
                            message: 'storage-ready',
                        }
                    },
                },
            ],
            hostTools: {
                device: {
                    async getSnapshot() {
                        return {
                            identity: [
                                {key: 'deviceId', label: '设备ID', value: deviceId},
                                {key: 'platform', label: '平台', value: 'expo-web'},
                            ],
                            runtime: [
                                {key: 'displayCount', label: '屏幕数量', value: 1},
                                {key: 'environmentMode', label: '运行环境', value: 'DEV'},
                            ],
                        }
                    },
                },
                logs: {
                    async listFiles() {
                        return [{fileName: 'admin-expo.log', fileSizeBytes: 128, lastModifiedAt: Date.now()}]
                    },
                    async readFile() {
                        return 'admin-console-expo-log'
                    },
                    async deleteFile() {},
                    async clearAll() {},
                    async getDirectoryPath() {
                        return '/tmp/admin-console-expo'
                    },
                },
                control: {
                    async getSnapshot() {
                        return {
                            isFullScreen: false,
                            isAppLocked: false,
                            selectedSpace: 'dev',
                            availableSpaces: ['dev', 'test'],
                        }
                    },
                    async setFullScreen() {},
                    async setAppLocked() {},
                    async restartApp() {},
                    async switchServerSpace() {},
                    async clearCache() {},
                },
                connector: {
                    async getChannels() {
                        return [{key: 'serial-main', title: '串口主通道', target: '/dev/ttyS0'}]
                    },
                    async probe(channelKey) {
                        return {
                            channelKey,
                            tone: 'ok',
                            message: 'serial-ready',
                        }
                    },
                },
            },
        })],
        platformPorts: {
            environmentMode: 'DEV',
            stateStorage: createBrowserMemoryStorage(),
            secureStateStorage: createBrowserMemoryStorage(),
            device: {
                async getDeviceId() {
                    return deviceId
                },
                async getPlatform() {
                    return 'expo-web'
                },
            },
        },
    })
}

const LauncherHost: React.FC<{
    onOpen(): void
}> = ({onOpen}) => {
    const handlers = useAdminLauncher({
        enabled: true,
        ...adminLauncherDefaults,
        onTriggered: onOpen,
    })

    return (
        <View
            testID="ui-base-admin-console-expo:launcher"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 20,
                width: adminLauncherDefaults.areaSize,
                height: adminLauncherDefaults.areaSize,
                borderBottomRightRadius: 28,
                backgroundColor: '#ff4d00',
                borderRightWidth: 4,
                borderBottomWidth: 4,
                borderColor: '#7c2d12',
                padding: 10,
                justifyContent: 'center',
                gap: 4,
            }}
            {...handlers}
        >
            <Text style={{color: '#ffffff', fontWeight: '900', fontSize: 12}}>ADMIN</Text>
            <Text style={{color: '#fff7ed', fontSize: 11, lineHeight: 14}}>
                左上角连点 {adminLauncherDefaults.requiredPresses} 下
            </Text>
        </View>
    )
}

export const AdminConsoleExpoShell: React.FC = () => {
    const [harness, setHarness] = useState<RuntimeReactHarness | null>(null)
    const [bootError, setBootError] = useState('')
    const [showAdmin, setShowAdmin] = useState(false)
    const verifier = createAdminPasswordVerifier({deviceIdProvider: () => deviceId})
    const password = verifier.deriveFor(new Date())
    const automationHost = useMemo(() => createBrowserAutomationHost({
        autoStart: false,
        buildProfile: 'test',
        runtimeId: 'admin-console-expo',
        target: 'primary',
    }), [])

    useEffect(() => {
        if (!harness) {
            return undefined
        }
        automationHost.start()
        return () => {
            automationHost.stop()
        }
    }, [automationHost, harness])

    useEffect(() => {
        let disposed = false
        void (async () => {
            try {
                const nextHarness = await createExpoHarness()
                await nextHarness.runtime.dispatchCommand(createCommand(
                    runtimeShellV2CommandDefinitions.initialize,
                    {},
                ))
                if (!disposed) {
                    setHarness(nextHarness)
                }
            } catch (error) {
                if (!disposed) {
                    setBootError(error instanceof Error ? error.message : String(error))
                }
            }
        })()
        return () => {
            disposed = true
        }
    }, [])

    if (bootError) {
        return (
            <View testID="ui-base-admin-console-expo:error">
                <Text>{bootError}</Text>
            </View>
        )
    }

    if (!harness) {
        return (
            <View testID="ui-base-admin-console-expo:loading">
                <Text>Admin Console Expo Loading</Text>
            </View>
        )
    }

    return (
        <Provider store={harness.store}>
            <UiRuntimeProvider runtime={harness.runtime}>
                <InputRuntimeProvider>
                    <View style={{flex: 1, backgroundColor: '#eef3f8'}}>
                        <LauncherHost onOpen={() => setShowAdmin(true)} />
                        <ScrollView
                            contentInsetAdjustmentBehavior="automatic"
                            contentContainerStyle={{
                                paddingTop: adminLauncherDefaults.areaSize + 20,
                                paddingRight: 20,
                                paddingBottom: 20,
                                paddingLeft: 20,
                                gap: 16,
                            }}
                        >
                            <View
                                testID="ui-base-admin-console-expo:ready"
                                style={{borderRadius: 18, backgroundColor: '#ffffff', padding: 18, gap: 8}}
                            >
                                <Text style={{fontSize: 24, fontWeight: '800', color: '#0f172a'}}>
                                    Admin Console Test Expo
                                </Text>
                                <Text selectable testID="ui-base-admin-console-expo:password">
                                    {password}
                                </Text>
                                <Text style={{color: '#64748b'}}>
                                    点击左上角橙色 ADMIN 区域 {adminLauncherDefaults.requiredPresses} 下打开管理员工作台。
                                </Text>
                            </View>
                        </ScrollView>
                    </View>
                    {showAdmin ? (
                        <AdminPopup
                            deviceId={deviceId}
                            onClose={() => setShowAdmin(false)}
                        />
                    ) : null}
                    <VirtualKeyboardOverlay />
                </InputRuntimeProvider>
            </UiRuntimeProvider>
        </Provider>
    )
}
