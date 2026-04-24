import React, {useEffect, useMemo, useState} from 'react'
import {Provider} from 'react-redux'
import {Text, View} from 'react-native'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createHttpRuntime,
} from '@next/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModuleV2,
    selectTcpIdentitySnapshot,
    tcpControlV2CommandDefinitions,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {createTdpSyncRuntimeModuleV2} from '../../../1-kernel/1.1-base/tdp-sync-runtime-v2/src'
import {
    kernelBaseTestServerConfig,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '@next/kernel-server-config-v2'
import type {StateStoragePort} from '@next/kernel-base-platform-ports'
import type {RootState} from '@next/kernel-base-state-runtime'
import {useSelector} from 'react-redux'
import {
    createRuntimeReactHarness,
    type RuntimeReactHarness,
} from '../../../2.1-base/runtime-react/test/support/runtimeReactHarness'
import {UiRuntimeProvider} from '../../../2.1-base/runtime-react/src'
import {createBrowserAutomationHost} from '../../../2.1-base/ui-automation-runtime/src/supports'
import {createAdminPasswordVerifier} from '../../../2.1-base/admin-console/src'
import {createModule as createAdminConsoleModule} from '../../../2.1-base/admin-console/src'
import {createModule as createInputRuntimeModule} from '../../../2.1-base/input-runtime/src'
import {createModule as createTerminalConsoleModule} from '../../../2.1-base/terminal-console/src'
import {createOrganizationIamMasterDataModule} from '../../../1-kernel/1.2-business/organization-iam-master-data/src'
import {createCateringProductMasterDataModule} from '../../../1-kernel/1.2-business/catering-product-master-data/src'
import {createCateringStoreOperatingMasterDataModule} from '../../../1-kernel/1.2-business/catering-store-operating-master-data/src'
import {createModule as createCateringMasterDataWorkbenchModule} from '../../../2.2-business/catering-master-data-workbench/src'
import {RootScreen} from '../src/ui/screens/RootScreen'
import {createModule as createCateringShellModule} from '../src'

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
                                moduleName: 'ui.integration.catering-shell.test-expo',
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
            createTdpSyncRuntimeModuleV2(),
            createInputRuntimeModule(),
            createAdminConsoleModule(),
            createTerminalConsoleModule(),
            createOrganizationIamMasterDataModule(),
            createCateringProductMasterDataModule(),
            createCateringStoreOperatingMasterDataModule(),
            createCateringMasterDataWorkbenchModule(),
            createCateringShellModule(),
        ],
        platformPorts: {
            environmentMode: 'DEV',
            stateStorage: createBrowserMemoryStorage(),
            secureStateStorage: createBrowserMemoryStorage(),
            device: {
                async getDeviceId() {
                    return 'RETAIL-SHELL-EXPO-DEVICE-001'
                },
                async getPlatform() {
                    return 'expo-web'
                },
            },
        },
        displayContext: {
            displayIndex: 0,
            displayCount: 1,
        },
    })

export const CateringShellExpoShell: React.FC = () => {
    const [harness, setHarness] = useState<RuntimeReactHarness | null>(null)
    const [activationCode, setActivationCode] = useState('')
    const [bootError, setBootError] = useState('')
    const automationHost = useMemo(() => createBrowserAutomationHost({
        autoStart: false,
        buildProfile: 'test',
        runtimeId: 'catering-shell-expo',
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
                            id: 'RETAIL-SHELL-EXPO-DEVICE-001',
                            model: 'Catering Shell Expo Mock POS',
                        },
                    },
                ))
                const codes = await fetchJson<Array<{code: string; status: string}>>(
                    `${mockPlatformBaseUrl}/api/v1/admin/activation-codes`,
                )
                if (!disposed) {
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
            <View testID="ui-integration-catering-shell-expo:error">
                <Text>{bootError}</Text>
            </View>
        )
    }

    if (!harness) {
        return (
            <View testID="ui-integration-catering-shell-expo:loading">
                <Text>Catering Shell Expo Loading</Text>
            </View>
        )
    }

    return (
        <Provider store={harness.store}>
            <UiRuntimeProvider runtime={harness.runtime}>
                <View style={{flex: 1, backgroundColor: '#eef4fa'}}>
                    <RootScreen deviceId="RETAIL-SHELL-EXPO-DEVICE-001" />
                    <CateringShellExpoStateCard activationCode={activationCode} />
                </View>
            </UiRuntimeProvider>
        </Provider>
    )
}

const CateringShellExpoStateCard: React.FC<{
    activationCode: string
}> = ({activationCode}) => {
    const identity = useSelector<RootState, ReturnType<typeof selectTcpIdentitySnapshot>>(
        state => selectTcpIdentitySnapshot(state),
    )
    const verifier = createAdminPasswordVerifier({
        deviceIdProvider: () => 'RETAIL-SHELL-EXPO-DEVICE-001',
    })
    const adminPassword = verifier.deriveFor(new Date())

    return (
        <View
            testID="ui-integration-catering-shell-expo:ready"
            style={{
                position: 'absolute',
                right: 16,
                bottom: 16,
                left: 120,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.96)',
                padding: 18,
                gap: 8,
                borderWidth: 1,
                borderColor: '#dbe7f3',
            }}
        >
            <Text style={{fontSize: 24, fontWeight: '800', color: '#0f172a'}}>
                Catering Shell Test Expo
            </Text>
            <Text selectable testID="ui-integration-catering-shell-expo:activation-code">
                {activationCode}
            </Text>
            <Text selectable testID="ui-integration-catering-shell-expo:activation-status">
                {identity.activationStatus}
            </Text>
            <Text selectable testID="ui-integration-catering-shell-expo:terminal-id">
                {identity.terminalId ?? 'unactivated'}
            </Text>
            <Text selectable testID="ui-integration-catering-shell-expo:admin-password">
                {adminPassword}
            </Text>
        </View>
    )
}
