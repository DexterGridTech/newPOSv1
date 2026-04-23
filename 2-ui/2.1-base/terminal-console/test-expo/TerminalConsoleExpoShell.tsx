import React, {useEffect, useMemo, useState} from 'react'
import {Provider, useSelector} from 'react-redux'
import {ScrollView, Text, View} from 'react-native'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createHttpRuntime,
} from '@impos2/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModuleV2,
    selectTcpIdentitySnapshot,
    tcpControlV2CommandDefinitions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    kernelBaseTestServerConfig,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '@impos2/kernel-server-config-v2'
import type {StateStoragePort} from '@impos2/kernel-base-platform-ports'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    createRuntimeReactHarness,
    type RuntimeReactHarness,
} from '../../runtime-react/test/support/runtimeReactHarness'
import {UiRuntimeProvider} from '../../runtime-react/src'
import {createBrowserAutomationHost} from '../../ui-automation-runtime/src/supports'
import {
    InputRuntimeProvider,
    VirtualKeyboardOverlay,
} from '../../input-runtime/src'
import {createModule as createInputRuntimeModule} from '../../input-runtime/src'
import {
    ActivateDeviceScreen,
    TerminalSummaryScreen,
    createModule as createTerminalConsoleModule,
} from '../src'

const mockPlatformBaseUrl = process.env.EXPO_PUBLIC_MOCK_PLATFORM_BASE_URL ?? ''

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

const createBrowserFetchTransport = () => ({
    async execute(request: any) {
        const response = await fetch(request.url, {
            method: request.endpoint.method,
            headers: {
                'content-type': 'application/json',
                ...(request.input.headers ?? {}),
            },
            body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
        })
        return {
            data: await response.json(),
            status: response.status,
            statusText: response.statusText,
            headers: {},
        }
    },
})

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, init)
    const payload = await response.json() as {
        success: boolean
        data?: T
        error?: {message: string}
    }
    if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? `HTTP ${response.status}`)
    }
    return payload.data as T
}

const resolveTransportServers = (
    config: typeof kernelBaseTestServerConfig,
    baseUrlOverride: string,
) => {
    const space = config.spaces.find(item => item.name === config.selectedSpace)
    if (!space) {
        throw new Error(`missing server config space: ${config.selectedSpace}`)
    }

    return space.servers.map(server => {
        if (server.serverName !== SERVER_NAME_MOCK_TERMINAL_PLATFORM) {
            return {
                ...server,
                addresses: server.addresses.map(address => ({...address})),
            }
        }
        return {
            ...server,
            addresses: server.addresses.map((address, index) => index === 0
                ? {
                    ...address,
                    baseUrl: baseUrlOverride,
                }
                : {...address}),
        }
    })
}

const createExpoHarness = async (): Promise<RuntimeReactHarness> =>
    createRuntimeReactHarness({
        modules: [
            createTcpControlRuntimeModuleV2({
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'ui.base.terminal-console.test-expo',
                                subsystem: 'transport.http',
                            }),
                            transport: createBrowserFetchTransport(),
                            servers: resolveTransportServers(
                                kernelBaseTestServerConfig,
                                mockPlatformBaseUrl,
                            ),
                        })
                    },
                },
            }),
            createInputRuntimeModule(),
            createTerminalConsoleModule(),
        ],
        platformPorts: {
            environmentMode: 'DEV',
            stateStorage: createBrowserMemoryStorage(),
            secureStateStorage: createBrowserMemoryStorage(),
            device: {
                async getDeviceId() {
                    return 'TERMINAL-CONSOLE-EXPO-DEVICE-001'
                },
                async getPlatform() {
                    return 'expo-web'
                },
            },
        },
    })

export const TerminalConsoleExpoShell: React.FC = () => {
    const [harness, setHarness] = useState<RuntimeReactHarness | null>(null)
    const [sandboxId, setSandboxId] = useState('')
    const [activationCode, setActivationCode] = useState('')
    const [bootError, setBootError] = useState('')
    const automationHost = useMemo(() => createBrowserAutomationHost({
        autoStart: false,
        buildProfile: 'test',
        runtimeId: 'terminal-console-expo',
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
                if (!mockPlatformBaseUrl) {
                    throw new Error('missing EXPO_PUBLIC_MOCK_PLATFORM_BASE_URL')
                }
                const nextHarness = await createExpoHarness()
                await nextHarness.runtime.dispatchCommand(createCommand(
                    runtimeShellV2CommandDefinitions.initialize,
                    {},
                ))
                await nextHarness.runtime.dispatchCommand(createCommand(
                    tcpControlV2CommandDefinitions.bootstrapTcpControl,
                    {
                        deviceInfo: {
                            id: 'TERMINAL-CONSOLE-EXPO-DEVICE-001',
                            model: 'Terminal Console Expo Mock POS',
                        },
                    },
                ))
                const prepare = await fetchJson<{sandboxId: string; preparedAt: number}>(
                    `${mockPlatformBaseUrl}/mock-debug/kernel-base-test/prepare`,
                    {method: 'POST'},
                )
                const codes = await fetchJson<Array<{code: string; status: string}>>(
                    `${mockPlatformBaseUrl}/api/v1/admin/activation-codes?sandboxId=${encodeURIComponent(prepare.sandboxId)}`,
                )
                if (!disposed) {
                    setSandboxId(prepare.sandboxId)
                    setActivationCode(codes.find(item => item.status === 'AVAILABLE')?.code ?? '')
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
            <View testID="ui-base-terminal-console-expo:error">
                <Text>{bootError}</Text>
            </View>
        )
    }

    if (!harness) {
        return (
            <View testID="ui-base-terminal-console-expo:loading">
                <Text>Terminal Console Expo Loading</Text>
            </View>
        )
    }

    return (
        <Provider store={harness.store}>
            <UiRuntimeProvider runtime={harness.runtime}>
                <InputRuntimeProvider>
                    <TerminalConsoleExpoContent sandboxId={sandboxId} activationCode={activationCode} />
                    <VirtualKeyboardOverlay />
                </InputRuntimeProvider>
            </UiRuntimeProvider>
        </Provider>
    )
}

const TerminalConsoleExpoContent: React.FC<{
    sandboxId: string
    activationCode: string
}> = ({activationCode, sandboxId}) => {
    const identity = useSelector<RootState, ReturnType<typeof selectTcpIdentitySnapshot>>(
        state => selectTcpIdentitySnapshot(state),
    )

    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{
                padding: 20,
                gap: 16,
                backgroundColor: '#eef4fa',
            }}
        >
            <View
                testID="ui-base-terminal-console-expo:ready"
                style={{borderRadius: 18, backgroundColor: '#ffffff', padding: 18, gap: 8}}
            >
                <Text style={{fontSize: 24, fontWeight: '800', color: '#0f172a'}}>
                    Terminal Console Test Expo
                </Text>
                <Text selectable testID="ui-base-terminal-console-expo:activation-code">
                    {activationCode}
                </Text>
                <Text selectable testID="ui-base-terminal-console-expo:sandbox-id">
                    {sandboxId}
                </Text>
                <Text testID="ui-base-terminal-console-expo:activation-status">
                    {identity.activationStatus}
                </Text>
            </View>
            <ActivateDeviceScreen />
            <TerminalSummaryScreen />
        </ScrollView>
    )
}
